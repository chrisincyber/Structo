// swift-tools-version: 5.9
// StructoKit — pure domain logic for the iOS app (blueprint §13.1/§13.4).
// UI-free, Foundation-light, spec-conformant: every engine here is tested
// against the shared JSON vectors in spec/, the same files the TypeScript
// and Postgres implementations are tested against.

import PackageDescription

let package = Package(
    name: "StructoKit",
    products: [
        .library(name: "StructoKit", targets: ["StructoKit"])
    ],
    targets: [
        .target(name: "StructoKit"),
        .testTarget(name: "StructoKitTests", dependencies: ["StructoKit"]),
    ]
)
