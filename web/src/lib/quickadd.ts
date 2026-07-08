// Quick-add capture parser — TypeScript implementation of
// spec/quick-add/grammar.md. Must stay conformant with
// spec/quick-add/vectors.json (quickadd.test.ts runs every vector in CI);
// the Swift parser implements the same grammar against the same vectors.
//
// The parser proposes, the user confirms: every extraction carries its source
// span so the UI can render removable chips; a removed chip re-runs the parse
// with that extraction disabled and the literal text returns to the title.

import type { Recurrence } from "./types";

export type ParseRef = {
  date: string; // YYYY-MM-DD (user-local "today")
  time: string; // HH:MM
  week_start: number; // ISO, 1 = Monday
  time_format?: "system" | "12h" | "24h";
};

export type Extraction = {
  kind: "date" | "time" | "recurrence" | "priority" | "project" | "label";
  start: number;
  end: number;
  text: string;
};

export type ParseResult = {
  title: string;
  due_date?: string;
  due_time?: string; // HH:MM
  recurrence?: Recurrence;
  project?: string;
  labels?: string[];
  priority?: number;
  extractions: Extraction[];
};

export type ParseOptions = {
  /** When provided, #tokens only match these names (prefix, case-insensitive);
      unknown tokens stay literal. When absent, any #token is a candidate. */
  knownProjects?: string[];
  /** Extraction kinds the user dismissed (chip ×); e.g. "date", "project". */
  disabled?: ReadonlySet<string>;
};

// ---------------------------------------------------------------------------
// Pure date helpers (no timezone involvement: floating local dates, §11.12)
// ---------------------------------------------------------------------------

function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToYmd(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(ymd: string, days: number): string {
  return msToYmd(ymdToMs(ymd) + days * 86_400_000);
}

/** ISO weekday, 1 = Monday. */
function isodow(ymd: string): number {
  const dow = new Date(ymdToMs(ymd)).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 7 : dow;
}

/** Next date with the given ISO weekday, strictly after `from`. */
function nextWeekday(from: string, target: number): string {
  let d = addDays(from, 1);
  while (isodow(d) !== target) d = addDays(d, 1);
  return d;
}

// ---------------------------------------------------------------------------
// Token tables
// ---------------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 7, sun: 7,
};
const WEEKDAY_RE = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

type Candidate = { start: number; end: number; text: string };
type DateCandidate = Candidate & { date: string };
type TimeCandidate = Candidate & { time: string }; // HH:MM
type RecurrenceCandidate = Candidate & { rule: Recurrence; impliedDate: string };

function* matchAll(re: RegExp, input: string): Generator<RegExpExecArray> {
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = r.exec(input)) !== null) {
    yield m;
    if (m.index === r.lastIndex) r.lastIndex++; // zero-width safety
  }
}

// ---------------------------------------------------------------------------
// Candidate collectors
// ---------------------------------------------------------------------------

function dateCandidates(input: string, ref: ParseRef): DateCandidate[] {
  const out: DateCandidate[] = [];

  for (const m of matchAll(/\b(today|tod)\b/gi, input)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], date: ref.date });
  }
  for (const m of matchAll(/\b(tomorrow|tom)\b/gi, input)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], date: addDays(ref.date, 1) });
  }
  for (const m of matchAll(new RegExp(`\\b(${WEEKDAY_RE})\\b`, "gi"), input)) {
    out.push({
      start: m.index, end: m.index + m[0].length, text: m[0],
      date: nextWeekday(ref.date, WEEKDAYS[m[1].toLowerCase()]),
    });
  }
  for (const m of matchAll(/\bnext week\b/gi, input)) {
    const delta = ((ref.week_start - isodow(ref.date) - 1 + 7) % 7) + 1;
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], date: addDays(ref.date, delta) });
  }
  for (const m of matchAll(/\bin (\d+) days?\b/gi, input)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], date: addDays(ref.date, Number(m[1])) });
  }
  // "jul 15" / "15 jul"
  const monthDay = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})\\b`, "gi");
  const dayMonth = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})\\b`, "gi");
  for (const m of matchAll(monthDay, input)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0],
      date: resolveMonthDate(MONTHS[m[1].toLowerCase()], Number(m[2]), ref.date) });
  }
  for (const m of matchAll(dayMonth, input)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0],
      date: resolveMonthDate(MONTHS[m[2].toLowerCase()], Number(m[1]), ref.date) });
  }
  return out;
}

