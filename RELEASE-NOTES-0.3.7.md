# Apfel-Hafen 0.3.7 (in Entwicklung)

## Speichersicherheit

- Apfel-Hafen führt ein konfigurierbares Gesamtspeicher-Budget ein, das alle
  laufenden Container und die Builder-VM umfasst. Der Standardwert deckt 60 %
  des installierten Arbeitsspeichers ab und lässt macOS sowie weitere
  Anwendungen ausreichend Platz.
- Vor dem Start eines Containers oder eines gesamten Stacks prüft
  Apfel-Hafen verbindlich, ob der verpfändete Speicher zusammen mit der neuen
  Anfrage unter dem Budget bleibt. Andernfalls wird der Start blockiert und
  Budget, verpfändeter Speicher, Anfrage und Differenz werden erklärt.
- Die Technik-Zentrale zeigt das Budget, den verpfändeten und den tatsächlich
  genutzten Speicher.
- Container, die dauerhaft mehr als 85 % ihres Speicherlimits verbrauchen,
  werden gewarnt, bevor der nächste OOM-Abbruch droht.
- Bei kritischem Speicherdruck meldet sich die Betriebskonsole mit konkreten
  Handlungsoptionen, etwa dem Stoppen der größten Verbraucher.

## Dokumentation

- README und Release-Notes erklären das Übercommit-Verhalten von
  Apple-Containern auf macOS 26 (DE/EN): Die CLI lehnt Anfragen ab, die
  physisch nicht gedeckt sind, nicht ab, und macOS gleicht den Mehrbedarf
  über den Swap aus.
