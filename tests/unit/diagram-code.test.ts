import { describe, expect, it } from 'vitest'
import {
  addActivity,
  addClass,
  addClassMember,
  addClassRelation,
  addEntity,
  addEntityAttribute,
  addFlow,
  addMessage,
  addParticipant,
  addRelationship,
  addSequenceNote,
  addState,
  addStateEnd,
  addStateNote,
  addTransition,
  diagramType,
  freeName,
  nodeNameFromId,
  startDiagram
} from '@renderer/editor/diagram/code'

describe('Diagrammart erkennen', () => {
  it('erkennt alle UML-Arten an der ersten Zeile, auch nach Kommentaren', () => {
    expect(diagramType('classDiagram\n  class A')).toBe('class')
    expect(diagramType('\n%% Entwurf\nsequenceDiagram')).toBe('sequence')
    expect(diagramType('stateDiagram-v2')).toBe('state')
    expect(diagramType('graph LR\n  A --> B')).toBe('activity')
    expect(diagramType('flowchart TD')).toBe('activity')
    expect(diagramType('erDiagram')).toBe('er')
  })

  it('kennt andere Diagramme und leeren Code nicht', () => {
    expect(diagramType('pie title Anteile')).toBeNull()
    expect(diagramType('')).toBeNull()
  })

  it('beginnt ein neues Diagramm nur, wenn der Code noch keins ist', () => {
    expect(startDiagram('', 'sequence')).toBe('sequenceDiagram')
    expect(startDiagram('classDiagram\n  class A', 'state')).toBe('classDiagram\n  class A')
  })

  it('liest Namen aus den Knoten-Ids von Mermaid', () => {
    expect(nodeNameFromId('class', 'mermaid-1-classId-Lauf_Ding-2')).toBe('Lauf_Ding')
    expect(nodeNameFromId('state', 'mermaid-2-state-Offen-1')).toBe('Offen')
    expect(nodeNameFromId('state', 'mermaid-2-state-root_start-0')).toBe('[*]')
    expect(nodeNameFromId('state', 'mermaid-2-state-root_end-2')).toBe('[*]')
    expect(nodeNameFromId('activity', 'mermaid-1-flowchart-a1-1')).toBe('a1')
    expect(nodeNameFromId('er', 'mermaid-4-entity-KUNDE-0')).toBe('KUNDE')
    expect(nodeNameFromId('class', 'mermaid-1-edge-3')).toBeNull()
  })

  it('vergibt freie Namen', () => {
    expect(freeName('classDiagram\n  class Klasse\n  class Klasse2', 'Klasse')).toBe('Klasse3')
    expect(freeName('', 'Aufzählung')).toBe('Aufzahlung')
    expect(freeName('', '1Teil')).toBe('N1Teil')
  })
})

describe('Klassendiagramm', () => {
  it('hängt Klassen mit der Einrückung des Diagramms an, Interfaces mit Kennzeichnung', () => {
    expect(addClass('classDiagram\n    class Kunde', 'class', 'Klasse')).toBe(
      'classDiagram\n    class Kunde\n    class Klasse'
    )
    expect(addClass('', 'interface', 'Interface')).toBe(
      'classDiagram\n  class Interface {\n    <<interface>>\n  }'
    )
  })

  it('fügt Attribute in den Körper ein und legt ihn bei Bedarf an', () => {
    const src = 'classDiagram\n  class Tier {\n      +name: String\n  }\n  Tier <|-- Hund'
    expect(addClassMember(src, 'Tier', '+laut()')).toBe(
      'classDiagram\n  class Tier {\n      +name: String\n      +laut()\n  }\n  Tier <|-- Hund'
    )
    expect(addClassMember('classDiagram\n  class Hund', 'Hund', '+bellen()')).toBe(
      'classDiagram\n  class Hund {\n    +bellen()\n  }'
    )
    expect(addClassMember('classDiagram\n  Tier <|-- Hund', 'Tier', '+x')).toBe(
      'classDiagram\n  Tier <|-- Hund\n  class Tier {\n    +x\n  }'
    )
  })

  it('verwechselt keine Klassen mit gleichem Anfang', () => {
    expect(addClassMember('classDiagram\n  class Hundehalter\n  class Hund', 'Hund', '+x')).toBe(
      'classDiagram\n  class Hundehalter\n  class Hund {\n    +x\n  }'
    )
  })

  it('zeichnet Beziehungen in Zugrichtung, Vererbung zur Oberklasse', () => {
    const src = 'classDiagram\n  class Tier\n  class Hund'
    expect(addClassRelation(src, 'Hund', 'Tier', 'inheritance')).toBe(`${src}\n  Tier <|-- Hund`)
    expect(addClassRelation(src, 'Hund', 'Tier', 'realization')).toContain('Tier <|.. Hund')
    expect(addClassRelation(src, 'Tier', 'Hund', 'composition')).toContain('Tier *-- Hund')
    expect(addClassRelation(src, 'Tier', 'Tier', 'association')).toBe(src)
  })
})

