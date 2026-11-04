import { describe, expect, it } from 'vitest'
import {
  addClass,
  addMember,
  addRelation,
  classNameFromNodeId,
  freeName,
  isClassDiagram
} from '@renderer/editor/umlCode'

describe('Klassendiagramm erkennen', () => {
  it('erkennt classDiagram auch nach Kommentaren und Leerzeilen', () => {
    expect(isClassDiagram('classDiagram\n  class A')).toBe(true)
    expect(isClassDiagram('\n%% Entwurf\nclassDiagram-v2')).toBe(true)
  })

  it('hält andere Diagramme und leeren Code nicht dafür', () => {
    expect(isClassDiagram('graph TD\n  A --> B')).toBe(false)
    expect(isClassDiagram('')).toBe(false)
  })

  it('liest den Klassennamen aus der Knoten-Id von Mermaid', () => {
    expect(classNameFromNodeId('mermaid-1-classId-Lauf_Ding-2')).toBe('Lauf_Ding')
    expect(classNameFromNodeId('mermaid-1-edge-3')).toBeNull()
  })
})

describe('Klassen anlegen', () => {
  it('vergibt einen freien Namen', () => {
    expect(freeName('classDiagram\n  class Klasse\n  class Klasse2', 'Klasse')).toBe('Klasse3')
    expect(freeName('classDiagram', 'Aufzählung')).toBe('Aufzahlung')
    expect(freeName('', '1Teil')).toBe('C1Teil')
  })

  it('hängt eine Klasse mit der Einrückung des Diagramms an', () => {
    const { source, name } = addClass('classDiagram\n    class Kunde', 'class', 'Klasse')
    expect(name).toBe('Klasse')
    expect(source).toBe('classDiagram\n    class Kunde\n    class Klasse')
  })

  it('schreibt Interfaces und abstrakte Klassen mit ihrer Kennzeichnung', () => {
    expect(addClass('classDiagram', 'interface', 'Interface').source).toBe(
      'classDiagram\n  class Interface {\n    <<interface>>\n  }'
    )
    expect(addClass('classDiagram', 'enum', 'Farbe').source).toContain('<<enumeration>>')
  })

  it('beginnt leeren Code mit classDiagram', () => {
    expect(addClass('', 'class', 'Klasse').source).toBe('classDiagram\n  class Klasse')
  })
})

describe('Attribute und Methoden', () => {
  it('fügt in den vorhandenen Klassenkörper ein, mit dessen Einrückung', () => {
    const src = 'classDiagram\n  class Tier {\n      +name: String\n  }\n  Tier <|-- Hund'
    expect(addMember(src, 'Tier', '+laut()')).toBe(
      'classDiagram\n  class Tier {\n      +name: String\n      +laut()\n  }\n  Tier <|-- Hund'
    )
  })

  it('gibt einer Klasse ohne Körper einen', () => {
    expect(addMember('classDiagram\n  class Hund\n  Tier <|-- Hund', 'Hund', '+bellen()')).toBe(
      'classDiagram\n  class Hund {\n    +bellen()\n  }\n  Tier <|-- Hund'
    )
  })

  it('legt einen Körper an, wenn die Klasse nur in Beziehungen vorkommt', () => {
    expect(addMember('classDiagram\n  Tier <|-- Hund', 'Tier', '+name: String')).toBe(
      'classDiagram\n  Tier <|-- Hund\n  class Tier {\n    +name: String\n  }'
    )
  })

  it('verwechselt keine Klassen mit gleichem Anfang', () => {
    const src = 'classDiagram\n  class Hundehalter\n  class Hund'
    expect(addMember(src, 'Hund', '+x')).toBe(
      'classDiagram\n  class Hundehalter\n  class Hund {\n    +x\n  }'
    )
  })
})

describe('Beziehungen', () => {
  const src = 'classDiagram\n  class Tier\n  class Hund'

  it('zeichnet Vererbung von der Unterklasse zur Oberklasse', () => {
    expect(addRelation(src, 'Hund', 'Tier', 'inheritance')).toBe(`${src}\n  Tier <|-- Hund`)
    expect(addRelation(src, 'Hund', 'Tier', 'realization')).toBe(`${src}\n  Tier <|.. Hund`)
  })

  it('zeichnet Assoziation, Abhängigkeit, Aggregation und Komposition in Zugrichtung', () => {
    expect(addRelation(src, 'Tier', 'Hund', 'association')).toContain('Tier --> Hund')
    expect(addRelation(src, 'Tier', 'Hund', 'dependency')).toContain('Tier ..> Hund')
    expect(addRelation(src, 'Tier', 'Hund', 'aggregation')).toContain('Tier o-- Hund')
    expect(addRelation(src, 'Tier', 'Hund', 'composition')).toContain('Tier *-- Hund')
  })

  it('verbindet eine Klasse nicht mit sich selbst', () => {
    expect(addRelation(src, 'Tier', 'Tier', 'association')).toBe(src)
  })
})
