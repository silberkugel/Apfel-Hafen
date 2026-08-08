import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    if CommandLine.arguments.contains("--register-service") {
      do {
        try ServiceManager().register()
        print("Apfel-Hafen LaunchAgent registered")
      } catch {
        fputs("\(error.localizedDescription)\n", stderr)
      }
      NSApp.terminate(nil)
      return
    }
    if CommandLine.arguments.contains("--unregister-service") {
      do {
        try ServiceManager().unregister()
        print("Apfel-Hafen LaunchAgent unregistered")
      } catch {
        fputs("\(error.localizedDescription)\n", stderr)
      }
      NSApp.terminate(nil)
      return
    }
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
  }
}

@main
struct ApfelHafenApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some Scene {
    WindowGroup("Apfel-Hafen", id: "main") {
      ContentView()
        .frame(minWidth: 720, minHeight: 560)
    }
    .windowResizability(.contentMinSize)
    .commands {
      CommandGroup(after: .appInfo) {
        Button("Weboberfläche öffnen") {
          NSWorkspace.shared.open(URL(string: "https://127.0.0.1:4173")!)
        }
        .keyboardShortcut("o", modifiers: [.command, .shift])
      }
    }
  }
}
