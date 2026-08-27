# Apfel-Hafen 0.2.5

## Container-Konsole

- Im Administrationsmodus lässt sich für jeden laufenden Apple-Container über das Drei-Punkte-Menü eine interaktive Konsole öffnen.
- Die Konsole startet in einem eigenen macOS-Terminalfenster und führt `container exec --interactive --tty <Container> <Konsole>` aus.
- Falls ein Image keine POSIX-Shell enthält, probiert Apfel-Hafen nacheinander `sh`, `bash`, `ash`, `python3` und `python`.
- Der Konsolenaufruf ist auf die lokale Oberfläche und angemeldete macOS-Administratoren beschränkt; der Containerstatus wird direkt vor dem Öffnen erneut geprüft.

## Auslieferung

- Der Release-Befehl erzeugt nun immer zusätzlich ein DMG mit der nativen macOS-App.
