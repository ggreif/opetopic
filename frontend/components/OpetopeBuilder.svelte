<script lang="ts">
  import OpetopeEditor from './OpetopeEditor.svelte'
  import { simplex, arrow, point, boxtree, type AtomicDiagram } from '../lib/opetope'

  // Start with the boxtree as the focus diagram
  let focus = $state<AtomicDiagram>(boxtree())

  // Example gallery switcher
  const examples: { label: string; make: () => AtomicDiagram }[] = [
    { label: 'Boxtree',          make: () => boxtree() },
    { label: 'Simplex (2-cell)', make: () => simplex() },
    { label: 'Arrow (1-cell)',   make: () => arrow() },
    { label: 'Point (0-cell)',   make: () => point() },
  ]

  function loadExample(make: () => AtomicDiagram) {
    focus = make()
  }
</script>

<section class="builder">
  <h2>Opetope Builder <span class="badge">experimental</span></h2>
  <p class="desc">
    Left: box/containment view (nested rectangles). Right: edge/tree view (directed graph).
    The label on each box corresponds to the branch label on the tree — this is the bond.
  </p>

  <div class="toolbar">
    <span class="toolbar-label">Examples:</span>
    {#each examples as ex}
      <button class="ex-btn" onclick={() => loadExample(ex.make)}>{ex.label}</button>
    {/each}
  </div>

  <OpetopeEditor {focus} />
</section>

<style>
  .builder {
    padding: 24px 40px 40px;
    max-width: 1200px;
  }

  h2 {
    font-size: 1.4em;
    margin-bottom: 6px;
    color: #333;
  }

  .badge {
    font-size: 0.5em;
    background: #f3e5f5;
    color: #7b1fa2;
    padding: 2px 8px;
    border-radius: 4px;
    vertical-align: middle;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .desc {
    color: #666;
    font-size: 0.9em;
    margin-bottom: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .toolbar-label {
    font-size: 0.85em;
    color: #888;
    font-weight: 600;
  }

  .ex-btn {
    padding: 5px 14px;
    border: 1px solid #bbb;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 0.85em;
    transition: background 0.15s, border-color 0.15s;
  }

  .ex-btn:hover {
    background: #f3e5f5;
    border-color: #a02480;
    color: #a02480;
  }
</style>
