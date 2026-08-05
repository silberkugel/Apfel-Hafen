import Foundation
import ServiceManagement

struct ServiceManager {
  static let plistName = "de.apfel-hafen.service.plist"
  static let label = "de.apfel-hafen.service"
  private let service = SMAppService.agent(plistName: plistName)

  var state: ServiceState {
    switch service.status {
    case .enabled: .running
    case .requiresApproval: .approvalRequired
    case .notRegistered: .notInstalled
    case .notFound: .unavailable
    @unknown default: .unavailable
    }
  }

  func register() throws {
    try removeLegacyAgent()
    if service.status == .enabled {
      try service.unregister()
      for _ in 0..<20 where service.status != .notRegistered {
        Thread.sleep(forTimeInterval: 0.1)
      }
      guard service.status == .notRegistered else {
        throw NSError(domain: "ApfelHafen.Service", code: 1, userInfo: [NSLocalizedDescriptionKey: "Der bisherige Hintergrunddienst konnte nicht vollständig abgemeldet werden."])
      }
      try service.register()
      return
    }
    if service.status == .requiresApproval {
      SMAppService.openSystemSettingsLoginItems()
      return
    }
    try service.register()
  }

  func unregister() throws {
    if service.status != .notRegistered { try service.unregister() }
  }

  func openApprovalSettings() {
    SMAppService.openSystemSettingsLoginItems()
  }

  private func removeLegacyAgent() throws {
    let home = FileManager.default.homeDirectoryForCurrentUser
    let legacy = home.appending(path: "Library/LaunchAgents/\(Self.label).plist")
    guard FileManager.default.fileExists(atPath: legacy.path) else { return }
    try migrateLegacyData(from: legacy)
    let domain = "gui/\(getuid())/\(Self.label)"
    _ = try? ProcessRunner.run("/bin/launchctl", ["bootout", domain])
    try FileManager.default.removeItem(at: legacy)
  }

  private func migrateLegacyData(from plistURL: URL) throws {
    let data = try Data(contentsOf: plistURL)
    guard
      let plist = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
      let arguments = plist["ProgramArguments"] as? [String],
      arguments.count > 1
    else { return }

    let oldRoot = URL(fileURLWithPath: arguments[1]).deletingLastPathComponent()
    let destination = FileManager.default.homeDirectoryForCurrentUser
      .appending(path: "Library/Application Support/Apfel-Hafen", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)

    let migrations = [
      (oldRoot.appending(path: "data/settings.json"), destination.appending(path: "settings.json")),
      (oldRoot.appending(path: "data/tls", directoryHint: .isDirectory), destination.appending(path: "tls", directoryHint: .isDirectory)),
      (oldRoot.appending(path: "backups", directoryHint: .isDirectory), destination.appending(path: "backups", directoryHint: .isDirectory)),
    ]
    for (source, target) in migrations where FileManager.default.fileExists(atPath: source.path) && !FileManager.default.fileExists(atPath: target.path) {
      try FileManager.default.copyItem(at: source, to: target)
    }
  }
}
