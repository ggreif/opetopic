"use strict";
/**
 * Core data model for opetopes.
 *
 * An opetopic complex is a sequence of bonded atomic diagrams.
 * Each atomic diagram encodes two trees:
 *   - box tree  (containment, the "from above" view)
 *   - edge tree (connectivity, the "from the side" view)
 *
 * The WebCola graph format (nodes/links/groups/constraints) is the
 * rendering target. `toGraph()` converts an AtomicDiagram to that format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toGraph = toGraph;
exports.point = point;
exports.arrow = arrow;
exports.simplex = simplex;
// ── toGraph ──────────────────────────────────────────────────────────────────
/**
 * Convert an AtomicDiagram to a WebCola Graph.
 *
 * Strategy:
 *   - Each unique cell in the edge tree becomes a node.
 *   - Each edge tree edge (parent→child) becomes a link + y-constraint.
 *   - Box tree groupings become groups (leaves + nested groups).
 *
 * We use the edge tree for nodes/links/constraints and the box tree
 * for groups, mirroring the chris.json structure.
 */
function toGraph(diagram) {
    const nodes = [];
    const links = [];
    const groups = [];
    const constraints = [];
    // ── Step 1: collect all cells from edge tree into nodes ──────────────────
    const cellIndex = new Map(); // cell.id → node index
    function collectNodes(tree) {
        if (!cellIndex.has(tree.cell.id)) {
            cellIndex.set(tree.cell.id, nodes.length);
            nodes.push({ name: tree.cell.label, group: tree.cell.dim });
        }
        for (const [, subtree] of tree.children) {
            collectNodes(subtree);
        }
    }
    collectNodes(diagram.edgeRoot);
    // ── Step 2: collect edges from edge tree (deduplicated) ──────────────────
    const seenEdges = new Set();
    function collectEdges(tree) {
        const parentIdx = cellIndex.get(tree.cell.id);
        for (const [, subtree] of tree.children) {
            const childIdx = cellIndex.get(subtree.cell.id);
            const edgeKey = `${childIdx}->${parentIdx}`;
            if (!seenEdges.has(edgeKey)) {
                seenEdges.add(edgeKey);
                links.push({ source: childIdx, target: parentIdx, value: 1 });
                constraints.push({ axis: 'y', left: childIdx, right: parentIdx, gap: 25 });
            }
            collectEdges(subtree);
        }
    }
    collectEdges(diagram.edgeRoot);
    // ── Step 3: box tree → groups (each node in at most one group) ───────────
    const groupedNodes = new Set();
    function collectGroups(tree) {
        const leaves = [];
        const childGroupIndices = [];
        const ownIdx = cellIndex.get(tree.cell.id);
        if (ownIdx !== undefined && !groupedNodes.has(ownIdx)) {
            groupedNodes.add(ownIdx);
            leaves.push(ownIdx);
        }
        for (const [, subtree] of tree.children) {
            const childOwnIdx = cellIndex.get(subtree.cell.id);
            // Only recurse into subtrees whose root cell hasn't been grouped yet
            if (childOwnIdx !== undefined && !groupedNodes.has(childOwnIdx)) {
                const gIdx = collectGroups(subtree);
                childGroupIndices.push(gIdx);
            }
        }
        const gIdx = groups.length;
        groups.push({
            leaves,
            groups: childGroupIndices.length > 0 ? childGroupIndices : undefined,
            padding: 12,
        });
        return gIdx;
    }
    collectGroups(diagram.root);
    return { nodes, links, groups, constraints };
}
// ── Example diagrams ─────────────────────────────────────────────────────────
let _id = 0;
function id(label) { return `${label}_${_id++}`; }
function cell(label, dim) { return { id: id(label), label, dim }; }
function leaf(c) { return { cell: c, children: [] }; }
function node(c, children) { return { cell: c, children }; }
/**
 * A single 0-cell (point). Just one node, no edges.
 */
function point(label = 'x') {
    const x = cell(label, 0);
    const t = leaf(x);
    return { root: t, edgeRoot: t };
}
/**
 * A 1-cell: arrow f: x → y.
 * Edge tree: f at top, x and y as children (source/target).
 */
function arrow(fLabel = 'f', srcLabel = 'x', tgtLabel = 'y') {
    const f = cell(fLabel, 1);
    const x = cell(srcLabel, 0);
    const y = cell(tgtLabel, 0);
    const edgeRoot = node(f, [['src', leaf(x)], ['tgt', leaf(y)]]);
    return { root: edgeRoot, edgeRoot };
}
/**
 * A 2-cell simplex α with:
 *   f: x → y  (left edge)
 *   g: y → z  (right edge)
 *   h: x → z  (bottom edge, target of α)
 *
 * The edge tree for α: α is the root 2-cell.
 * Its boundary consists of the three 1-cells f, g, h arranged as a triangle:
 *   α → f (x→y)
 *   α → g (y→z)
 *   α → h (x→z)  ← target/output edge
 *
 * We model this as: α has children f, g, h; each 1-cell has its endpoint 0-cells.
 * Shared 0-cells (x appears in f and h; y in f and g; z in g and h) are deduplicated
 * by the toGraph() function.
 */
function simplex(alphaLabel = 'α', fLabel = 'f', gLabel = 'g', hLabel = 'h', xLabel = 'x', yLabel = 'y', zLabel = 'z') {
    const alpha = cell(alphaLabel, 2);
    const f = cell(fLabel, 1);
    const g = cell(gLabel, 1);
    const h = cell(hLabel, 1);
    const x = cell(xLabel, 0);
    const y = cell(yLabel, 0);
    const z = cell(zLabel, 0);
    // All six cells (α, f, g, h, x, y, z) share identity by object reference.
    // toGraph deduplicates by cell.id so shared points appear once.
    const edgeRoot = node(alpha, [
        [fLabel, node(f, [['src', leaf(x)], ['tgt', leaf(y)]])],
        [gLabel, node(g, [['src', leaf(y)], ['tgt', leaf(z)]])],
        [hLabel, node(h, [['src', leaf(x)], ['tgt', leaf(z)]])],
    ]);
    return { root: edgeRoot, edgeRoot };
}
//# sourceMappingURL=opetope.js.map