/**
 * Lets editor node views reach app state without importing the store (keeps the schema usable
 * in headless tests). The app wires the real implementations at startup.
 */
export interface PageEmbed {
  path: string
  title: string
  text: string
}

export const editorBridge = {
  openTitle: (_title: string): void => undefined,
  useTitleExists: (_title: string): boolean => true,
  /** URL of an image embed (`![[Bild.png]]`) relative to the open page, or null. */
  resolveImage: async (_target: string): Promise<string | null> => null,
  /** Text of an embedded page (`![[Seite]]` or `![[Seite#Abschnitt]]`), or null. */
  loadPage: async (_target: string): Promise<PageEmbed | null> => null
}
