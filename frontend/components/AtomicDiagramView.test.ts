/**
 * DOM snapshot tests for AtomicDiagramView.
 *
 * These tests mount the component directly in jsdom and assert on the rendered
 * SVG structure — element counts, labels, and class presence. This is the
 * primary regression surface: correct *visual* output, not just data model.
 *
 * Run with: npm test
 */

import { render } from '@testing-library/svelte'
import { describe, test, expect } from 'vitest'
import AtomicDiagramView from './AtomicDiagramView.svelte'
import { collectDrops } from '../lib/opetope'
import { Tape } from '../lib/opetope-edsl'

// ── Helpers ──────────────────────────────────────────────────────────────────

function edgeLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<SVGTextElement>('.edge-label')].map(el => el.textContent ?? '')
}

function treeNodeCount(container: HTMLElement): number {
  return container.querySelectorAll('.tree-node').length
}

function dropBoxCount(container: HTMLElement): number {
  return container.querySelectorAll('.box-rect.leaf').length
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Point — single edge-label', () => {
  test('renders one edge-label with text "a"', () => {
    const tape = new Tape().start('point')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    const labels = edgeLabels(container)
    expect(labels).toHaveLength(1)
    expect(labels[0]).toBe('a')
  })
})

describe('Source extrude', () => {
  test('after one extrude on point: two edge-labels', () => {
    const tape = new Tape().start('point').extrude('a')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    // edgeRoot gains one inner node → two labels total (parent + child)
    expect(edgeLabels(container).length).toBeGreaterThanOrEqual(2)
  })

  test('after one extrude on point: at least one tree-node roundrect', () => {
    const tape = new Tape().start('point').extrude('a')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    expect(treeNodeCount(container)).toBeGreaterThanOrEqual(1)
  })
})

describe('Drop insertion', () => {
  test('after extrude + drop: one .box-rect.leaf drop box appears', () => {
    const tape2 = new Tape().start('point').extrude('a').drop('a')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape2.focus,
        drops: collectDrops(tape2.focus.edgeRoot),
      }
    })
    expect(dropBoxCount(container)).toBeGreaterThanOrEqual(1)
  })

  test('after drop on root: one .box-rect.leaf drop box', () => {
    const tape = new Tape().start('point').drop('a')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    expect(dropBoxCount(container)).toBeGreaterThanOrEqual(1)
  })
})

describe('Boxtree', () => {
  test('has .atomic-diagram SVG element', () => {
    const tape = new Tape().start('boxtree')
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    expect(container.querySelector('.atomic-diagram')).toBeTruthy()
  })

  test('boxtree at dim2 has tree-nodes for g, i, u, ⍵', () => {
    const tape = new Tape().start('boxtree').hop(1).hop(1)
    const { container } = render(AtomicDiagramView, {
      props: {
        diagram: tape.focus,
        drops: collectDrops(tape.focus.edgeRoot),
      }
    })
    const labels = edgeLabels(container)
    // dim2 edgeRoot has out2 as root and g□, i□, u□, ⍵□ as children
    expect(labels.some(l => l.includes('g'))).toBe(true)
    expect(labels.some(l => l.includes('i'))).toBe(true)
    expect(labels.some(l => l.includes('u'))).toBe(true)
  })
})

describe('Recorded sequence: point → extrude → 2×drop → encircle', () => {
  // Sequence captured from browser recording session 2026-04-04.
  // Steps: start(point) · extrude(a) · hop(-1) · drop(a) · hop(-1) ·
  //        drop(α) · hop(-1) · encircle([a]) · hop(-1)
  const tape = new Tape()
    .start('point')
    .extrude('a')
    .hop(-1)
    .drop('a')
    .hop(-1)
    .drop('α')
    .hop(-1)
    .encircle(['a'])
    .hop(-1)

  test('tape is valid after full sequence', () => {
    expect(tape.validate()).toBeNull()
  })

  test('two drop boxes (.box-rect.leaf) present', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(dropBoxCount(container)).toBe(2)
  })

  test('encircle produced one intermediate box-rect (non-leaf)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    // outer frame + intermediate wrapper = 2 non-leaf box-rects
    const nonLeaf = container.querySelectorAll('.box-rect:not(.leaf)')
    expect(nonLeaf).toHaveLength(2)
  })

  test('both edge-labels α and a are present', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    const labels = edgeLabels(container)
    expect(labels).toContain('α')
    expect(labels).toContain('a')
  })
})

