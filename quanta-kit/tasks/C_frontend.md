# MEMBER C: Frontend, design, demo

Agent: Cursor or Claude Code. Load `AGENTS.md` and `docs/DESIGN_SYSTEM.md`. Work only in `frontend/` and `docs/DEMO.md`. Develop against mock mode: `make mock` (API on :8000 with `QUANTA_MOCK=1`). Types mirror `docs/CONTRACTS.md` in `frontend/src/types.ts` (write it first and keep it identical).

Stack: Vite, React 18, TypeScript, Tailwind CSS, TanStack Table v8, Recharts, d3-force, papaparse, lucide-react, @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono, react-router, zustand (state), Vitest.

## C1 (H2-5): scaffold and design system
**Prompt:**
```
Create frontend/ with Vite + React 18 + TypeScript + Tailwind + react-router + zustand. Implement docs/DESIGN_SYSTEM.md exactly: put tokens in src/theme.css, map them in tailwind.config (colors bg, panel, panel2, line, text, text2, text3, accent, ok, warn, bad; fontFamily ui and mono; borderRadius 2px; no boxShadow), install IBM Plex fonts via @fontsource and import them locally (no CDN). Write src/types.ts mirroring docs/CONTRACTS.md section 2 and src/api.ts as a typed client for section 3 (base URL from VITE_API_URL, default http://localhost:8000/api; sends X-Role from the store; throws ApiError with the server's message). Build components: AppShell (56px left rail with Lucide 16px icons and text labels on hover, 40px top status bar with dataset name, run_id in mono, hard violations count, role Segmented, theme toggle), DataTable (TanStack, 28px rows, tabular numerals, right-aligned numeric columns, sortable), Stat, Segmented, Slider (mono value at right), Badge (8px square dot + text), Panel (1px border, 32px header row), CodeBlock, Stepper, Toast, EmptyState, KeyHint bar with g d / g t / g c / g b / r shortcuts. Add a /design route rendering every component in both themes. Absolutely no gradients, shadows, blur, emoji, radius over 4px, or lorem ipsum. Run tsc --noEmit and show a screenshot description of /design.
```

## C2 (H5-12): Dataset and Timetable pages
**Prompt:**
```
Build page Dataset (/): a one-line dashed drop zone accepting courses.csv, enrollments.csv, rooms.csv, slots.csv; parse client-side with papaparse; show a files table (name, rows, size, status) and a validation table (issue, count, severity) covering missing columns, duplicate (student,course), unknown course ids, rooms under 20 capacity, slot order gaps. Primary button 'Solve baseline' calls POST /datasets then POST /runs then POST /runs/{id}/baseline and polls GET /jobs/{id} every 1 s with a live elapsed timer (mono). On completion navigate to Timetable and show 'Solved in X s, 0 hard violations' in the status bar.
Build page Timetable (/timetable): grid with slot columns grouped under day headers, rooms as rows; each exam block shows course_id and headcount in mono, left border colored by department hue (muted), resolved-cluster blocks get a 2px accent left border; strip above columns showing back-to-back student count per day; department filter; clicking a block opens a right detail panel with course name, enrollment, rooms, and a table of conflicting courses with shared students and penalty type. Keyboard: arrow keys move block selection, Esc closes the panel. Use dense 12-13px type. Handle loading with table skeleton rows only; errors via Toast showing the server message. All data from the API client; mock mode must work.
```

## C3 (H14-22): Cluster Lab (hero screen)
**Prompt:**
```
Build page Cluster Lab (/clusters) with three columns. Left: ranked cluster list from POST /runs/{id}/clusters/extract (size, affected students, baseline penalty, mono) with selection. Center: SVG conflict subgraph using d3-force (nodes sized by enrollment, edges width by shared_students, node fill by slot using the 8-hue slot palette in DESIGN_SYSTEM.md, labels course_id mono 11px); a Before/After Segmented toggle that animates node fill changes only (150 ms) using FinalDecision.changes; legend with slot day/time. Right: config Panel with backend Segmented (Simulator | Noisy | IBM QPU; the last two disabled with tooltip text unless role is researcher), p Segmented 1|2, optimizer select, shots input, penalty sliders (same_slot, adjacent_same_day, same_day) with mono values and a reset link, and primary button 'Run (r)'. On run: POST quantum, show Stepper (Extract > QUBO > Circuit > Optimize > Sample > Repair > Decide) driven by job.stage, plus a live Recharts line chart of energy_trace vs iteration (accent line, flat tooltip, direct label at line end, dashed text2 line for the brute-force ground energy once known). On done: GET result and render (a) a decision Panel with left border ok (accepted) or warn (fallback) containing FinalDecision.reason verbatim and Stat row (before score, after score, resolved students, hard violations, feasible fraction); (b) a bitstring histogram of top_bitstrings (feasible bars accent, infeasible bars text3; x labels mono truncated with hover title); (c) a diff table (course, from slot, to slot). Add Publish button calling POST /publish. All states handled: idle, running, error (server message), done.
```

## C4 (H22-28): Benchmarks page
**Prompt:**
```
Build page Benchmarks (/benchmarks) from GET /runs/{id}/benchmarks: a sortable DataTable (method, cluster size, objective mean, approx ratio mean +/- std, feasible %, runtime, depth, 2q gates), grouped bar chart of approximation ratio per method per cluster size (QAOA series accent, classical series text2 shades), line chart of depth and 2q gates vs p, line chart of approximation ratio vs noise scale, and an 'IBM hardware run' Panel (backend name, qubits, queue time, transpiled depth, 2q gates, approx ratio, job id in mono, link that opens the raw JSON in a CodeBlock drawer). Write a one-sentence honest summary line computed from the data (e.g. 'QAOA p=1 reached 0.91 of optimum on 12-qubit clusters; brute force and CP-SAT reached 1.00'). Never hide failed runs: show a failed count column. Export CSV button and a /benchmarks/print route styled for paper (light theme, no chrome). No placeholder numbers anywhere: if data is missing show an EmptyState with the command to generate it ('make bench').
```

## C5 (H28-32): polish and checklist
**Prompt:**
```
Run the 'Anti-generic checklist' in docs/DESIGN_SYSTEM.md against every page. For each failure, list it and fix it. Then: add empty/error/loading states everywhere, focus rings, tab order, ? shortcut sheet, light theme parity, verify 1440x900 and 1280x720 layouts with no horizontal page scroll, remove all console warnings, ensure fonts load offline, and run tsc --noEmit and vitest. Replace any vague copy with specific, factual copy. Show a list of changes grouped by page.
```
Refinement prompt for any screen that still feels generic:
```
Review this screen against docs/DESIGN_SYSTEM.md. List every element that looks like a default component-library or AI-generated pattern (equal-padded rounded cards, centered headings, decorative icons, vague copy). Replace each with denser table-like or inline-stat layouts, tighten spacing to the 4px grid, make all numerics mono and right-aligned, and rewrite microcopy to be specific and factual. Give a before/after summary.
```

## C6 (H32-36): demo and slides
**Prompt:**
```
Using docs/DEMO.md as the spine, fill in the real measured numbers from the running system (baseline solve seconds, affected students, decision text, benchmark ratios, IBM backend and gate counts). Produce docs/DEMO.md final script with exact click paths, plus slides/outline.md with 6 slides (problem, why hybrid with a 4-row comparison, architecture diagram description, live demo, benchmark honesty with the table, roadmap) and speaker notes under 40 words per slide. Add a 'Load cached run' button to the UI top bar if the API supports /cache-load. Then rehearse: list the three most likely failure points and the exact recovery action for each.
```
