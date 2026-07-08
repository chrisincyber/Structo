// Shared helpers for loading spec/ conformance vectors (JSON) relative to
// the repo root. Vectors are heterogeneous, so tests use JSONSerialization
// rather than Codable.

import Foundation
import XCTest

enum Vectors {
    /// repo root = five directories above this file's directory:
    /// ios/Packages/StructoKit/Tests/StructoKitTests/<file>
    static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // StructoKitTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // StructoKit
            .deletingLastPathComponent() // Packages
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // repo root
    }

    static func loadRoot(_ specPath: String) throws -> [String: Any] {
        let url = repoRoot.appendingPathComponent(specPath)
        let data = try Data(contentsOf: url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return try XCTUnwrap(json, "no JSON object in \(specPath)")
    }

    static func load(_ specPath: String) throws -> [[String: Any]] {
        let vectors = try loadRoot(specPath)["vectors"] as? [[String: Any]]
        return try XCTUnwrap(vectors, "no vectors array in \(specPath)")
    }
}
