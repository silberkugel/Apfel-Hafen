import Foundation

enum ProcessRunner {
  @discardableResult
  static func run(_ executable: String, _ arguments: [String], timeout: TimeInterval = 15) throws -> String {
    let process = Process()
    let output = Pipe()
    let error = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = output
    process.standardError = error
    try process.run()

    let deadline = Date().addingTimeInterval(timeout)
    while process.isRunning && Date() < deadline {
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    if process.isRunning {
      process.terminate()
      throw CocoaError(.userCancelled)
    }
    let stdout = String(decoding: output.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
    let stderr = String(decoding: error.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
    guard process.terminationStatus == 0 else {
      throw NSError(domain: "ApfelHafen.Process", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: stderr.isEmpty ? stdout : stderr])
    }
    return stdout.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
