# DESIGN SYSTEM (owner: C)

Tone: an engineering console for people who read timetables for a living. Think Linear plus a lab instrument. Information first, decoration never. Every pixel shows data or aids reading it.

## Tokens (`frontend/src/theme.css`)
```css
:root {
  --bg: #0E1116;  --panel: #151A21;  --panel-2: #1B222B;  --line: #262D38;
  --text: #E6E8EB;  --text-2: #8B95A3;  --text-3: #5C6674;
  --accent: #4589FF;            /* primary actions + quantum data only */
  --ok: #42BE65;  --warn: #F1C21B;  --bad: #FA4D56;   /* semantic only, never decorative */
  --radius: 2px;
  --font-ui: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
:root[data-theme='light'] {
  --bg: #F4F4F2; --panel: #FFFFFF; --panel-2: #EEEEEA; --line: #D8D8D2;
  --text: #161A1F; --text-2: #4F5865; --text-3: #7B8491; --accent: #0F62FE;
}
```
Slot palette (subgraph fill, 8 muted hues, low saturation): `#4589FF #8A9BB0 #42BE65 #B28600 #D4749B #6FA8A0 #9B8AC4 #C98B5A`. With more than 8 slots, use lightness steps of one hue instead.

## Rules
- Fonts: IBM Plex Sans (UI), IBM Plex Mono (every number, ID, slot, bitstring, timing). Install via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`. Sizes: 12 / 13 / 15 / 20 px. Numerics: `font-variant-numeric: tabular-nums`, right-aligned in tables.
- Spacing on a 4px grid. Radius 2px. 1px borders. No shadows, gradients, blur, glass.
- Icons: Lucide 16px, stroke 1.5, only where they carry meaning.
- Status: 8px square dot + text label. No pill badges with emoji.
- Copy is specific and factual: "Solved in 14.2 s, 0 hard violations", "Rejected: 2 hard clashes after repair, kept baseline". Never "Magic!", "AI-powered", "Supercharge".
- Density: tables 28px rows, 12-13px text. No hero banners, no three-column feature cards, no centered marketing layouts, no stock illustration, no lorem ipsum.
- Keyboard: `g d` dataset, `g t` timetable, `g c` cluster lab, `g b` benchmarks, `r` run, `?` shortcut sheet. A one-line hint bar at the bottom.
- Accessibility: contrast >= 4.5:1, visible focus ring (1px accent + 2px offset), color never the only signal (add text or marker shape).

## Shell
56px left rail (text labels on hover, active item has a 2px accent bar), 40px top status bar showing: dataset name, run_id (mono), baseline status, hard violations (mono, green if 0), role toggle (Coordinator | Researcher), theme toggle. Content max width fluid; panels separated by 1px lines, not by gaps.

## Components (C1 builds all at `/design`)
AppShell, DataTable, Stat (label above, large mono value below, no chrome), Segmented, Slider (value shown in mono at right), Badge (dot + text), Panel (1px border, header row 32px), CodeBlock, Stepper (horizontal, square nodes), Toast, EmptyState (one sentence + one action), KeyHint.

## Pages
1. **Dataset**: drop zone (dashed 1px, one line of text), parsed-file table (rows, size, status), validation table (issue, count, severity), primary button "Solve baseline" with live elapsed timer (mono).
2. **Timetable**: grid, slots as columns grouped by day with day header, rooms as rows. Exam block = course_id + headcount (mono). Strip above columns: count of back-to-back students per day. Filter by department (Segmented or select). Click a block -> right detail panel (clashes, spacing penalties, students affected). Resolved clusters get a thin accent left border.
3. **Cluster Lab (hero screen)**: left list of ranked clusters (size, affected students, baseline penalty); center SVG conflict subgraph (d3-force, node radius by enrollment, edge width by shared students, fill by slot) with Before/After toggle; right config panel (backend Segmented: Simulator | Noisy | IBM QPU (researcher only), p 1|2, optimizer, shots, penalty sliders) + Run. During run: Stepper (Extract > QUBO > Circuit > Optimize > Sample > Repair > Decide) and live energy-vs-iteration line chart (polling 1 s). After: decision sentence in a Panel with left border ok/warn, bitstring histogram (feasible bars accent, infeasible bars text-3), diff table (course, from, to).
4. **Benchmarks**: sortable table (method, objective, approx ratio, feasible %, runtime, depth, 2q gates), grouped bar chart of ratio per method, depth/2q gates vs p, noise sweep line, IBM run card (backend, queue time, depth, link to raw JSON), Export CSV + printable HTML.
5. **Settings**: penalty weights table, default time limit, role, theme.

## Chart styling (Recharts)
No gridline boxes; light horizontal lines `--line`; axis text 11px mono `--text-2`; one accent color for QAOA series, `--text-2` for classical baselines; direct labels at line ends instead of legends where possible; tooltips are flat panels with 1px border.

## Anti-generic checklist (run before demo)
- [ ] No element with radius > 4px, shadow, gradient, or blur
- [ ] Every number is mono and right-aligned in tables
- [ ] No empty-looking container; every region has real data or a one-line empty state with an action
- [ ] No vague copy; every sentence contains a number or a noun from the domain
- [ ] No icon without meaning; no emoji
- [ ] Spacing visibly varies by hierarchy (tight in tables, looser between sections), not uniformly padded
- [ ] Screens look right at 1440x900 and 1280x720; no horizontal page scroll
