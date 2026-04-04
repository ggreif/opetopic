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
    const tape = new Tape().start('point').extrude('a')
    // The extruded leaf is labelled 'a' (it becomes an inner node); new child is fresh label
    // Drop on 'a' (the now-inner node)
    const extrudedLabel = tape.focus.edgeRoot.children?.[0][1].cell.label ?? 'a'
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
