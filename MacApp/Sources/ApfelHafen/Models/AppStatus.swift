import Foundation

enum ServiceState: Equatable {
  case notInstalled
  case running
  case approvalRequired
  case unavailable

  var title: String {
    switch self {
    case .notInstalled: "Nicht eingerichtet"
    case .running: "Hintergrunddienst aktiviert"
    case .approvalRequired: "Freigabe erforderlich"
    case .unavailable: "Dienst nicht verfügbar"
    }
  }
}

struct RuntimeSettings: Codable {
  var volumeBasePath: String
  var listenHost: String
}
