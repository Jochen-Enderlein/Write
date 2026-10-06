/**
 * Stands in for `elkjs` in the build. ELK is licensed EPL-2.0 without the GPL as a secondary
 * license, so it can't ship inside Write (GPL-3.0). Mermaid only uses it for the optional
 * `layout: elk`; every diagram on the default layout is unaffected. Such a diagram shows this
 * message instead of a broken render.
 */
export default class ELK {
  layout(): Promise<never> {
    return Promise.reject(
      new Error(
        'Das ELK-Layout ist in Write nicht enthalten. Ohne „layout: elk“ funktioniert das Diagramm.'
      )
    )
  }

  knownLayoutAlgorithms(): Promise<never[]> {
    return Promise.resolve([])
  }

  knownLayoutOptions(): Promise<never[]> {
    return Promise.resolve([])
  }

  knownLayoutCategories(): Promise<never[]> {
    return Promise.resolve([])
  }

  terminateWorker(): void {}
}
