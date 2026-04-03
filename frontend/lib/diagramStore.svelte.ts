/**
 * Global reactive store for the opetope diagram sequence.
 *
 * An opetope is a sequence of bonded AtomicDiagrams where the invariant
 *   diagrams[i+1].edgeRoot === computeSucc(diagrams[i].root)
 * is established by hopRight() and preserved by updateFocusDiagram() via truncation.
 *
 * Svelte 5 requires $state/$derived in module scope to be class fields.
 */

import { computeSucc, type AtomicDiagram } from './opetope'

class DiagramStore {
  diagrams = $state<AtomicDiagram[]>([])
  focusIdx = $state<number>(0)

  get focus()       { return this.diagrams[this.focusIdx] }
  get succDiagram() { return this.diagrams[this.focusIdx + 1] ?? null }
  get canHopRight() { return this.focus?.root != null }

  hopLeft() {
    if (this.focusIdx > 0) this.focusIdx--
  }

  hopRight() {
    if (!this.focus?.root) return
    if (this.focusIdx + 1 < this.diagrams.length) {
      this.focusIdx++
    } else {
      const newEdgeRoot = computeSucc(this.focus.root)
      this.diagrams = [...this.diagrams, { edgeRoot: newEdgeRoot, root: null }]
      this.focusIdx++
    }
  }

  updateFocusDiagram(next: AtomicDiagram) {
    // Truncate higher levels — they depend on this level's root and must be rebuilt.
    this.diagrams = [...this.diagrams.slice(0, this.focusIdx), next]
  }

  resetTo(diagram: AtomicDiagram) {
    this.diagrams = [diagram]
    this.focusIdx = 0
  }
}

export const store = new DiagramStore()