describe('Sequenzdiagramm', () => {
  it('legt Teilnehmer und Akteure an', () => {
    expect(addParticipant('', 'actor', 'Akteur')).toBe('sequenceDiagram\n  actor Akteur')
    expect(addParticipant('sequenceDiagram\n  actor Akteur', 'participant', 'Akteur')).toBe(
      'sequenceDiagram\n  actor Akteur\n  participant Akteur2'
    )
  })

  it('schreibt Nachrichten mit dem passenden Pfeil, auch an sich selbst', () => {
    const src = 'sequenceDiagram\n  actor A\n  participant B'
    expect(addMessage(src, 'A', 'B', 'sync', 'bestellen')).toBe(`${src}\n  A->>B: bestellen`)
    expect(addMessage(src, 'B', 'A', 'reply', 'ok')).toContain('B-->>A: ok')
    expect(addMessage(src, 'A', 'B', 'async', 'info')).toContain('A-)B: info')
    expect(addMessage(src, 'B', 'B', 'sync', 'prüfen')).toContain('B->>B: prüfen')
  })

  it('setzt Notizen neben einen Teilnehmer', () => {
    expect(addSequenceNote('sequenceDiagram\n  actor A', 'A', 'Hinweis')).toContain(
      'Note right of A: Hinweis'
    )
  })
})

describe('Zustandsdiagramm', () => {
  it('legt Zustände und Pseudozustände an', () => {
    expect(addState('', 'state', 'Zustand')).toBe('stateDiagram-v2\n  Zustand')
    expect(addState('stateDiagram-v2', 'choice', 'Auswahl')).toContain('state Auswahl <<choice>>')
  })

  it('markiert Start und Ende und verbindet Zustände', () => {
    const src = 'stateDiagram-v2\n  Offen\n  Bezahlt'
    expect(addStateEnd(src, 'Offen', 'start')).toBe(`${src}\n  [*] --> Offen`)
    expect(addStateEnd(src, 'Bezahlt', 'end')).toContain('Bezahlt --> [*]')
    expect(addTransition(src, 'Offen', 'Bezahlt')).toContain('Offen --> Bezahlt')
    expect(addTransition(src, '[*]', 'Offen')).toContain('[*] --> Offen')
    expect(addTransition(src, '[*]', '[*]')).toBe(src)
    expect(addStateNote(src, 'Offen', 'wartet')).toContain('note right of Offen : wartet')
  })
})

describe('Aktivitätsdiagramm', () => {
  it('legt Knoten in ihrer Form mit Beschriftung an', () => {
    expect(addActivity('', 'action', 'aktion', 'Prüfen')).toBe('flowchart TD\n  aktion("Prüfen")')
    expect(addActivity('flowchart TD', 'decision', 'frage', 'OK?')).toContain('frage{"OK?"}')
    expect(addActivity('flowchart TD', 'start', 'start', 'Start')).toContain('start(("Start"))')
    expect(addActivity('flowchart TD', 'end', 'ende', 'Ende')).toContain('ende((("Ende")))')
  })

  it('verbindet Knoten mit der gewählten Linie', () => {
    const src = 'flowchart TD\n  a("A")\n  b("B")'
    expect(addFlow(src, 'a', 'b', 'arrow')).toBe(`${src}\n  a --> b`)
    expect(addFlow(src, 'a', 'b', 'dotted')).toContain('a -.-> b')
    expect(addFlow(src, 'a', 'a', 'arrow')).toBe(src)
  })
})

describe('ER-Diagramm', () => {
  it('legt Entitäten mit erstem Attribut an und ergänzt weitere', () => {
    const src = addEntity('', 'KUNDE', 'string id')
    expect(src).toBe('erDiagram\n  KUNDE {\n    string id\n  }')
    expect(addEntityAttribute(src, 'KUNDE', 'string name')).toBe(
      'erDiagram\n  KUNDE {\n    string id\n    string name\n  }'
    )
  })

  it('schreibt Beziehungen mit Kardinalität und Beschriftung', () => {
    const src = 'erDiagram\n  KUNDE {\n    string id\n  }'
    expect(addRelationship(src, 'KUNDE', 'BESTELLUNG', 'one-many', 'gibt')).toContain(
      'KUNDE ||--o{ BESTELLUNG : gibt'
    )
    expect(addRelationship(src, 'A', 'B', 'many-many', 'gehört zu')).toContain(
      'A }o--o{ B : "gehört zu"'
    )
  })
})
