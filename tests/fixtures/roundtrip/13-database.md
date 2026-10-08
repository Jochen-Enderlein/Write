---
title: Projekte
status: aktiv # Kommentar bleibt
fällig: 2026-10-20
fertig: false
kunden: [Acme, "Beta GmbH"]
---
# Projekte

Alle offenen Projekte:

```write-table
from: Projekte
columns: [status, fällig]
sort: [{ key: fällig, dir: asc }]
filter:
  - key: status
    op: isNot
    value: erledigt
```

Und die eigenen Unterseiten:

```write-table
```

Ende.
