import { createExtension } from '@blocknote/core'
import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { BLOCK_ID_RE } from '@shared/blockrefs'

/** Marks every trailing ` ^id` (a block reference target) so it can be shown quietly. */
function decorate(doc: Node): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (node.type.spec.code) return false
    const text = node.textContent
    const m = BLOCK_ID_RE.exec(text)
    if (m) {
      // Text offsets equal positions as long as no inline atom (link chip, formula) comes after
      // the id, which holds for an id at the very end
      const end = pos + 1 + node.content.size
      const start = end - (m[0].length - (m[0].startsWith('^') ? 0 : 1))
      found.push(Decoration.inline(start, end, { class: 'block-id', title: `^${m[1]}` }))
    }
    return false
  })
  return DecorationSet.create(doc, found)
}

export const blockIds = createExtension({
  key: 'write-block-ids',
  prosemirrorPlugins: [
    new Plugin({
      state: {
        init: (_, state) => decorate(state.doc),
        apply: (tr, set) => (tr.docChanged ? decorate(tr.doc) : set)
      },
      props: {
        decorations(state) {
          return this.getState(state)
        }
      }
    })
  ]
})
