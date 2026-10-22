Read AGENTS.md and docs/UI_UPDATE_BENTO.md. The current Overview screen does not match the spec: tiles have no fill (same mint as the canvas), 1px square outlines instead of 24px rounded tiles, primary buttons render with an invisible/transparent fill, the logo mark and chips are empty, the pipeline stepper is clipped on the right, and all four stat tiles look identical. Fix this in two phases and do not change data logic, routes, api.ts or types.ts.

PHASE 1: DIAGNOSE THE ROOT CAUSE (do this before styling)
1. Inspect the computed styles of Tile, PillButton (primary), the logo mark and a Chip in the running app. Report for each: background-color, border-radius, border, color, opacity.
2. Find why tokens do not resolve. Check: variable names in theme.css vs names used in tailwind.config and components; tailwind content globs covering all src files; theme.css imported once in main.tsx before components; classes like bg-tile or bg-green actually present in the generated CSS; any `opacity`, `disabled`, or `aria-disabled` styling applied to primary buttons; light/dark data-theme attribute set on <html>.
3. Fix the root cause, then add a plain-CSS safety layer in theme.css so the core look never depends on Tailwind mapping:
   .tile{background:var(--tile);border-radius:var(--r-tile);padding:20px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent);transition:transform .12s var(--ease)}
   .tile:hover{transform:translateY(-2px)}
   .tile--mint{background:var(--tile-mint);border-color:transparent}
   .tile--sage{background:var(--tile-sage);border-color:transparent}
   .tile--deep{background:var(--tile-deep);color:var(--on-deep);border-color:transparent}
   .tile--ink{background:var(--tile-ink);color:var(--on-deep);border-color:transparent}
   .pill-btn{height:44px;padding:0 20px;border-radius:999px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
   .pill-btn--primary{background:var(--green);color:#fff}
   .pill-btn--primary:hover{background:var(--green-hover);transform:translateY(-1px)}
   .pill-btn--secondary{background:var(--tile);color:var(--ink);border:1px solid var(--line)}
   Use these classes inside the Tile and PillButton components.

PHASE 2: MAKE IT LOOK DESIGNED
Hard rule: no tile may share the canvas background. Canvas is --canvas (#E9F2EA); tiles are white, mint, sage, deep or ink.

A. Shell
- Nav: one floating white pill (radius 999, 56px high, 1px --line border, no shadow beyond a hairline). Left: logo mark = 36px filled --green circle containing a white dotted-ring SVG (8 dots on a circle plus one center dot), then 'QUANTA' Poppins 700 and a small 'HYBRID' chip (green-soft fill, green text, pill). Center: route pills; active = green-soft fill, green text, weight 600. Right: 'Demo run' secondary pill, Coord/Research PillSegmented (white track, active segment green-soft), theme toggle as a 40px circle button, and 'Run optimizer' as a SOLID green primary pill with a bolt icon.
- Status line: replace the loose mono text with three white pill chips (run id, dataset, 0 hard violations with a green check circle) and a '? keys' ghost chip. Tighten vertical spacing so the first bento row is visible within 900px height.

B. Hero
- Eyebrow chip: white fill, green 8px dot, text 'IBM Quantum-Assisted Timetabling'. Headline stays 'Exam clashes, *resolved*.' (italic accent word in --green). CTA row: 'Upload dataset' solid green primary, 'Explore Cluster Lab' and 'View benchmarks' white secondary pills. Make sure the primary is clearly solid green with white text.

C. Stat row (four tiles, four different treatments, 12px gap)
1. HARD VIOLATIONS: sage tile. 32px white circle icon container with shield icon. Value 0 at 56px Poppins 700. Subtext 'Certified zero student clashes'. Footer: thin 6px progress bar fully filled green.
2. QAOA APPROX RATIO: white tile. Value 1.000 with a small circular ring gauge (SVG, green stroke on --green-soft track) at the right showing 100%. Subtext 'Matches exact ground-state energy'.
3. HARDWARE TESTED: deep-forest tile with white text. Value '156 Qubits'. Draw a faint heavy-hex dot lattice (SVG, ~156 dots, 2px radius, white at 18% opacity, a few dots highlighted in --green) filling the right half as decoration. Subtext 'Physical IBM Kingston execution'. Add a small teal 'QPU' chip.
4. BASELINE SOLVE: mint tile. Value '0.05 s'. A 7-bar mini sparkline of solve times across runs in --green at 70%. Subtext 'Global CP-SAT campus model'.
- Place a 96px CircleSeal overlapping the seam between tile 1 and tile 2: green fill, white 4px ring, text on a circular path 'CERTIFIED SAFE * ZERO CLASHES *' rotating once per 24s (disabled under prefers-reduced-motion), center check icon. Keep it from covering text.
- Count-up animation on numbers (600 ms), staggered tile mount (30 ms, 160 ms fade + 8 px rise).

D. Second row
- Conflict-cluster tile (hero, spans 7 cols, rows 4+): white tile, header with title and '6 coupled courses' green-soft chip and 'Inspect lab' secondary pill (not square). Graph: nodes 44px with 3px white ring and a soft outer ring in the slot color at 25%, course names under nodes in 12px --ink-2, edge weights in tiny white pill labels on the edges, edges --ink-3 at 40%, thickness by shared students. Bottom: legend chips (slot day/time) with colored dots.
- Pipeline tile (5 cols): title 'Hybrid workflow'. Replace the clipped row with a vertical or 2-row wrapping stepper: five pill steps (CP-SAT baseline, Extract cluster, QUBO/Ising, QAOA, Repair + decide), each with a numbered 24px circle; completed = green circle with check, active = green fill + pulsing ring, upcoming = white with line. Connected by a 2px line. The description paragraph below changes with the active step. No horizontal clipping at 1280 px.
- Add a 'Live timetable preview' image-style tile (5 cols, 3 rows, sage tint): mini timetable grid with slots as columns and rooms as rows, exam blocks as 8px-radius colored mini tiles from real data, resolved blocks with a 3px green left edge, caption 'Day 1-2 · 8 slots · 4 rooms'. This is the equivalent of the image tiles in the reference.

E. Global
- Replace every square 1px outline element (chips, buttons, tabs) with pill shapes and fills. Chips: green-soft fill, no border. Secondary pills: white fill, 1px --line.
- Icons live in 32px circular containers (white or green-soft) at 16px stroke 1.5.
- Raise subtext contrast: use --ink-2 for descriptions, --ink-3 only for tiny labels, and verify 4.5:1 on every tinted tile.
- Make sure no element is faded unintentionally: grep for opacity-* and text-white on light backgrounds.

ACCEPTANCE
1. Computed style of every tile: radius 24px and a fill different from --canvas.
2. Primary buttons: solid --green background, white text, hover lift.
3. Four stat tiles have four distinct fills (sage, white, deep, mint) and each contains a small visual (bar, ring, lattice, sparkline).
4. CircleSeal overlaps tiles 1 and 2 and rotates.
5. No clipped text at 1280x720 and 1440x900; the first bento row and the top of the graph tile are visible without scrolling at 1440x900.
6. tsc --noEmit and vitest pass; show a short before/after list per component.
Then apply the same tile variants, pill controls and token usage to Dataset, Timetable, Cluster Lab and Benchmarks using the maps in docs/UI_UPDATE_BENTO.md section 6.