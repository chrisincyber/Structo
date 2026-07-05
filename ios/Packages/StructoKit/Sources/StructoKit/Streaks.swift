// Streak engine — Swift implementation of spec/streaks/rules.md.
// Must stay conformant with spec/streaks/vectors.json; the TypeScript
// engine (web) and Postgres compute_streak() are tested against the same
// file. Derived data: recompute, never merge (§11.5).

public struct StreakHabit: Sendable {
    public enum Kind: String, Sendable {
        case binary, quantity, frequency
    }

    public enum Schedule: Equatable, Sendable {
        case daily
        case weekdays([Int]) // ISO, 1 = Monday
        case perWeek
    }

    public var type: Kind
    public var schedule: Schedule
    public var targetValue: Double?
    public var timesPerWeek: Int?
    public var pauses: [(from: CivilDate, to: CivilDate)]

    public init(
        type: Kind,
        schedule: Schedule,
        targetValue: Double? = nil,
        timesPerWeek: Int? = nil,
        pauses: [(from: CivilDate, to: CivilDate)] = []
    ) {
        self.type = type
        self.schedule = schedule
        self.targetValue = targetValue
        self.timesPerWeek = timesPerWeek
        self.pauses = pauses
    }
}

public struct StreakResult: Equatable, Sendable {
    public enum Unit: String, Sendable {
        case days, weeks
    }

    public var current: Int
    public var best: Int
    public var unit: Unit

    public init(current: Int, best: Int, unit: Unit) {
        self.current = current
        self.best = best
        self.unit = unit
    }
}

public enum Streaks {
    /// - Parameter logs: (loggedFor, value) pairs; negative values are
    ///   compensating entries (§5.4). Order is irrelevant.
    public static func compute(
        habit: StreakHabit,
        logs: [(day: CivilDate, value: Double)],
        today: CivilDate,
        weekStart: Int = 1
    ) -> StreakResult {
        let unit: StreakResult.Unit = habit.type == .frequency ? .weeks : .days

        // Day-level completion: net total per day reaches the threshold.
        var totals: [Int: Double] = [:]
        for log in logs {
            totals[log.day.dayNumber, default: 0] += log.value
        }
        let threshold = habit.type == .quantity ? (habit.targetValue ?? 1) : 1
        let completed = Set(totals.filter { $0.value >= threshold }.keys)
        let todayN = today.dayNumber
        guard let minDay = completed.min(), minDay <= todayN else {
            return StreakResult(current: 0, best: 0, unit: unit)
        }
        let paused = { (d: Int) -> Bool in
            habit.pauses.contains { d >= $0.from.dayNumber && d <= $0.to.dayNumber }
        }
        let scheduled = { (d: Int) -> Bool in
            if case .weekdays(let days) = habit.schedule {
                return days.contains(CivilDate(dayNumber: d).isoWeekday)
            }
            return true
        }

        var current = 0
        var best = 0
        var run = 0

        switch habit.type {
        case .binary, .quantity:
            // current: backward walk; unlogged scheduled *today* is pending
            var d = todayN
            while d >= minDay {
                if scheduled(d) && !paused(d) {
                    if completed.contains(d) {
                        current += 1
                    } else if d != todayN {
                        break
                    }
                }
                d -= 1
            }
            // best: forward scan with the same neutrality rules
            for day in minDay...todayN {
                if scheduled(day) && !paused(day) {
                    if completed.contains(day) {
                        run += 1
                        best = max(best, run)
                    } else if day != todayN {
                        run = 0
                    }
                }
            }
            return StreakResult(current: current, best: max(best, current), unit: unit)

        case .frequency:
            let timesPerWeek = habit.timesPerWeek ?? 1
            let weekOf = { (d: Int) -> Int in
                let dow = CivilDate(dayNumber: d).isoWeekday
                return d - (((dow - weekStart) + 7) % 7)
            }
            let todayWeek = weekOf(todayN)
            let firstWeek = weekOf(minDay)

            struct WeekInfo {
                var neutral: Bool
                var satisfied: Bool
            }
            let info = { (w: Int) -> WeekInfo in
                var pausedDays = 0
                var count = 0
                for d in w..<(w + 7) {
                    if paused(d) { pausedDays += 1 }
                    if completed.contains(d) { count += 1 }
                }
                let active = 7 - pausedDays
                if active == 0 { return WeekInfo(neutral: true, satisfied: false) }
                let needed = (timesPerWeek * active + 6) / 7 // ceil
                return WeekInfo(neutral: false, satisfied: count >= needed)
            }

            var w = todayWeek
            while w >= firstWeek {
                let i = info(w)
                if !i.neutral {
                    if i.satisfied {
                        current += 1
                    } else if w != todayWeek {
                        break
                    }
                }
                w -= 7
            }
            w = firstWeek
            while w <= todayWeek {
                let i = info(w)
                if !i.neutral {
                    if i.satisfied {
                        run += 1
                        best = max(best, run)
                    } else if w != todayWeek {
                        run = 0
                    }
                }
                w += 7
            }
            return StreakResult(current: current, best: max(best, current), unit: unit)
        }
    }
}
