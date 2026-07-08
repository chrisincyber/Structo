// Conformance: every vector in spec/quick-add/vectors.json must pass —
// the same file the TypeScript parser is tested against.

import XCTest
@testable import StructoKit

final class QuickAddVectorTests: XCTestCase {
    func testAllVectors() throws {
        let root = try Vectors.loadRoot("spec/quick-add/vectors.json")
        let vectors = try XCTUnwrap(root["vectors"] as? [[String: Any]])
        let defaultRef = try XCTUnwrap(root["default_ref"] as? [String: Any])

        func makeRef(_ json: [String: Any]) throws -> QuickAddRef {
            QuickAddRef(
                date: try XCTUnwrap(
                    CivilDate(iso: try XCTUnwrap(json["date"] as? String))),
                time: try XCTUnwrap(json["time"] as? String),
                weekStart: json["week_start"] as? Int ?? 1
            )
        }

        for vector in vectors {
            let name = vector["name"] as? String ?? "?"
            let input = try XCTUnwrap(vector["input"] as? String, name)
            let ref = try makeRef(vector["ref"] as? [String: Any] ?? defaultRef)
            let result = QuickAddParser.parse(
                input, ref: ref, knownProjects: vector["projects"] as? [String])
            let expect = try XCTUnwrap(vector["expect"] as? [String: Any], name)

            XCTAssertEqual(result.title, expect["title"] as? String, "\(name): title")
            XCTAssertEqual(
                result.dueDate?.iso, expect["due_date"] as? String, "\(name): due_date")
            XCTAssertEqual(
                result.dueTime, expect["due_time"] as? String, "\(name): due_time")
            XCTAssertEqual(
                result.project, expect["project"] as? String, "\(name): project")
            XCTAssertEqual(
                result.labels.isEmpty ? nil : result.labels,
                expect["labels"] as? [String], "\(name): labels")
            XCTAssertEqual(
                result.priority, expect["priority"] as? Int, "\(name): priority")

            if let expectedRule = expect["recurrence"] as? [String: Any] {
                let rule = try XCTUnwrap(result.recurrence, "\(name): recurrence missing")
                XCTAssertEqual(
                    rule.freq.rawValue, expectedRule["freq"] as? String, "\(name): freq")
                XCTAssertEqual(
                    rule.interval, expectedRule["interval"] as? Int ?? 1, "\(name): interval")
                XCTAssertEqual(
                    rule.weekdays, expectedRule["weekdays"] as? [Int], "\(name): weekdays")
                XCTAssertEqual(
                    rule.monthday, expectedRule["monthday"] as? Int, "\(name): monthday")
                XCTAssertEqual(
                    rule.mode.rawValue,
                    expectedRule["mode"] as? String ?? "fixed", "\(name): mode")
            } else {
                XCTAssertNil(result.recurrence, "\(name): unexpected recurrence")
            }
        }
    }
}
