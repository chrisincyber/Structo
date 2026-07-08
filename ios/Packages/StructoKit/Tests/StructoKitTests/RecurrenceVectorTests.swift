// Conformance: every vector in spec/recurrence/vectors.json must pass —
// the same file the TypeScript and Postgres implementations are tested
// against. Behavior changes start as vector PRs (spec/README.md).

import XCTest
@testable import StructoKit

final class RecurrenceVectorTests: XCTestCase {
    func testAllVectors() throws {
        let vectors = try Vectors.load("spec/recurrence/vectors.json")
        XCTAssertGreaterThan(vectors.count, 0)

        for vector in vectors {
            let name = vector["name"] as? String ?? "?"
            let ruleJSON = try XCTUnwrap(vector["rule"] as? [String: Any], name)
            let from = try XCTUnwrap(
                CivilDate(iso: try XCTUnwrap(vector["from"] as? String, name)), name)
            let expected = try XCTUnwrap(
                CivilDate(iso: try XCTUnwrap(vector["expect_next"] as? String, name)), name)
            let anchorOverride = (vector["anchor"] as? String).flatMap(CivilDate.init(iso:))

            let rule = RecurrenceRule(
                freq: try XCTUnwrap(
                    RecurrenceRule.Freq(rawValue: try XCTUnwrap(ruleJSON["freq"] as? String, name)),
                    name),
                interval: ruleJSON["interval"] as? Int ?? 1,
                weekdays: ruleJSON["weekdays"] as? [Int],
                monthday: ruleJSON["monthday"] as? Int,
                anchor: (ruleJSON["anchor"] as? String).flatMap(CivilDate.init(iso:)),
                mode: RecurrenceRule.Mode(rawValue: ruleJSON["mode"] as? String ?? "fixed") ?? .fixed
            )

            let next = try Recurrence.nextOccurrence(
                rule: rule, from: from, anchorOverride: anchorOverride)
            XCTAssertEqual(next, expected, "vector \(name): got \(next.iso)")
        }
    }
}