describe('Recorded sequence: point → bareDrop → 2×drop', () => {
  // Sequence captured from browser recording session 2026-04-07.
  // Steps: start(point) · bareDrop · hop(-1) · drop(a) · hop(-1) · drop(a) · hop(-1)
  // (hop(-1) steps are spurious no-ops fired by the $effect when store.diagrams changes)
  const tape = new Tape()
    .start('point')
    .bareDrop()
    .hop(-1)
    .drop('a')
    .hop(-1)
    .drop('a')
    .hop(-1)

  test('tape is valid after full sequence', () => {
    expect(tape.validate()).toBeNull()
  })

  test('after bareDrop only: root is a bare-drop lollipop (no children)', () => {
    const t = new Tape().start('point').bareDrop()
    const root = t.focus.root
    expect(root).not.toBeNull()
    expect(root!.children).toEqual([])  // lollipop: children = []
    expect(t.focus.edgeRoot.drops).toHaveLength(0)  // no bonds to edgeRoot
  })

  test('after bareDrop only: bare-drop-box glyph present, no ordinary drop boxes', () => {
    const t = new Tape().start('point').bareDrop()
    const { container } = render(AtomicDiagramView, {
      props: { diagram: t.focus, drops: collectDrops(t.focus.edgeRoot) }
    })
    expect(container.querySelectorAll('.bare-drop-box')).toHaveLength(1)
    expect(dropBoxCount(container)).toBe(1)  // bare-drop-box itself is .box-rect.leaf
  })

  test('after full sequence: two drop boxes', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(dropBoxCount(container)).toBe(2)
  })

  test('after full sequence: root has two lollipop children', () => {
    const root = tape.focus.root
    expect(root).not.toBeNull()
    expect(root!.children).toHaveLength(2)
    root!.children!.forEach(([, child]) => expect(child.children).toEqual([]))
  })

  test('after full sequence: edgeRoot carries two drops', () => {
    expect(tape.focus.edgeRoot.drops).toHaveLength(2)
  })
})

describe('Succ at intermediate steps: bareDrop → drop → drop', () => {
  // After hop(1) the tape stores computeSucc(root) as the next level's edgeRoot.
  // We read tape.focus.edgeRoot directly — no need to call computeSucc manually.
  //   bareDrop + hop  → lollipop (0 children) → 1 edge-label in DOM
  //   + 1 drop + hop  → inner node with 1 lollipop child → 2 edge-labels
  //   + 2 drops + hop → inner node with 2 lollipop children → 3 edge-labels

  const t0 = new Tape().start('point').bareDrop().hop(1)
  const t1 = new Tape().start('point').bareDrop().hop(-1).drop('a').hop(1)
  const t2 = new Tape().start('point').bareDrop().hop(-1).drop('a').hop(-1).drop('a').hop(1)

  test('after bareDrop + hop: Succ edgeRoot is a lollipop (0 children)', () => {
    expect(t0.focus.edgeRoot.children).toEqual([])
  })

  test('after bareDrop + hop: Succ DOM renders 1 edge-label', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: t0.focus, drops: collectDrops(t0.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(1)
  })

  test('after bareDrop + 1 drop + hop: Succ edgeRoot has 1 lollipop child', () => {
    expect(t1.focus.edgeRoot.children).toHaveLength(1)
    expect(t1.focus.edgeRoot.children![0][1].children).toEqual([])
  })

  test('after bareDrop + 1 drop + hop: Succ DOM renders 2 edge-labels (root + 1 child)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: t1.focus, drops: collectDrops(t1.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(2)
  })

  test('after bareDrop + 2 drops + hop: Succ edgeRoot has 2 lollipop children', () => {
    expect(t2.focus.edgeRoot.children).toHaveLength(2)
    t2.focus.edgeRoot.children!.forEach(([, c]) => expect(c.children).toEqual([]))
  })

  test('after bareDrop + 2 drops + hop: Succ DOM renders 3 edge-labels (root + 2 children)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: t2.focus, drops: collectDrops(t2.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(3)
  })
})

describe('Recorded sequence: point → bareDrop → 2×drop → hop(1)', () => {
  // At level 1: edgeRoot = stored computeSucc(root) = node(α, [(b1,lollipop(β)), (b2,lollipop(γ))])
  const tape = new Tape()
    .start('point')
    .bareDrop()
    .hop(-1)
    .drop('a')
    .hop(-1)
    .drop('a')
    .hop(-1)
    .hop(1)

  test('tape is valid at level 1', () => {
    expect(tape.validate()).toBeNull()
  })

  test('level 1 edgeRoot root (α) has two lollipop children (β and γ)', () => {
    const edgeRoot = tape.focus.edgeRoot
    expect(edgeRoot.children).toHaveLength(2)
    edgeRoot.children!.forEach(([, child]) => expect(child.children).toEqual([]))
  })

  test('three tree-nodes in level 1 Focus: α (inner) + β and γ (lollipops)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(treeNodeCount(container)).toBe(3)
  })
})

