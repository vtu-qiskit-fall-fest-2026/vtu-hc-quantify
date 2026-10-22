# UI UPDATE: BENTO + GREEN (supersedes the dark-console look in DESIGN_SYSTEM.md)

Reference: the Nanoplazz landing page (mint canvas, floating pill nav, big rounded tiles in different greens, one italic green accent word in the headline, overlapping circular badge, stat tiles with small ring icons, image tiles with large radius). Keep everything below consistent with that language, but with QUANTA's own content and denser data.

## 1. Design principles
1. **Everything lives in a tile.** No loose content on the canvas. Each tile has one job and one title.
2. **Tiles are not equal.** One hero tile per page (2-3x the area of the others), a few medium tiles, small stat tiles. Equal-sized card grids look generated; varied spans look designed.
3. **Tight gaps, soft corners.** 12px gaps, 24px tile radius, 12px inner radius, pills (999px) for buttons, tabs and chips.
4. **Muted green family with one calm accent.** Different tiles use different greens (white, mint, sage, deep forest) like the reference stat tiles. Quantum data gets a single teal accent so it reads as a separate series.
5. **Playful, readable type.** Poppins for UI and headings, one italic green accent word per page headline, DM Mono for bitstrings, IDs and tabular numbers only.
6. **Density is allowed inside tiles.** Tables and grids stay compact (13px, 36px rows); the playfulness is in the shell, not in the data.
7. **Honest data, no decoration.** Every tile contains real numbers or a real chart. No stock images, no lorem ipsum, no emoji, no gradients, no glass.

## 2. Tokens (`frontend/src/theme.css`)
```css
:root {
  /* canvas + tiles */
  --canvas:   #E9F2EA;   /* page background, mint */
  --tile:     #FFFFFF;   /* default tile */
  --tile-mint:#D9EDDD;   /* soft green tile */
  --tile-sage:#BFE0C8;   /* stronger green tile (stat tiles) */
  --tile-deep:#1F5B3C;   /* deep forest tile, white text */
  --tile-ink: #17241C;   /* near-black tile for code/telemetry */
  --line:     #D2E3D6;

  /* text */
  --ink:      #17241C;
  --ink-2:    #51655A;
  --ink-3:    #86988D;
  --on-deep:  #F2FAF4;

  /* brand + semantic */
  --green:    #34A85F;   /* primary CTA, active states, accent word */
  --green-hover:#2B8F50;
  --green-soft:#E3F3E7;
  --quantum:  #2D7F9D;   /* teal, only for QAOA / quantum series and QPU badges */
  --warn:     #E3A21A;
  --bad:      #D8504D;

  /* shape + motion */
  --r-tile: 24px; --r-inner: 12px; --r-pill: 999px; --gap: 12px;
  --ease: cubic-bezier(.2,.7,.2,1);
  --font-ui: 'Poppins', system-ui, sans-serif;
  --font-mono: 'DM Mono', ui-monospace, monospace;
}
:root[data-theme='dark'] {
  --canvas:#0E1712; --tile:#16221B; --tile-mint:#1B2B22; --tile-sage:#23382B; --tile-deep:#2B6B47; --tile-ink:#0A110D;
  --line:#243329; --ink:#E8F3EB; --ink-2:#A3B8AA; --ink-3:#6F8577; --green:#4BC479; --green-hover:#5FD08A; --quantum:#4FB0D0;
}
```
Slot palette for the conflict graph (8 muted hues): `#34A85F #2D7F9D #E3A21A #8FA8E8 #D98BB0 #7FC8B4 #B7A06A #9A8FD1`. No shadows except `0 1px 0 rgba(23,36,28,.04)` on hover-lift tiles.

## 3. Typography
- Install self-hosted: `@fontsource/poppins` (400, 500, 600, 700 and 500 italic) and `@fontsource/dm-mono` (400, 500). No CDN.
- Display: Poppins 600, 44/48 (hero), 28/32 (page titles); Tile titles: Poppins 600 14/20; Body: Poppins 400 13/20; Labels: Poppins 500 11/16 uppercase letter-spacing .04em in `--ink-3`.
- Accent word: Poppins italic 500 in `--green` (exactly one per page headline, e.g. "Exam clashes, *resolved*").
- Numbers in stat tiles: Poppins 600 28-40px; numbers in tables, ids, bitstrings, timings: DM Mono 12-13px, `tabular-nums`, right-aligned.
- Playful alternatives if the team wants a different feel (swap only the font tokens): Bricolage Grotesque, Outfit, Plus Jakarta Sans.