/** This year if not already past, else next year. */
function resolveMonthDate(month: number, day: number, refDate: string): string {
  const year = Number(refDate.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return candidate >= refDate ? candidate : `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function timeCandidates(input: string): TimeCandidate[] {
  const out: TimeCandidate[] = [];
  // 10am / 10:30pm / at 8am
  for (const m of matchAll(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, input)) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0],
      time: `${String(h).padStart(2, "0")}:${m[2] ?? "00"}` });
  }
  // 15:30 / at 15:30
  for (const m of matchAll(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/gi, input)) {
    const h = Number(m[1]);
    if (h > 23 || Number(m[2]) > 59) continue;
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0],
      time: `${String(h).padStart(2, "0")}:${m[2]}` });
  }
  // "at 10" (bare hour requires the "at")
  for (const m of matchAll(/\bat\s+(\d{1,2})\b(?!:)/gi, input)) {
    const h = Number(m[1]);
    if (h > 23) continue;
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0],
      time: `${String(h).padStart(2, "0")}:00` });
  }
  // De-duplicate overlapping matches (am/pm form wins over bare HH:MM inside it)
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: TimeCandidate[] = [];
  for (const c of out) {
    if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  }
  return kept;
}

function recurrenceCandidates(input: string, ref: ParseRef): RecurrenceCandidate[] {
  const out: RecurrenceCandidate[] = [];

  const push = (m: RegExpExecArray, rule: Recurrence, implied: string) => {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], rule, impliedDate: implied });
  };
  const mode = (bang: string | undefined): Recurrence["mode"] =>
    bang ? "after_completion" : "fixed";

  for (const m of matchAll(/\bevery(!)?\s+(\d+)\s+days?\b/gi, input)) {
    const n = Number(m[2]);
    push(m, { v: 1, freq: "daily", interval: n, mode: mode(m[1]) }, addDays(ref.date, n));
  }
  for (const m of matchAll(/\bevery(!)?\s+(\d+)\s+weeks?\b/gi, input)) {
    const n = Number(m[2]);
    push(m, { v: 1, freq: "weekly", interval: n, mode: mode(m[1]) }, addDays(ref.date, 7 * n));
  }
  for (const m of matchAll(/\bevery(!)?\s+weekday\b/gi, input)) {
    let d = addDays(ref.date, 1);
    while (isodow(d) > 5) d = addDays(d, 1);
    push(m, { v: 1, freq: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5], mode: mode(m[1]) }, d);
  }
  for (const m of matchAll(/\b(?:every(!)?\s+day|daily)\b/gi, input)) {
    push(m, { v: 1, freq: "daily", interval: 1, mode: mode(m[1]) }, addDays(ref.date, 1));
  }
  for (const m of matchAll(/\bevery(!)?\s+week\b(?!day)/gi, input)) {
    push(m, { v: 1, freq: "weekly", interval: 1, mode: mode(m[1]) }, addDays(ref.date, 7));
  }
  for (const m of matchAll(/\bevery(!)?\s+month(?:\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)?\b/gi, input)) {
    const monthday = m[2] ? Number(m[2]) : undefined;
    const rule: Recurrence = { v: 1, freq: "monthly", interval: 1, mode: mode(m[1]) };
    if (monthday) rule.monthday = monthday;
    push(m, rule, addDays(ref.date, 30)); // display anchor; server math is authoritative
  }
  for (const m of matchAll(/\bevery(!)?\s+year\b/gi, input)) {
    push(m, { v: 1, freq: "yearly", interval: 1, mode: mode(m[1]) }, ref.date);
  }
  // every <weekday>[, <weekday>|and <weekday>]*
  const listRe = new RegExp(
    `\\bevery(!)?\\s+((?:${WEEKDAY_RE})(?:(?:\\s*,\\s*|\\s+and\\s+)(?:${WEEKDAY_RE}))*)s?\\b`,
    "gi",
  );
  for (const m of matchAll(listRe, input)) {
    const names = m[2].toLowerCase().split(/\s*,\s*|\s+and\s+/);
    const days = [...new Set(names.map((n) => WEEKDAYS[n.replace(/s$/, "")] ?? WEEKDAYS[n]))]
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (days.length === 0) continue;
    let d = addDays(ref.date, 1);
    while (!days.includes(isodow(d))) d = addDays(d, 1);
    push(m, { v: 1, freq: "weekly", interval: 1, weekdays: days, mode: mode(m[1]) }, d);
  }

  // Longest match wins per position (e.g. "every weekday" over "every week")
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: RecurrenceCandidate[] = [];
  for (const c of out) {
    if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------------

export function parseQuickAdd(
  input: string,
  ref: ParseRef,
  options: ParseOptions = {},
): ParseResult {
  const disabled = options.disabled ?? new Set<string>();
  const spans: Extraction[] = [];

  // 1. Project / label tokens
  let project: string | undefined;
  const labels: string[] = [];
  if (!disabled.has("project")) {
    for (const m of matchAll(/(^|\s)#([A-Za-z0-9_-]+)/g, input)) {
      const name = m[2];
      const known = options.knownProjects?.find(
        (p) => p.toLowerCase().startsWith(name.toLowerCase()),
      );
      if (options.knownProjects && !known) continue; // unknown -> literal
      if (project) continue; // first project token wins
      project = known ?? name;
      const start = m.index + m[1].length;
      spans.push({ kind: "project", start, end: start + name.length + 1, text: `#${name}` });
    }
  }
  if (!disabled.has("label")) {
    for (const m of matchAll(/(^|\s)@([A-Za-z0-9_-]+)/g, input)) {
      labels.push(m[2]);
      const start = m.index + m[1].length;
      spans.push({ kind: "label", start, end: start + m[2].length + 1, text: `@${m[2]}` });
    }
  }

  // 2. Recurrence (rightmost)
  let recurrence: Recurrence | undefined;
  let recurrenceImplied: { date: string; start: number } | undefined;
  if (!disabled.has("recurrence")) {
    const recs = recurrenceCandidates(input, ref).filter(
      (c) => !spans.some((s) => c.start < s.end && s.start < c.end),
    );
    const winner = recs.at(-1);
    if (winner) {
      recurrence = winner.rule;
      recurrenceImplied = { date: winner.impliedDate, start: winner.start };
      spans.push({ kind: "recurrence", start: winner.start, end: winner.end, text: winner.text });
    }
  }

  // 3. Due date: rightmost among explicit dates and the recurrence anchor
  let due_date: string | undefined;
  if (!disabled.has("date")) {
    const dates = dateCandidates(input, ref).filter(
      (c) => !spans.some((s) => c.start < s.end && s.start < c.end),
    );
    const explicit = dates.sort((a, b) => a.start - b.start).at(-1);
    if (explicit && (!recurrenceImplied || explicit.start > recurrenceImplied.start)) {
      due_date = explicit.date;
      spans.push({ kind: "date", start: explicit.start, end: explicit.end, text: explicit.text });
    } else if (recurrenceImplied) {
      due_date = recurrenceImplied.date;
    }
  } else if (recurrenceImplied) {
    due_date = recurrenceImplied.date;
  }

  // 4. Time (rightmost); a bare time implies today, or tomorrow if passed
  let due_time: string | undefined;
  if (!disabled.has("time")) {
    const times = timeCandidates(input).filter(
      (c) => !spans.some((s) => c.start < s.end && s.start < c.end),
    );
    const winner = times.sort((a, b) => a.start - b.start).at(-1);
    if (winner) {
      due_time = winner.time;
      spans.push({ kind: "time", start: winner.start, end: winner.end, text: winner.text });
      if (!due_date) {
        due_date = winner.time > ref.time ? ref.date : addDays(ref.date, 1);
      }
    }
  }

  // 5. Priority: whole-word p1–p4, only at end of input or adjacent to
  //    another extracted span (grammar rule 5a)
  let priority: number | undefined;
  if (!disabled.has("priority")) {
    for (const m of matchAll(/\bp([1-4])\b/gi, input)) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (spans.some((s) => start < s.end && s.start < end)) continue;
      const atEnd = input.slice(end).trim().length === 0;
      const adjacent = spans.some(
        (s) =>
          (s.end <= start && input.slice(s.end, start).trim() === "") ||
          (end <= s.start && input.slice(end, s.start).trim() === ""),
      );
      if (atEnd || adjacent) {
        priority = Number(m[1]);
        spans.push({ kind: "priority", start, end, text: m[0] });
        break;
      }
    }
  }

  // 6. Title = input minus extracted spans; must remain non-empty, else the
  //    whole extraction is cancelled (grammar rule 3)
  const title = removeSpans(input, spans);
  if (title.length === 0) {
    return { title: input.trim(), extractions: [] };
  }

  const result: ParseResult = { title, extractions: spans.sort((a, b) => a.start - b.start) };
  if (due_date) result.due_date = due_date;
  if (due_time) result.due_time = due_time;
  if (recurrence) result.recurrence = recurrence;
  if (project) result.project = project;
  if (labels.length > 0) result.labels = labels;
  if (priority) result.priority = priority;
  return result;
}

function removeSpans(input: string, spans: Extraction[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const s of sorted) {
    out += input.slice(pos, s.start);
    pos = s.end;
  }
  out += input.slice(pos);
  return out.replace(/\s+/g, " ").trim();
}
