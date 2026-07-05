// Quick-add capture parser — Swift implementation of spec/quick-add/grammar.md.
// Must stay conformant with spec/quick-add/vectors.json; the TypeScript parser
// implements the same grammar against the same vectors.
//
// Uses NSRegularExpression (Linux-portable Foundation) rather than Swift Regex
// literals; spans are UTF-16 NSRanges over the input.

import Foundation

public struct QuickAddRef: Sendable {
    public var date: CivilDate
    public var time: String // "HH:MM"
    public var weekStart: Int

    public init(date: CivilDate, time: String, weekStart: Int = 1) {
        self.date = date
        self.time = time
        self.weekStart = weekStart
    }
}

public struct QuickAddResult: Sendable {
    public var title: String
    public var dueDate: CivilDate?
    public var dueTime: String? // "HH:MM"
    public var recurrence: RecurrenceRule?
    public var recurrenceText: String?
    public var project: String?
    public var labels: [String]
    public var priority: Int?
}

public enum QuickAddParser {
    private static let weekdays: [String: Int] = [
        "monday": 1, "mon": 1, "tuesday": 2, "tue": 2, "tues": 2,
        "wednesday": 3, "wed": 3, "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
        "friday": 5, "fri": 5, "saturday": 6, "sat": 6, "sunday": 7, "sun": 7,
    ]
    private static let months: [String: Int] = [
        "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
        "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
        "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
        "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
    ]
    private static var weekdayAlt: String {
        weekdays.keys.sorted { $0.count > $1.count }.joined(separator: "|")
    }
    private static var monthAlt: String {
        months.keys.sorted { $0.count > $1.count }.joined(separator: "|")
    }

    private struct Span {
        var range: NSRange
        var text: String
    }

    private struct DateCandidate {
        var span: Span
        var date: CivilDate
    }

    private struct TimeCandidate {
        var span: Span
        var time: String
    }

    private struct RecurrenceCandidate {
        var span: Span
        var rule: RecurrenceRule
        var implied: CivilDate
    }

    private static func regex(_ pattern: String) -> NSRegularExpression {
        // Patterns are compile-time constants; force-try is deliberate.
        // swiftlint:disable:next force_try
        try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }

    private static func matches(
        _ pattern: String, _ input: String
    ) -> [NSTextCheckingResult] {
        let ns = input as NSString
        return regex(pattern).matches(
            in: input, options: [], range: NSRange(location: 0, length: ns.length))
    }

    private static func group(_ m: NSTextCheckingResult, _ i: Int, _ input: String) -> String? {
        guard i < m.numberOfRanges, m.range(at: i).location != NSNotFound else { return nil }
        return (input as NSString).substring(with: m.range(at: i))
    }

    private static func nextWeekday(after from: CivilDate, target: Int) -> CivilDate {
        var d = from.adding(days: 1)
        while d.isoWeekday != target { d = d.adding(days: 1) }
        return d
    }

    private static func overlaps(_ a: NSRange, _ b: NSRange) -> Bool {
        a.location < b.location + b.length && b.location < a.location + a.length
    }

    // MARK: - Candidate collectors

