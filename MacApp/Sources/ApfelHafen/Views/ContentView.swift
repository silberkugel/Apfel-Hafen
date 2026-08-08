import SwiftUI

struct ContentView: View {
  @State private var store = AppStore()

  var body: some View {
    @Bindable var store = store
    ScrollView {
      VStack(spacing: 24) {
        header
        if !store.isConfigured { setupCard } else { controlCard }
        prerequisites
        if !store.message.isEmpty { feedback(store.message, color: .green) }
        if !store.errorMessage.isEmpty { feedback(store.errorMessage, color: .red) }
      }
      .padding(32)
      .frame(maxWidth: 820)
      .frame(maxWidth: .infinity)
    }
    .background(.background.secondary)
    .task { store.refresh() }
  }

  private var header: some View {
    VStack(spacing: 8) {
      Image(systemName: "ferry.fill").font(.system(size: 42)).foregroundStyle(.green)
      Text("Apfel-Hafen").font(.largeTitle.bold())
      Text("Einrichtung und Verwaltung des lokalen Hintergrunddienstes")
        .foregroundStyle(.secondary)
    }
  }

  private var setupCard: some View {
    GroupBox("Ersteinrichtung") {
      VStack(alignment: .leading, spacing: 18) {
        Text("Der Hafenmeister prüft den Liegeplatz und aktiviert anschließend den Hintergrunddienst. Die Benutzeroberfläche läuft weiterhin in deinem normalen Browser.")
          .foregroundStyle(.secondary)
        pathPicker
        Toggle("Zugriff aus dem lokalen Netzwerk erlauben (0.0.0.0)", isOn: $store.networkAccess)
        if store.networkAccess {
          Label("Verwende für andere Geräte ein vertrauenswürdiges Zertifikat und eine restriktive Firewall-Regel.", systemImage: "exclamationmark.shield")
            .font(.callout).foregroundStyle(.orange)
        }
        HStack {
          Spacer()
          Button("Apfel-Hafen einrichten") { store.configure() }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(store.isWorking || !store.containerCLIAvailable || store.volumeBasePath.isEmpty)
        }
      }.padding(8)
    }
  }

  private var controlCard: some View {
    GroupBox("Hintergrunddienst") {
      VStack(alignment: .leading, spacing: 18) {
        HStack {
          statusDot(store.serverReachable ? .green : .orange)
          VStack(alignment: .leading) {
            Text(store.serviceState.title).font(.headline)
            Text(store.serverReachable ? "Weboberfläche ist erreichbar" : "Dienst startet oder benötigt Aufmerksamkeit")
              .font(.callout).foregroundStyle(.secondary)
          }
          Spacer()
          Button("Aktualisieren") { store.refresh() }
        }
        pathPicker
        Toggle("Zugriff aus dem lokalen Netzwerk erlauben (0.0.0.0)", isOn: $store.networkAccess)
        HStack {
          Button("Änderungen speichern") { store.configure() }
          Button("Weboberfläche öffnen") { store.openWebInterface() }.buttonStyle(.borderedProminent)
          Button("Protokolle") { store.openLogs() }
          Spacer()
          if store.serviceState == .approvalRequired {
            Button("In Systemeinstellungen freigeben") { store.openApprovalSettings() }
          }
          Button("Dienst deaktivieren", role: .destructive) { store.stopService() }
        }
      }.padding(8)
    }
  }

  private var pathPicker: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("Globaler Pfad für Container-Volumes").font(.headline)
      HStack {
        TextField("Volume-Pfad", text: $store.volumeBasePath)
        Button("Auswählen …") { store.chooseVolumePath() }
      }
      Text("Dauerhafte Containerdaten sollten ausschließlich unter diesem Pfad liegen.")
        .font(.caption).foregroundStyle(.secondary)
    }
  }

  private var prerequisites: some View {
    GroupBox("Systemprüfung") {
      VStack(spacing: 12) {
        checkRow("Apple container-CLI", ready: store.containerCLIAvailable)
        Divider()
        checkRow("Apple-Containerdienst", ready: store.containerServiceRunning)
        Divider()
        checkRow("Apfel-Hafen-Datenordner", ready: FileManager.default.fileExists(atPath: store.dataDirectory.path))
      }.padding(8)
    }
  }

  private func checkRow(_ title: String, ready: Bool) -> some View {
    HStack { Image(systemName: ready ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(ready ? .green : .red); Text(title); Spacer(); Text(ready ? "Bereit" : "Fehlt").foregroundStyle(.secondary) }
  }

  private func statusDot(_ color: Color) -> some View { Circle().fill(color).frame(width: 12, height: 12) }
  private func feedback(_ text: String, color: Color) -> some View { Label(text, systemImage: color == .green ? "checkmark.circle.fill" : "exclamationmark.triangle.fill").frame(maxWidth: .infinity, alignment: .leading).padding().background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8)).foregroundStyle(color) }
}
