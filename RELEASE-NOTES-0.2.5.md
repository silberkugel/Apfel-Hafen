# Apfel-Hafen 0.2.5

## Container-Konsole

- Im Administrationsmodus lässt sich für jeden laufenden Apple-Container über das Drei-Punkte-Menü eine interaktive Konsole öffnen.
- Die Konsole startet in einem eigenen macOS-Terminalfenster und führt `container exec --interactive --tty <Container> /bin/sh` aus.
- Der Konsolenaufruf ist auf die lokale Oberfläche und angemeldete macOS-Administratoren beschränkt; der Containerstatus wird direkt vor dem Öffnen erneut geprüft.
