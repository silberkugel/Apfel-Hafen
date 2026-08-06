// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "ApfelHafenMac",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "ApfelHafen", targets: ["ApfelHafen"]),
    .executable(name: "ApfelHafenService", targets: ["ApfelHafenService"]),
  ],
  targets: [
    .executableTarget(name: "ApfelHafen", path: "MacApp/Sources/ApfelHafen"),
    .executableTarget(name: "ApfelHafenService", path: "MacApp/Sources/ApfelHafenService"),
  ]
)
