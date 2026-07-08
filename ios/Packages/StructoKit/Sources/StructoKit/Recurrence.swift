// Recurrence engine — Swift implementation of spec/recurrence/grammar.md.
// Must stay conformant with spec/recurrence/vectors.json; Postgres
// (next_occurrence) and the server RPC are tested against the same file.

public struct RecurrenceRule: Equatable, Sendable {
    public enum Freq: String, Sendable {
        case daily, weekly, monthly, yearly
    }

    public enum Mode: String, Sendable {
        case fixed
        case afterCompletion = "after_completion"
    }

    public var freq: Freq
    public var interval: Int
    public var weekdays: [Int]?   // ISO, 1 = Monday
    public var monthday: Int?
    public var anchor: CivilDate? // due date at rule creation (§ grammar)
    public var mode: Mode

    public init(
        freq: Freq,
        interval: Int = 1,
        weekdays: [Int]? = nil,
        monthday: Int? = nil,
        anchor: CivilDate? = nil,
        mode: Mode = .fixed
    ) {
        self.freq = freq
        self.interval = interval
        self.weekdays = weekdays
        self.monthday = monthday
        self.anchor = anchor
        self.mode = mode
    }
}

public enum Recurrence {
    public enum Error: Swift.Error {
        case invalidInterval
        case noOccurrenceFound
    }

    /// Next occurrence strictly after `from` (the current due date for fixed
    /// mode, the completion date for after_completion — the caller chooses).
    public static func nextOccurrence(
        rule: RecurrenceRule,
        from: CivilDate,
        anchorOverride: CivilDate? = nil
    ) throws -> CivilDate {
        guard rule.interval >= 1 else { throw Error.invalidInterval }
        let anchor = anchorOverride ?? rule.anchor ?? from

        switch rule.freq {
        case .daily:
            return from.adding(days: rule.interval)

        case .weekly:
            guard let weekdays = rule.weekdays, !weekdays.isEmpty else {
                return from.adding(days: 7 * rule.interval)
            }
            let anchorMonday = anchor.dayNumber - (anchor.isoWeekday - 1)
            var d = from.adding(days: 1)
            for _ in 0..<800 {
                if weekdays.contains(d.isoWeekday) {
                    let dMonday = d.dayNumber - (d.isoWeekday - 1)
                    let weeks = (dMonday - anchorMonday) / 7
                    if (((weeks % rule.interval) + rule.interval) % rule.interval) == 0 {
                        return d
                    }
                }
                d = d.adding(days: 1)
            }
            throw Error.noOccurrenceFound

        case .monthly:
            // Clamp to shorter months; the stored rule keeps its monthday, so
            // a "31st" rule resumes in longer months (spec vector:
            // monthly_recovers_from_clamp).
            let mday = rule.monthday ?? anchor.day
            let monthIndex = from.year * 12 + (from.month - 1) + rule.interval
            let year = monthIndex / 12
            let month = monthIndex % 12 + 1
            let day = min(mday, CivilDate.daysInMonth(year: year, month: month))
            return CivilDate(year: year, month: month, day: day)

        case .yearly:
            let year = from.year + rule.interval
            let day = min(from.day, CivilDate.daysInMonth(year: year, month: from.month))
            return CivilDate(year: year, month: from.month, day: day)
        }
    }
}
