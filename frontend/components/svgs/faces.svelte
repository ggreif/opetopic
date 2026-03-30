<script lang="ts">
  // Face highlighting for the 5-dimensional opetope.
  // Hovering any box transitively highlights all faces (via reverseBond):
  //   edges:    corresponding edge segment(s) in the next atomic diagram (the bond)
  //   cells:    directly contained boxes, derived via inverse bond lookup
  const MOSS  = '#6a9153'
  const BLACK = '#000000'

  // Inverse bond: path id → rect id it bonds to (one column to the left)
  const reverseBond = {
    // Col 0 ← paths in g3393
    path3415: 'rect3371', path3419: 'rect3377', path3423: 'rect3383', path3427: 'rect3389',
    path3485: 'rect3409',
    // Col 1 ← paths in g3447
    path3469: 'rect3397', path3473: 'rect3403',
    path3477: 'rect3437', path3481: 'rect3431', path3489: 'rect3443',
    // Col 2 ← paths in g3509
    path3531: 'rect3451', path3535: 'rect3457', path3539: 'rect3493',
    path3543: 'rect3499', path3547: 'rect3463', path3551: 'rect3505',
    // Col 3 ← paths in g3571
    path3581: 'rect3513', path3585: 'rect3525', path3589: 'rect3561',
    path3593: 'rect3519', path3597: 'rect3555', path3601: 'rect3567',
    // Col 4 ← paths in g3621
    path3625: 'rect3575', path3629: 'rect3611', path3633: 'rect3605', path3637: 'rect3617',
  }


  type Entry = { edges: string[] }
  const faceMap: Record<string, Entry> = {
    // Col 0 (g3367) — leaf cells, no faces to show
    // rect3371: { edges: [] },
    // rect3377: { edges: [] },
    // rect3383: { edges: [] },
    // rect3389: { edges: [] },

    // Col 1 (g3393) → bond to paths in g3447
    // rect3397: { edges: [] },  // root box
    rect3403: { edges: ['path3415', 'path3423'] },
    rect3409: { edges: ['path3423'] },
    rect3431: { edges: ['path3415', 'path3419'] },
    rect3437: { edges: ['path3419', 'path3423'] },
    rect3443: { edges: ['path3423', 'path3427'] },

    // Col 2 (g3447) → bond to paths in g3509
    // rect3451: { edges: [] },  // root box
    // rect3457: { edges: [...] },  // interposer (same boundary as rect3493)
    // rect3463: { edges: [...] },  // interposer (same boundary as rect3505)
    rect3493: { edges: ['path3469', 'path3489', 'path3485', 'path3473'] },
    rect3499: { edges: ['path3473', 'path3481', 'path3477'] },
    rect3505: { edges: ['path3485'] },

    // Col 3 (g3509) → bond to paths in g3571
    // rect3513: { edges: [] },  // root box
    // rect3519: { edges: [...] },  // interposer (same boundary as rect3555)
    // rect3525: { edges: [...] },  // interposer (same boundary as rect3561)
    // rect3555 bonds to the x=0 edge, which is split into two segments by rect3617
    rect3555: { edges: ['path3531', 'path3547', 'path3543', 'path3535'] },
    rect3561: { edges: ['path3535', 'path3539'] },
    rect3567: { edges: ['path3547', 'path3551'] },

    // Col 4 (g3571) → bond to paths in g3621
    // rect3575: { edges: [] },  // root box
    rect3617: { edges: ['path3593', 'path3597'] },  // left
    rect3611: { edges: ['path3585', 'path3589'] },  // right
    rect3605: { edges: ['path3581', 'path3601', 'path3593', 'path3585'] },  // middle

    // Col 5 — trivial final box; its faces are the 4 corolla edges + the 4 col-4 boxes they bond to
    rect3641: { edges: ['path3625', 'path3629', 'path3633', 'path3637'] },
  }

  let svgEl = $state<SVGSVGElement | undefined>(undefined)
  let hoveredBox = $state<string | null>(null)
  let optionHeld = $state(false)

  $effect(() => {
    const down = (e: KeyboardEvent) => { if (e.altKey) { optionHeld = true; applyHighlight(hoveredBox) } }
    const up   = (e: KeyboardEvent) => { if (!e.altKey) { optionHeld = false; applyHighlight(hoveredBox) } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })

  function applyHighlight(id: string | null) {
    if (!svgEl) return
    const bg = (optionHeld && id) ? 'none' : BLACK
    svgEl!.querySelectorAll<SVGElement>('rect[id], path[id]').forEach(el => {
      el.style.stroke = bg
    })
    svgEl!.querySelectorAll<SVGElement>('path[id]').forEach(el => {
      el.style.strokeWidth = '100'
    })
    if (!id) return
    const entry = faceMap[id]
    if (!entry) return
    const hovered = svgEl!.querySelector<SVGElement>(`#${id}`)
    if (hovered) hovered.style.stroke = MOSS
    // Transitively highlight all faces via reverseBond
    const queue: string[] = [id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      const e = faceMap[cur]
      if (!e) continue
      const cells = e.edges.map(e => reverseBond[e as keyof typeof reverseBond])
      if (!optionHeld) e.edges.forEach(eid => {
        const el = svgEl!.querySelector<SVGElement>(`#${eid}`)
        if (el) { el.style.stroke = MOSS; el.style.strokeWidth = '50' }
      })
      cells.forEach(cid => {
        const el = svgEl!.querySelector<SVGElement>(`#${cid}`)
        if (el) el.style.stroke = MOSS
        queue.push(cid)
      })
    }
  }

  $effect(() => { applyHighlight(hoveredBox) })

  // Wire hover on all known box rects via DOM after mount
  $effect(() => {
    if (!svgEl) return
    Object.keys(faceMap).filter(id => id.startsWith('rect')).forEach(id => {
      const el = svgEl!.querySelector<SVGElement>(`#${id}`)
      if (!el) return
      el.style.cursor = 'crosshair'
      el.addEventListener('mouseenter', () => { hoveredBox = id })
      el.addEventListener('mouseleave', () => { hoveredBox = null })
    })
  })
</script>

<svg
   bind:this={svgEl}
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="719.78815"
   height="251.60001"
   viewBox="0 -15000 34045.979 12580"
   id="svg3365"
   version="1.1"
   inkscape:version="0.48.4 r9939"
   sodipodi:docname="opetope.svg">
  <metadata
     id="metadata3649">
    <rdf:RDF>
      <cc:Work
         rdf:about="">
        <dc:format>image/svg+xml</dc:format>
        <dc:type
           rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
      </cc:Work>
    </rdf:RDF>
  </metadata>
  <defs
     id="defs3647" />
  <sodipodi:namedview
     pagecolor="#ffffff"
     bordercolor="#666666"
     borderopacity="1"
     objecttolerance="10"
     gridtolerance="10"
     guidetolerance="10"
     inkscape:pageopacity="0"
     inkscape:pageshadow="2"
     inkscape:window-width="1855"
     inkscape:window-height="1056"
     id="namedview3645"
     showgrid="false"
     fit-margin-top="5"
     fit-margin-left="5"
     fit-margin-right="5"
     fit-margin-bottom="5"
     inkscape:zoom="1.69"
     inkscape:cx="408.94679"
     inkscape:cy="125.8"
     inkscape:window-x="65"
     inkscape:window-y="24"
     inkscape:window-maximized="1"
     inkscape:current-layer="svg3365" />
  <g
     transform="matrix(0.8,0,0,0.8,1398.2863,-5670)"
     id="g3367">
    <g
       id="g3369">
      <rect
         x="-2600"
         y="-7600"
         width="5100"
         height="7600"
         rx="200"
         ry="200"
         id="rect3371"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(1400,-1100)"
         id="g3373" />
    </g>
    <g
       id="g3375">
      <rect
         x="-2000"
         y="-7100"
         width="4000"
         height="5600"
         rx="200"
         ry="200"
         id="rect3377"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(900,-2600)"
         id="g3379" />
    </g>
    <g
       id="g3381">
      <rect
         x="-1400"
         y="-6600"
         width="2900"
         height="3600"
         rx="200"
         ry="200"
         id="rect3383"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(400,-4100)"
         id="g3385" />
    </g>
    <g
       id="g3387">
      <rect
         x="-800"
         y="-6100"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3389"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-5600)"
         id="g3391" />
    </g>
  </g>
  <g
     transform="matrix(0.8,0,0,0.8,6547.3396,-3670)"
     id="g3393">
    <g
       id="g3395">
      <rect
         x="-2000"
         y="-12600"
         width="4000"
         height="12600"
         rx="200"
         ry="200"
         id="rect3397"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(900,-1100)"
         id="g3399" />
    </g>
    <g
       id="g3401">
      <rect
         x="-1400"
         y="-7500"
         width="2900"
         height="6000"
         rx="200"
         ry="200"
         id="rect3403"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(400,-2600)"
         id="g3405" />
    </g>
    <g
       id="g3407">
      <rect
         x="-600"
         y="-9700"
         width="2100"
         height="1600"
         rx="200"
         ry="200"
         id="rect3409"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(400,-9200)"
         id="g3411" />
    </g>
    <g
       id="g3413">
      <path
         d="M 0,-3000 V 1200"
         id="path3415"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3417">
      <path
         d="m 0,-5200 v 600"
         id="path3419"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3421">
      <path
         d="m 0,-10300 v 3500"
         id="path3423"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3425">
      <path
         d="m 0,-13800 v 1900"
         id="path3427"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3429">
      <rect
         x="-800"
         y="-4600"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3431"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-4100)"
         id="g3433" />
    </g>
    <g
       id="g3435">
      <rect
         x="-800"
         y="-6800"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3437"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-6300)"
         id="g3439" />
    </g>
    <g
       id="g3441">
      <rect
         x="-800"
         y="-11900"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3443"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-11400)"
         id="g3445" />
    </g>
  </g>
  <g
     transform="matrix(0.8,0,0,0.8,12647.221,-4550)"
     id="g3447">
    <g
       id="g3449">
      <rect
         x="-3300"
         y="-10400"
         width="8800"
         height="10400"
         rx="200"
         ry="200"
         id="rect3451"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(4400,-1100)"
         id="g3453" />
    </g>
    <g
       id="g3455">
      <rect
         x="-2700"
         y="-5300"
         width="6800"
         height="3800"
         rx="200"
         ry="200"
         id="rect3457"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(3000,-2600)"
         id="g3459" />
    </g>
    <g
       id="g3461">
      <rect
         x="-1400"
         y="-9700"
         width="2900"
         height="3800"
         rx="200"
         ry="200"
         id="rect3463"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(400,-7000)"
         id="g3465" />
    </g>
    <g
       id="g3467">
      <path
         d="M 0,-3000 V 1200"
         id="path3469"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3471">
      <path
         d="m 3600,-5900 v 1900 a 200,200 0 0 1 -200,200 H 800"
         id="path3473"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3475">
      <path
         d="m 5000,-11600 v 4700 a 200,200 0 0 1 -200,200 h -400"
         id="path3477"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3479">
      <path
         d="m 2200,-11600 v 4700 a 200,200 0 0 0 200,200 h 400"
         id="path3481"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3483">
      <path
         d="m 0,-7400 v 2800"
         id="path3485"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3487">
      <path
         d="m -2100,-11600 v 7600 a 200,200 0 0 0 200,200 h 1100"
         id="path3489"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3491">
      <rect
         x="-800"
         y="-4600"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3493"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-4100)"
         id="g3495" />
    </g>
    <g
       id="g3497">
      <rect
         x="2800"
         y="-7500"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3499"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(3300,-7000)"
         id="g3501" />
    </g>
    <g
       id="g3503">
      <rect
         x="-800"
         y="-9000"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3505"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-8500)"
         id="g3507" />
    </g>
  </g>
  <g
     transform="matrix(0.8,0,0,0.8,21201.659,-4550)"
     id="g3509">
    <g
       id="g3511">
      <rect
         x="-2900"
         y="-10400"
         width="7000"
         height="10400"
         rx="200"
         ry="200"
         id="rect3513"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(3000,-1100)"
         id="g3515" />
    </g>
    <g
       id="g3517">
      <rect
         x="-2100"
         y="-5300"
         width="4700"
         height="3800"
         rx="200"
         ry="200"
         id="rect3519"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(1500,-2600)"
         id="g3521" />
    </g>
    <g
       id="g3523">
      <rect
         x="700"
         y="-9700"
         width="2900"
         height="3800"
         rx="200"
         ry="200"
         id="rect3525"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(2500,-7000)"
         id="g3527" />
    </g>
    <g
       id="g3529">
      <path
         d="M 0,-3000 V 1200"
         id="path3531"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3533">
      <path
         d="m 2100,-7400 v 3400 a 200,200 0 0 1 -200,200 H 800"
         id="path3535"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3537">
      <path
         d="m 2100,-11600 v 2600"
         id="path3539"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3541">
      <path
         d="m 0,-11600 v 7000"
         id="path3543"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3545">
      <path
         d="m -1500,-5900 v 1900 a 200,200 0 0 0 200,200 h 500"
         id="path3547"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3549">
      <path
         d="m -1500,-11600 v 4100"
         id="path3551"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3553">
      <rect
         x="-800"
         y="-4600"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3555"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-4100)"
         id="g3557" />
    </g>
    <g
       id="g3559">
      <rect
         x="1300"
         y="-9000"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3561"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(1800,-8500)"
         id="g3563" />
    </g>
    <g
       id="g3565">
      <rect
         x="-2300"
         y="-7500"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3567"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-1800,-7000)"
         id="g3569" />
    </g>
  </g>
  <g
     transform="matrix(0.8,0,0,0.8,27971.954,-6310)"
     id="g3571">
    <g
       id="g3573">
      <rect
         x="-2100"
         y="-6000"
         width="5600"
         height="6000"
         rx="200"
         ry="200"
         id="rect3575"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(2400,-1100)"
         id="g3577" />
    </g>
    <g
       id="g3579">
      <path
         d="M 0,-1500 V 1200"
         id="path3581"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3583">
      <path
         d="m 2200,-3700 v 1200 a 200,200 0 0 1 -200,200 H 800"
         id="path3585"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3587">
      <path
         d="m 2200,-7200 v 1900"
         id="path3589"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3591">
      <path
         d="m 0,-3700 v 600"
         id="path3593"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3595">
      <path
         d="m 0,-7200 v 1900"
         id="path3597"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3599">
      <path
         d="m -1500,-7200 v 4700 a 200,200 0 0 0 200,200 h 500"
         id="path3601"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3603">
      <rect
         x="-800"
         y="-3100"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3605"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-2600)"
         id="g3607" />
    </g>
    <g
       id="g3609">
      <rect
         x="1400"
         y="-5300"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3611"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(1900,-4800)"
         id="g3613" />
    </g>
    <g
       id="g3615">
      <rect
         x="-800"
         y="-5300"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3617"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-4800)"
         id="g3619" />
    </g>
  </g>
  <g
     transform="matrix(0.8,0,0,0.8,33607.694,-8070)"
     id="g3621">
    <g
       id="g3623">
      <path
         d="M 0,0 V 1200"
         id="path3625"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3627">
      <path
         d="m 1400,-2800 v 1800 a 200,200 0 0 1 -200,200 H 800"
         id="path3629"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3631">
      <path
         d="m 0,-2800 v 1200"
         id="path3633"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3635">
      <path
         d="m -1400,-2800 v 1800 a 200,200 0 0 0 200,200 h 400"
         id="path3637"
         inkscape:connector-curvature="0"
         style="fill:none;stroke:#000000;stroke-width:100" />
    </g>
    <g
       id="g3639">
      <rect
         x="-800"
         y="-1600"
         width="1600"
         height="1600"
         rx="200"
         ry="200"
         id="rect3641"
         style="fill:#ffffff;stroke:#000000;stroke-width:100" />
      <g
         transform="translate(-300,-1100)"
         id="g3643" />
    </g>
  </g>
</svg>