## 4. Layout system
- Canvas padding 24px; max width 1440px; centered.
- **Floating pill nav** (from the reference): white pill, 48px high, centered at top, items Dataset, Timetable, Cluster Lab, Benchmarks; active item = `--green-soft` pill with `--green` text. Left: logo mark (small dotted-circle QUANTA glyph in green) + wordmark. Right: role pill-segmented (Coordinator | Researcher), theme toggle, and a green pill CTA "Run optimizer". A thin status line under the nav: run id (mono), baseline time, hard violations.
- **Bento grid:** CSS grid, 12 columns, `grid-auto-rows: 88px`, gap 12px, tiles placed with `grid-column / grid-row` spans per page (maps in section 6). Breakpoints: >=1280 12 col; 768-1279 6 col (hero spans 6); <768 1 col (desktop is the demo target, but it must not break).
- Tile anatomy: 20px padding (16px for dense tiles), title row (title left, tiny action icon or chip right), content, optional footer stat. Overflow hidden; inner scroll only inside tables.
- **Overlap accent:** one circular badge (88px, white ring, green fill) straddling two tiles, as in the reference. Use it for the "0 hard violations" seal on the Overview and Cluster Lab decision.

## 5. Components
Tile (variants: default, mint, sage, deep, ink, outlined, image), StatTile (ring icon + big number + label), PillButton (primary green, secondary white with line, ghost), PillSegmented, Chip (status dot + text), Slider (green track, 20px white thumb with line), DataTable (inside tile, sticky header in `--tile-mint`, zebra `--green-soft`, 36px rows, inner radius 12), Stepper (pill nodes), EmptyState, Toast, CodeTile (`--tile-ink`, mono, for bitstrings and raw JSON), CircleSeal (overlap badge), KeyHint.
Motion: tiles mount with 160ms fade + 8px rise, staggered 30ms (cap 300ms total); hover lift `translateY(-2px)` 120ms; number count-up 600ms on first render; Stepper node fills animate; all disabled under `prefers-reduced-motion`.

## 6. Page bento maps (12 columns; r = rows of 88px)
**Overview (new route `/`)**: headline on canvas: "Exam clashes, *resolved*." + one-line subcopy ("Hybrid CP-SAT and QAOA scheduling with a guaranteed-feasible fallback") + two pills (Upload dataset, View demo run).
```
[ StatTile 0 hard violations (sage) 3x2 ][ StatTile 0.xx approx ratio (white) 3x2 ][ StatTile 12 qubits (mint) 3x2 ][ StatTile solve time (deep) 3x2 ]
[ Hero: mini conflict-graph illustration (SVG, live data) 7x4 ][ Pipeline tile: CP-SAT > QUBO > QAOA > Repair > Decide stepper 5x2 ]
                                                              [ Latest decision tile 5x2, CircleSeal overlapping ]
```
**Dataset**: `[ Drop zone 6x3 (mint, dashed) ][ Files table 6x3 ]` / `[ Validation table 8x3 ][ Dataset stats 4x3 as 4 mini StatTiles ]` / `[ Solve baseline tile 12x1 deep, primary pill + live timer ]`.

**Timetable**: `[ Timetable grid 9x7 (hero, white) ][ Day strip: back-to-back by day 3x2 ][ Department filter chips 3x1 ][ Selected exam detail 3x4 ]`. Exam blocks are 10px-radius mini tiles tinted by department (muted greens/teals); resolved ones get a 3px `--green` left edge.

**Cluster Lab (hero page)**: `[ Cluster list 3x7 ][ Conflict subgraph 6x5 (hero, mint) with Before/After pill-toggle ][ Run config 3x5 ]` / `[ Pipeline stepper 6x1 ]` / `[ Energy convergence chart 4x2 ][ Decision tile 4x2 (deep when accepted, white with warn edge when fallback; CircleSeal) ][ Bitstring histogram 4x2 ]` / `[ Diff table 6x2 ][ Raw result CodeTile 6x2 (ink) ]`.

**Benchmarks**: `[ Method comparison bar chart 7x4 (hero) ][ StatTile best ratio 2.5x2 ][ StatTile failed runs ][ IBM run tile 5x3 (teal accent, QPU chip) ]` / `[ Results table 7x3 ][ Depth and 2q gates vs p 5x3 ]` / `[ Noise sweep 6x2 ][ Honest summary sentence tile 6x2 (mint) ]`.

**Settings**: penalty weights table tile, defaults tile, role/theme tile.

## 7. Charts (Recharts) in bento
Transparent chart background inside tiles; 1px horizontal grid `--line`; axis labels DM Mono 11px `--ink-3`; QAOA series `--quantum`, classical series `--green` and `--ink-3`; rounded bar tops (4px); direct labels, no legend boxes; tooltip = small white tile with 12px radius and 1px line.

## 8. Anti-generic checklist (bento version)
- [ ] Each page has exactly one hero tile and varied spans (no uniform card grid)
- [ ] At least three different tile tints per page, all within the green family
- [ ] One italic accent word in the page headline, nowhere else
- [ ] No shadows beyond hover hairline, no gradients, no glass, no emoji
- [ ] All numbers in DM Mono (tables) or Poppins 600 (stat tiles); right-aligned in tables
- [ ] Radius: tile 24, inner 12, controls pill; nothing else
- [ ] Every tile has a title, real data, and a reason to exist
- [ ] Contrast >= 4.5:1 (check `--ink-3` on tinted tiles; use `--ink-2` if it fails)
- [ ] Works at 1440x900 and 1280x720 without page scroll on Overview and Cluster Lab

---
# AGENT PROMPTS

