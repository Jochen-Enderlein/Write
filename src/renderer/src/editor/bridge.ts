import type React from 'react'

/**
 * Lets editor node views reach app state without importing the store (keeps the schema usable
 * in headless tests). The app wires the real implementations at startup.
 */
export interface PageEmbed {
  path: string
  title: string
  text: string
}

/** Props of the table a `write-table` block shows; the app supplies the component. */
export interface TableBlockProps {
  /** YAML config of the block (`from`, `columns`, `sort`, `filter`). */
  source: string
  editable: boolean
  onSource(next: string): void
}

export const editorBridge = {
  /** Renders a `write-table` block; set by the app (it needs the store and IPC). */
  TableBlock: ((_props: TableBlockProps) => null) as (props: TableBlockProps) => React.ReactNode,
  /** Follows a link; `beside` (⌘-click) opens it in the other pane. */
  openTitle: (_title: string, _beside?: boolean): void => undefined,
  useTitleExists: (_title: string): boolean => true,
  /** URL of an image embed (`![[Bild.png]]`) relative to the open page, or null. */
  resolveImage: async (_target: string): Promise<string | null> => null,
  /** Text of an embedded page (`![[Seite]]` or `![[Seite#Abschnitt]]`), or null. */
  loadPage: async (_target: string): Promise<PageEmbed | null> => null
}
