# Apfel-Hafen 0.2.9

Diese Version ergänzt eine abgesicherte Remote-MCP-Schnittstelle für Hermes Agent und andere kompatible MCP-Clients.

## Remote MCP

- Der neue Streamable-HTTP-Endpunkt ist unter `/mcp` über den bestehenden HTTPS-Dienst erreichbar.
- Unterstützt werden das aktuelle zustandslose MCP-Protokoll `2026-07-28` und ältere MCP-Clients mit Initialisierungshandshake.
- Bereitgestellt werden ausschließlich die Werkzeuge `list_containers`, `get_container_status`, `get_container_logs`, `start_container`, `stop_container`, `restart_container` und `check_image_update`.
- Shell-Zugriff, Container-Erstellung, Löschung, Image-Ersetzung und Host-Administration sind nicht über MCP verfügbar.

## Sicherheit und Betrieb

- Remote MCP ist standardmäßig deaktiviert und wird nur mit einem separaten Bearer-Token von mindestens 32 Zeichen aktiviert.
- Der Token kann über `APFEL_HAFEN_MCP_TOKEN` oder für den nativen LaunchAgent über die geschützte Datei `~/Library/Application Support/Apfel-Hafen/mcp-token` bereitgestellt werden.
- Token-Vergleiche erfolgen über gleich große SHA-256-Werte; Token-Dateien mit Gruppen- oder Weltzugriff werden abgelehnt.
- Werkzeugargumente sind auf exakte Container-Namen beschränkt, und Werkzeugaufrufe werden ohne Zugangsdaten im Dienstprotokoll erfasst.
- Dokumentation und Tests decken Hermes-Konfiguration, Authentifizierung, Tool-Schemas sowie ältere und aktuelle MCP-Protokollvarianten ab.