## U1: master UI update (run first, in a fresh session, Member C)
```
Read AGENTS.md, docs/UI_UPDATE_BENTO.md (this overrides docs/DESIGN_SYSTEM.md wherever they conflict) and the reference description in section 0. Redesign the entire frontend as a Bento-box UI in a muted green palette, keeping all existing functionality, routes, API calls and types unchanged.
1. Install @fontsource/poppins (400,500,600,700, 500 italic) and @fontsource/dm-mono (400,500); remove IBM Plex imports. Replace src/theme.css with the tokens in section 2 (light and dark) and map them in tailwind.config (colors canvas, tile, tileMint, tileSage, tileDeep, tileInk, line, ink, ink2, ink3, green, greenSoft, quantum, warn, bad; radii tile 24px, inner 12px, pill 999px; fontFamily ui, mono; boxShadow none).
2. Replace the left rail with the floating pill nav from section 4 (logo mark + wordmark left, four route pills center, role pill-segmented + theme toggle + 'Run optimizer' green pill right) and the status line below it.
3. Build a BentoGrid component (12 columns, auto rows 88px, 12px gap, responsive 12/6/1 columns) and a Tile component with variants default, mint, sage, deep, ink, outlined and props colSpan, rowSpan, title, action. Rebuild StatTile, PillButton, PillSegmented, Chip, Slider, DataTable, Stepper, CodeTile, CircleSeal, EmptyState, Toast per section 5, and update the /design route to show them in light and dark.
4. Add the Overview route (/) exactly as mapped in section 6 using real data from the API (mock mode is fine) and make it the default landing page.
5. Do not touch src/api.ts, src/types.ts or any data logic. Run tsc --noEmit and vitest, then list the files changed.
```

## U2: Dataset and Timetable pages
```
Using the existing components from U1, rebuild the Dataset and Timetable pages as bento layouts per section 6. Dataset: drop-zone tile (mint, dashed 1.5px border in --green at 40% opacity, one line of text, icon only if it carries meaning), files table tile, validation table tile, four mini stat tiles (students, courses, rooms, slots) and a deep-green full-width 'Solve baseline' tile with the primary pill and live mono timer. Timetable: hero grid tile with slot columns grouped by day and rooms as rows; exam blocks are 10px-radius mini tiles tinted by department using the green/teal slot palette, resolved cluster blocks get a 3px green left edge; day-strip tile with back-to-back counts per day as small bars; department chips; right detail tile on selection with conflicts table. Keep keyboard navigation. Dense 13px type inside tiles, 36px rows.
```

## U3: Cluster Lab (hero)
```
Rebuild Cluster Lab per the section 6 map. Subgraph in a mint hero tile: nodes sized by enrollment, filled with the slot palette, edges in --ink-3 at 40% opacity with width by shared students, labels DM Mono 11px; Before/After as a PillSegmented that animates fills in 150ms. Run config tile with PillSegmented for backend (Simulator | Noisy | IBM QPU, last two disabled unless Researcher), p, optimizer, shots, penalty sliders. Pipeline Stepper tile with pill nodes that fill as job.stage advances. Energy chart tile (QAOA line in --quantum, dashed --ink-3 line for brute-force ground energy). Decision tile: deep-green with white text and an overlapping CircleSeal showing '0 hard violations' when accepted; white tile with a warn left edge and the verbatim reason when fallback. Histogram tile (feasible bars --green, infeasible --ink-3), diff table tile, and a dark CodeTile with the raw QuantumResult JSON. Everything handles idle, running, error, done states.
```

## U4: Benchmarks and Settings
```
Rebuild Benchmarks per the section 6 map using Recharts styled per section 7 (QAOA series --quantum, classical --green and --ink-3, rounded bar tops, no legend boxes, direct labels). Include the IBM run tile with a teal 'QPU' chip, backend, qubits, queue time, depth, 2q gates, ratio and job id in mono, and an honest summary sentence tile computed from the data. No placeholder numbers: show an EmptyState with 'make bench' when data is missing. Rebuild Settings as three tiles (penalty weights table with inline number inputs, defaults, role and theme).
```

## U5: polish and QA
```
Audit every page against the anti-generic checklist in section 8 and the contrast rule. For each failed item list file and fix it. Then: stagger mount animations (30ms, cap 300ms) and count-up numbers with prefers-reduced-motion disabling both; verify 1440x900 and 1280x720 layouts, the 6 and 1 column breakpoints, dark theme parity, focus rings (2px --green, 2px offset), keyboard shortcuts (g o, g d, g t, g c, g b, r), and no console warnings. Replace any vague copy with specific copy containing a number or a domain noun. Report a before/after summary per page.
```

## U6: refinement prompt for any screen that still looks generic
```
Look at this page against docs/UI_UPDATE_BENTO.md. Identify tiles that are the same size without reason, tiles with no real data, repeated tints, decorative icons, and any default-component-library pattern. Re-span the grid so one hero tile dominates, vary tints within the green family, merge or delete weak tiles, tighten padding to the 4px grid, and rewrite microcopy to be specific. Show the new grid map as ASCII before coding.
```
