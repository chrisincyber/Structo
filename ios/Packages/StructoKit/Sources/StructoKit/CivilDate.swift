// Pure civil-date arithmetic — no Foundation Calendar, no timezones.
// Due dates and habit days are floating local dates (blueprint §11.12), so
// all engine math is day-number arithmetic; the app resolves "today" once at
// the boundary. Algorithms are Howard Hinnant's days_from_civil family.

public struct CivilDate: Equatable, Hashable, Comparable, Sendable {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// Parses "YYYY-MM-DD"; returns nil on malformed input.
    public init?(iso: String) {
        let parts = iso.split(separator: "-")
        guard parts.count == 3,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2])
        else { return nil }
        self.init(year: y, month: m, day: d)
    }

    public var iso: String {
        func pad(_ n: Int, _ width: Int) -> String {
            let s = String(n)
            return String(repeating: "0", count: max(0, width - s.count)) + s
        }
        return "\(pad(year, 4))-\(pad(month, 2))-\(pad(day, 2))"
    }

    /// Days since 1970-01-01.
    public var dayNumber: Int {
        var y = year
        if month <= 2 { y -= 1 }
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    public init(dayNumber: Int) {
        var z = dayNumber + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        z -= era * 146_097
        let yoe = (z - z / 1460 + z / 36524 - z / 146_096) / 365
        let doy = z - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp + (mp < 10 ? 3 : -9)
        self.init(year: yoe + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d)
    }

    /// ISO weekday, 1 = Monday … 7 = Sunday.
    public var isoWeekday: Int {
        // 1970-01-01 (dayNumber 0) was a Thursday (4).
        (((dayNumber + 3) % 7) + 7) % 7 + 1
    }

    public func adding(days: Int) -> CivilDate {
        CivilDate(dayNumber: dayNumber + days)
    }

    public static func daysInMonth(year: Int, month: Int) -> Int {
        let firstOfNext = month == 12
            ? CivilDate(year: year + 1, month: 1, day: 1)
            : CivilDate(year: year, month: month + 1, day: 1)
        return firstOfNext.dayNumber - CivilDate(year: year, month: month, day: 1).dayNumber
    }

    public static func < (lhs: CivilDate, rhs: CivilDate) -> Bool {
        lhs.dayNumber < rhs.dayNumber
    }
}