    private static func dateCandidates(_ input: String, _ ref: QuickAddRef) -> [DateCandidate] {
        var out: [DateCandidate] = []
        let ns = input as NSString

        for m in matches(#"\b(today|tod)\b"#, input) {
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: ref.date))
        }
        for m in matches(#"\b(tomorrow|tom)\b"#, input) {
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: ref.date.adding(days: 1)))
        }
        for m in matches("\\b(\(weekdayAlt))\\b", input) {
            let name = group(m, 1, input)!.lowercased()
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: nextWeekday(after: ref.date, target: weekdays[name]!)))
        }
        for m in matches(#"\bnext week\b"#, input) {
            let delta = ((ref.weekStart - ref.date.isoWeekday - 1 + 7) % 7) + 1
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: ref.date.adding(days: delta)))
        }
        for m in matches(#"\bin (\d+) days?\b"#, input) {
            let n = Int(group(m, 1, input)!)!
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: ref.date.adding(days: n)))
        }
        for m in matches("\\b(\(monthAlt))\\.?\\s+(\\d{1,2})\\b", input) {
            let month = months[group(m, 1, input)!.lowercased()]!
            let day = Int(group(m, 2, input)!)!
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: resolveMonthDate(month: month, day: day, ref: ref.date)))
        }
        for m in matches("\\b(\\d{1,2})\\s+(\(monthAlt))\\b", input) {
            let day = Int(group(m, 1, input)!)!
            let month = months[group(m, 2, input)!.lowercased()]!
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             date: resolveMonthDate(month: month, day: day, ref: ref.date)))
        }
        return out
    }

    private static func resolveMonthDate(month: Int, day: Int, ref: CivilDate) -> CivilDate {
        let candidate = CivilDate(year: ref.year, month: month, day: day)
        return candidate >= ref
            ? candidate
            : CivilDate(year: ref.year + 1, month: month, day: day)
    }

    private static func timeCandidates(_ input: String) -> [TimeCandidate] {
        var out: [TimeCandidate] = []
        let ns = input as NSString

        for m in matches(#"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b"#, input) {
            var hour = Int(group(m, 1, input)!)! % 12
            if group(m, 3, input)!.lowercased() == "pm" { hour += 12 }
            let minute = group(m, 2, input) ?? "00"
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             time: String(format: "%02d:%@", hour, minute)))
        }
        for m in matches(#"\b(?:at\s+)?(\d{1,2}):(\d{2})\b"#, input) {
            let hour = Int(group(m, 1, input)!)!
            let minute = Int(group(m, 2, input)!)!
            guard hour <= 23, minute <= 59 else { continue }
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             time: String(format: "%02d:%02d", hour, minute)))
        }
        for m in matches(#"\bat\s+(\d{1,2})\b(?!:)"#, input) {
            let hour = Int(group(m, 1, input)!)!
            guard hour <= 23 else { continue }
            out.append(.init(span: .init(range: m.range, text: ns.substring(with: m.range)),
                             time: String(format: "%02d:00", hour)))
        }

        out.sort {
            $0.span.range.location != $1.span.range.location
                ? $0.span.range.location < $1.span.range.location
                : $0.span.range.length > $1.span.range.length
        }
        var kept: [TimeCandidate] = []
        for c in out where !kept.contains(where: { overlaps(c.span.range, $0.span.range) }) {
            kept.append(c)
        }
        return kept
    }

    private static func recurrenceCandidates(
        _ input: String, _ ref: QuickAddRef
    ) -> [RecurrenceCandidate] {
        var out: [RecurrenceCandidate] = []
        let ns = input as NSString

        func span(_ m: NSTextCheckingResult) -> Span {
            Span(range: m.range, text: ns.substring(with: m.range))
        }
        func mode(_ bang: String?) -> RecurrenceRule.Mode {
            bang != nil ? .afterCompletion : .fixed
        }

        for m in matches(#"\bevery(!)?\s+(\d+)\s+days?\b"#, input) {
            let n = Int(group(m, 2, input)!)!
            out.append(.init(span: span(m),
                             rule: .init(freq: .daily, interval: n, mode: mode(group(m, 1, input))),
                             implied: ref.date.adding(days: n)))
        }
        for m in matches(#"\bevery(!)?\s+(\d+)\s+weeks?\b"#, input) {
            let n = Int(group(m, 2, input)!)!
            out.append(.init(span: span(m),
                             rule: .init(freq: .weekly, interval: n, mode: mode(group(m, 1, input))),
                             implied: ref.date.adding(days: 7 * n)))
        }
        for m in matches(#"\bevery(!)?\s+weekday\b"#, input) {
            var d = ref.date.adding(days: 1)
            while d.isoWeekday > 5 { d = d.adding(days: 1) }
            out.append(.init(span: span(m),
                             rule: .init(freq: .weekly, weekdays: [1, 2, 3, 4, 5],
                                         mode: mode(group(m, 1, input))),
                             implied: d))
        }
        for m in matches(#"\b(?:every(!)?\s+day|daily)\b"#, input) {
            out.append(.init(span: span(m),
                             rule: .init(freq: .daily, mode: mode(group(m, 1, input))),
                             implied: ref.date.adding(days: 1)))
        }
        for m in matches(#"\bevery(!)?\s+week\b(?!day)"#, input) {
            out.append(.init(span: span(m),
                             rule: .init(freq: .weekly, mode: mode(group(m, 1, input))),
                             implied: ref.date.adding(days: 7)))
        }
        for m in matches(#"\bevery(!)?\s+month(?:\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)?\b"#, input) {
            let monthday = group(m, 2, input).flatMap(Int.init)
            out.append(.init(span: span(m),
                             rule: .init(freq: .monthly, monthday: monthday,
                                         mode: mode(group(m, 1, input))),
                             implied: ref.date.adding(days: 30)))
        }
        for m in matches(#"\bevery(!)?\s+year\b"#, input) {
            out.append(.init(span: span(m),
                             rule: .init(freq: .yearly, mode: mode(group(m, 1, input))),
                             implied: ref.date))
        }
        let listPattern =
            "\\bevery(!)?\\s+((?:\(weekdayAlt))(?:(?:\\s*,\\s*|\\s+and\\s+)(?:\(weekdayAlt)))*)s?\\b"
        for m in matches(listPattern, input) {
            let names = group(m, 2, input)!.lowercased()
                .components(separatedBy: regexSplit)
                .flatMap { $0.split(separator: " ").map(String.init) }
                .filter { $0 != "and" && !$0.isEmpty }
            var days = Set<Int>()
            for name in names {
                let cleaned = name.trimmingCharacters(in: CharacterSet(charactersIn: ", "))
                if let d = weekdays[cleaned] ?? weekdays[String(cleaned.dropLast())] {
                    days.insert(d)
                }
            }
            guard !days.isEmpty else { continue }
            let sorted = days.sorted()
            var d = ref.date.adding(days: 1)
            while !sorted.contains(d.isoWeekday) { d = d.adding(days: 1) }
            out.append(.init(span: span(m),
                             rule: .init(freq: .weekly, weekdays: sorted,
                                         mode: mode(group(m, 1, input))),
                             implied: d))
        }

        out.sort {
            $0.span.range.location != $1.span.range.location
                ? $0.span.range.location < $1.span.range.location
                : $0.span.range.length > $1.span.range.length
        }
        var kept: [RecurrenceCandidate] = []
        for c in out where !kept.contains(where: { overlaps(c.span.range, $0.span.range) }) {
            kept.append(c)
        }
        return kept
    }

    private static let regexSplit = ","

    // MARK: - Parser

    public static func parse(
        _ input: String,
        ref: QuickAddRef,
        knownProjects: [String]? = nil
    ) -> QuickAddResult {
        let ns = input as NSString
        var spans: [Span] = []

        // 1. Project / label tokens
        var project: String?
        var labels: [String] = []
        for m in matches(#"(^|\s)#([A-Za-z0-9_-]+)"#, input) {
            let name = group(m, 2, input)!
            var resolved = name
            if let known = knownProjects {
                guard let match = known.first(where: {
                    $0.lowercased().hasPrefix(name.lowercased())
                }) else { continue } // unknown -> literal
                resolved = match
            }
            guard project == nil else { continue }
            project = resolved
            let lead = m.range(at: 1).length
            let range = NSRange(location: m.range.location + lead, length: m.range.length - lead)
            spans.append(.init(range: range, text: ns.substring(with: range)))
        }
        for m in matches(#"(^|\s)@([A-Za-z0-9_-]+)"#, input) {
            labels.append(group(m, 2, input)!)
            let lead = m.range(at: 1).length
            let range = NSRange(location: m.range.location + lead, length: m.range.length - lead)
            spans.append(.init(range: range, text: ns.substring(with: range)))
        }

        // 2. Recurrence (rightmost, non-overlapping with tokens)
        var recurrence: RecurrenceRule?
        var recurrenceText: String?
        var recurrenceImplied: (date: CivilDate, location: Int)?
        let recs = recurrenceCandidates(input, ref)
            .filter { c in !spans.contains { overlaps(c.span.range, $0.range) } }
        if let winner = recs.last {
            recurrence = winner.rule
            recurrenceText = winner.span.text
            recurrenceImplied = (winner.implied, winner.span.range.location)
            spans.append(winner.span)
        }

        // 3. Due date: rightmost among explicit dates and the recurrence anchor
        var dueDate: CivilDate?
        let dates = dateCandidates(input, ref)
            .filter { c in !spans.contains { overlaps(c.span.range, $0.range) } }
            .sorted { $0.span.range.location < $1.span.range.location }
        if let explicit = dates.last,
           recurrenceImplied == nil || explicit.span.range.location > recurrenceImplied!.location {
            dueDate = explicit.date
            spans.append(explicit.span)
        } else if let implied = recurrenceImplied {
            dueDate = implied.date
        }

        // 4. Time (rightmost); a bare time implies today, or tomorrow if passed
        var dueTime: String?
        let times = timeCandidates(input)
            .filter { c in !spans.contains { overlaps(c.span.range, $0.range) } }
            .sorted { $0.span.range.location < $1.span.range.location }
        if let winner = times.last {
            dueTime = winner.time
            spans.append(winner.span)
            if dueDate == nil {
                dueDate = winner.time > ref.time ? ref.date : ref.date.adding(days: 1)
            }
        }

        // 5. Priority: p1–p4, only at end of input or adjacent to another
        //    extracted span (grammar rule 5a)
        var priority: Int?
        for m in matches(#"\bp([1-4])\b"#, input) {
            guard !spans.contains(where: { overlaps(m.range, $0.range) }) else { continue }
            let end = m.range.location + m.range.length
            let tail = ns.substring(from: end).trimmingCharacters(in: .whitespaces)
            let atEnd = tail.isEmpty
            let adjacent = spans.contains { s in
                let sEnd = s.range.location + s.range.length
                if sEnd <= m.range.location {
                    return ns.substring(with: NSRange(location: sEnd, length: m.range.location - sEnd))
                        .trimmingCharacters(in: .whitespaces).isEmpty
                }
                if end <= s.range.location {
                    return ns.substring(with: NSRange(location: end, length: s.range.location - end))
                        .trimmingCharacters(in: .whitespaces).isEmpty
                }
                return false
            }
            if atEnd || adjacent {
                priority = Int(group(m, 1, input)!)
                spans.append(.init(range: m.range, text: ns.substring(with: m.range)))
                break
            }
        }

        // 6. Title = input minus extracted spans; must remain non-empty, else
        //    the whole extraction is cancelled (grammar rule 3)
        let title = removeSpans(input, spans)
        if title.isEmpty {
            return QuickAddResult(
                title: input.trimmingCharacters(in: .whitespaces),
                dueDate: nil, dueTime: nil, recurrence: nil, recurrenceText: nil,
                project: nil, labels: [], priority: nil)
        }

        return QuickAddResult(
            title: title,
            dueDate: dueDate,
            dueTime: dueTime,
            recurrence: recurrence,
            recurrenceText: recurrenceText,
            project: project,
            labels: labels,
            priority: priority)
    }

    private static func removeSpans(_ input: String, _ spans: [Span]) -> String {
        let ns = input as NSString
        let sorted = spans.sorted { $0.range.location < $1.range.location }
        var out = ""
        var pos = 0
        for s in sorted {
            if s.range.location > pos {
                out += ns.substring(with: NSRange(location: pos, length: s.range.location - pos))
            }
            pos = max(pos, s.range.location + s.range.length)
        }
        if pos < ns.length {
            out += ns.substring(from: pos)
        }
        return out
            .components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}