describe('Recorded sequence: point → bareDrop → 2×drop → hop(1) → hop(1)', () => {
  // Level 2 edgeRoot is stored in the tape after the second hop — no manual computeSucc needed.
  // withOuterFrame at level 1 creates substrate leaves for ALL corolla nodes:
  // α (inner) + β (lollipop) + γ (lollipop) → 3 children in level 1 root →
  // 3 open branches in level 2 edgeRoot.
  const tape = new Tape()
    .start('point')
    .bareDrop()
    .hop(-1)
    .drop('a')
    .hop(-1)
    .drop('a')
    .hop(-1)
    .hop(1)
    .hop(1)

  test('tape is valid at level 2', () => {
    expect(tape.validate()).toBeNull()
  })

  test('level 2 edgeRoot has 3 open children (substrates for α, β, γ)', () => {
    const edgeRoot = tape.focus.edgeRoot
    expect(edgeRoot.children).toHaveLength(3)
    edgeRoot.children!.forEach(([, child]) => expect(child.children).toBeNull())
  })

  test('level 2 Succ renders 4 edge-labels (root + 3 open children)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(4)
  })
})

describe('Recorded sequence: point → bareDrop → hop(1)', () => {
  // Recording 2026-04-07: start(point) · bareDrop · hop(1)  [hop(-1) was spurious no-op]
  // Focus invariant: there must always be a box in Focus after a hop.
  // A lollipop edgeRoot needs a base box created on arrival.
  const tape = new Tape().start('point').bareDrop().hop(1)

  test('tape is valid (no advisory)', () => {
    expect(tape.validate()).toBeNull()
  })

  test('level 1 edgeRoot is the bareDrop lollipop (0 children)', () => {
    expect(tape.focus.edgeRoot.children).toEqual([])
  })

  test('level 1 root is a base box (not null) — invariant: Focus always has a box', () => {
    expect(tape.focus.root).not.toBeNull()
    expect(tape.focus.root!.children).toHaveLength(1)  // one substrate leaf for the lollipop
  })

  test('level 1 DOM renders 1 edge-label (the lollipop)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(1)
  })
})

describe('bareDrop example: Succ via store (no hop)', () => {
  // tape.succDiagram reads diagrams[focusIdx+1] directly, mirroring store.succDiagram.
  // The Succ of a bare lollipop is itself a lollipop — 1 node, 1 edge-label.
  const tape = new Tape().start('bareDrop')

  test('succDiagram exists without hopping', () => {
    expect(tape.succDiagram).toBeDefined()
  })

  test('succDiagram edgeRoot is a lollipop (1 node, 0 children)', () => {
    expect(tape.succDiagram!.edgeRoot.children).toEqual([])
  })

  test('succDiagram root is a base box (stored with proper root; Succ pane strips it for preview)', () => {
    expect(tape.succDiagram!.root).not.toBeNull()
  })

  test('Succ DOM renders 1 edge-label', () => {
    const succ = tape.succDiagram!
    const { container } = render(AtomicDiagramView, {
      props: { diagram: succ, drops: collectDrops(succ.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(1)
  })
})

describe('bareDrop example: hop(1) arrives with base box', () => {
  // start('bareDrop') pre-builds diagrams[1] with a proper root.
  // hop(1) just increments focusIdx — no root=null transient ever exists.
  const tape = new Tape().start('bareDrop').hop(1)

  test('tape is valid after hop', () => {
    expect(tape.validate()).toBeNull()
  })

  test('level 1 edgeRoot is the lollipop f', () => {
    expect(tape.focus.edgeRoot.children).toEqual([])
  })

  test('level 1 root is a base box (non-null) on arrival', () => {
    expect(tape.focus.root).not.toBeNull()
    expect(tape.focus.root!.children).toHaveLength(1)
  })
})

describe('Ypsilon: drop on source node + hop(1) — mixed lollipop/leaf siblings valid', () => {
  // Recording 2026-04-07: start(ypsilon) · drop('1') · hop(1)
  // Previously triggered rule 1.3 (edgeroot-no-lollipop — now removed):
  // level-1 edgeRoot has node f with children a (leaf), b (leaf), γ (lollipop).
  // Mixed siblings (open leaves + lollipop) must be valid — Succ renders fine.
  const tape = new Tape().start('ypsilon').drop('1').hop(1)

  test('tape is valid after drop + hop (rule 1.3 removed)', () => {
    expect(tape.validate()).toBeNull()
  })

  test('level-1 edgeRoot (f) has 3 children', () => {
    expect(tape.focus.edgeRoot.children).toHaveLength(3)
  })

  test('two children are open leaves, one is a lollipop', () => {
    const children = tape.focus.edgeRoot.children!.map(([, c]) => c)
    const leaves   = children.filter(c => c.children === null)
    const lollipops = children.filter(c => c.children !== null && c.children.length === 0)
    expect(leaves).toHaveLength(2)
    expect(lollipops).toHaveLength(1)
  })

  test('level-1 DOM renders 4 edge-labels (f + a + b + γ)', () => {
    const { container } = render(AtomicDiagramView, {
      props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) }
    })
    expect(edgeLabels(container)).toHaveLength(4)
  })
})

describe('Validation: Tape.validate()', () => {
  test('fresh boxtree is valid', () => {
    const tape = new Tape().start('boxtree')
    expect(tape.validate()).toBeNull()
  })

  test('point after extrude is valid', () => {
    const tape = new Tape().start('point').extrude('a')
    expect(tape.validate()).toBeNull()
  })
})
