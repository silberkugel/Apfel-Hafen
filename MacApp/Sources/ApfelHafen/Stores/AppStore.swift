import AppKit
import Foundation
import Observation

@MainActor
@Observable
final class AppStore {
  private let service = ServiceManager()
  private let fileManager = FileManager.default

  var serviceState: ServiceState = .notInstalled
  var containerCLIAvailable = false
  var containerServiceRunning = false
  var serverReachable = false
  var volumeBasePath = ""
  var networkAccess = false
  var isWorking = false
  var message = ""
  var errorMessage = ""

  var dataDirectory: URL {
    fileManager.homeDirectoryForCurrentUser
      .appending(path: "Library/Application Support/Apfel-Hafen", directoryHint: .isDirectory)
  }

  var isConfigured: Bool { serviceState != .notInstalled && !volumeBasePath.isEmpty }

  init() {
    refresh()
  }

  func refresh() {
    serviceState = service.state
    containerCLIAvailable = fileManager.isExecutableFile(atPath: "/usr/local/bin/container")
    containerServiceRunning = (try? ProcessRunner.run("/usr/local/bin/container", ["system", "status"], timeout: 5))?.contains("running") == true
    serverReachable = (try? ProcessRunner.run("/usr/bin/curl", ["--insecure", "--silent", "--fail", "--max-time", "2", "https://127.0.0.1:4173/api/status"], timeout: 4)) != nil
    loadSettings()
  }

  func chooseVolumePath() {
    let panel = NSOpenPanel()
    panel.title = "Globalen Ordner für Container-Volumes auswählen"
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.canCreateDirectories = true
    panel.allowsMultipleSelection = false
    if panel.runModal() == .OK, let url = panel.url {
      volumeBasePath = url.path
    }
  }

  func configure() {
    isWorking = true
    errorMessage = ""
    message = ""
    defer { isWorking = false; refresh() }
    do {
      guard containerCLIAvailable else { throw NSError(domain: "ApfelHafen", code: 1, userInfo: [NSLocalizedDescriptionKey: "Apples container-CLI wurde nicht gefunden."]) }
      guard !volumeBasePath.isEmpty else { throw NSError(domain: "ApfelHafen", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bitte zuerst einen globalen Volume-Pfad auswählen."]) }
      try fileManager.createDirectory(atPath: volumeBasePath, withIntermediateDirectories: true)
      try saveSettings()
      if !containerServiceRunning {
        _ = try ProcessRunner.run("/usr/local/bin/container", ["system", "start"], timeout: 30)
      }
      try service.register()
      message = "Apfel-Hafen wurde eingerichtet. Der Hintergrunddienst startet automatisch."
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func stopService() {
    do {
      try service.unregister()
      message = "Der Hintergrunddienst wurde deaktiviert."
      errorMessage = ""
    } catch { errorMessage = error.localizedDescription }
    refresh()
  }

  func openApprovalSettings() { service.openApprovalSettings() }

  func openWebInterface() {
    NSWorkspace.shared.open(URL(string: "https://127.0.0.1:4173")!)
  }

  func openLogs() {
    let logs = fileManager.homeDirectoryForCurrentUser.appending(path: "Library/Logs/Apfel-Hafen", directoryHint: .isDirectory)
    try? fileManager.createDirectory(at: logs, withIntermediateDirectories: true)
    NSWorkspace.shared.open(logs)
  }

  private func loadSettings() {
    let settingsURL = dataDirectory.appending(path: "settings.json")
    guard let data = try? Data(contentsOf: settingsURL), let settings = try? JSONDecoder().decode(RuntimeSettings.self, from: data) else {
      if volumeBasePath.isEmpty {
        volumeBasePath = fileManager.homeDirectoryForCurrentUser.appending(path: "ContainerVolumes", directoryHint: .isDirectory).path
      }
      return
    }
    volumeBasePath = settings.volumeBasePath
    networkAccess = settings.listenHost == "0.0.0.0"
  }

  private func saveSettings() throws {
    try fileManager.createDirectory(at: dataDirectory, withIntermediateDirectories: true)
    let settingsURL = dataDirectory.appending(path: "settings.json")
    let settings = RuntimeSettings(volumeBasePath: volumeBasePath, listenHost: networkAccess ? "0.0.0.0" : "127.0.0.1")
    let data = try JSONEncoder().encode(settings)
    try data.write(to: settingsURL, options: .atomic)
    try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: settingsURL.path)
  }
}
