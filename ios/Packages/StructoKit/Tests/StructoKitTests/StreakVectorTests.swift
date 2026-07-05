// Conformance: every vector in spec/streaks/vectors.json must pass —
// the same file the TypeScript engine and Postgres compute_streak() are
// tested against.

import XCTest
@testable import StructoKit

final class StreakVectorTests: XCTestCase {
    func testAllVectors() throws {
        let vectors = try Vectors.load("spec/streaks/vectors.json")
        XCTAssertGreaterThan(vectors.count, 0)

        for vector in vectors {
            let name = vector["name"] as? String ?? "?"
            let habitJSON = try XCTUnwrap(vector["habit"] as? [String: Any], name)
            let scheduleJSON = try XCTUnwrap(habitJSON["schedule"] as? [String: Any], name)

            let schedule: StreakHabit.Schedule
            switch scheduleJSON["kind"] as? String {
            case "weekdays":
                schedule = .weekdays(try XCTUnwrap(scheduleJSON["days"] as? [Int], name))
            case "per_week":
                schedule = .perWeek
            default:
                schedule = .daily
            }

            let pauses: [(from: CivilDate, to: CivilDate)] =
                ((habitJSON["pauses"] as? [[String: Any]]) ?? []).compactMap { pause in
                    guard let from = (pause["from"] as? String).flatMap(CivilDate.init(iso:)),
                          let to = (pause["to"] as? String).flatMap(CivilDate.init(iso:))
                    else { return nil }
                    return (from: from, to: to)
                }

            let habit = StreakHabit(
                type: try XCTUnwrap(
                    StreakHabit.Kind(rawValue: try XCTUnwrap(habitJSON["type"] as? String, name)),
                    name),
                schedule: schedule,
                targetValue: (habitJSON["target_value"] as? NSNumber)?.doubleValue,
                timesPerWeek: habitJSON["times_per_week"] as? Int,
                pauses: pauses
            )

            let logs: [(day: CivilDate, value: Double)] =
                try (vector["logs"] as? [[Any]] ?? []).map { pair in
                    let day = try XCTUnwrap(
                        (pair[0] as? String).flatMap(CivilDate.init(iso:)), name)
                    let value = try XCTUnwrap((pair[1] as? NSNumber)?.doubleValue, name)
                    return (day: day, value: value)
                }

            let today = try XCTUnwrap(
                CivilDate(iso: try XCTUnwrap(vector["today"] as? String, name)), name)
            let weekStart = vector["week_start"] as? Int ?? 1

            let expectJSON = try XCTUnwrap(vector["expect"] as? [String: Any], name)
            let expected = StreakResult(
                current: try XCTUnwrap(expectJSON["current"] as? Int, name),
                best: try XCTUnwrap(expectJSON["best"] as? Int, name),
                unit: try XCTUnwrap(
                    StreakResult.Unit(rawValue: try XCTUnwrap(expectJSON["unit"] as? String, name)),
                    name)
            )

            let result = Streaks.compute(
                habit: habit, logs: logs, today: today, weekStart: weekStart)
            XCTAssertEqual(result, expected, "vector \(name)")
        }
    }
}
