import Darwin
import Foundation

let contents = Bundle.main.bundleURL.appending(path: "Contents", directoryHint: .isDirectory)
let serverRoot = contents.appending(path: "Resources/Server", directoryHint: .isDirectory)
let node = serverRoot.appending(path: "runtime/node").path
let server = serverRoot.appending(path: "server.mjs").path
let dataDirectory = FileManager.default.homeDirectoryForCurrentUser
  .appending(path: "Library/Application Support/Apfel-Hafen", directoryHint: .isDirectory).path
let logDirectory = FileManager.default.homeDirectoryForCurrentUser
  .appending(path: "Library/Logs/Apfel-Hafen", directoryHint: .isDirectory)

try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
let standardOutput = Darwin.open(logDirectory.appending(path: "service.log").path, O_WRONLY | O_CREAT | O_APPEND, 0o600)
let standardError = Darwin.open(logDirectory.appending(path: "service-error.log").path, O_WRONLY | O_CREAT | O_APPEND, 0o600)
if standardOutput >= 0 { dup2(standardOutput, STDOUT_FILENO); close(standardOutput) }
if standardError >= 0 { dup2(standardError, STDERR_FILENO); close(standardError) }

setenv("APFEL_HAFEN_DATA_DIR", dataDirectory, 1)
setenv("APFEL_HAFEN_MANAGED_BY_APP", "1", 1)
chdir(serverRoot.path)

var arguments: [UnsafeMutablePointer<CChar>?] = [strdup(node), strdup(server), nil]
defer { arguments.compactMap { $0 }.forEach { free($0) } }
execv(node, &arguments)
perror("ApfelHafenService could not start Node.js")
exit(EXIT_FAILURE)
