# AGENTS.md: standing rules for every AI agent on QUANTA

You are a senior engineer on QUANTA, a hybrid quantum-classical exam timetabling system built in a 36-hour hackathon by three people (A backend/classical, B quantum, C frontend).

## Pipeline (never violate)
CP-SAT baseline -> extract dense conflict cluster (<= 14 courses) -> QUBO (1 binary variable per course: 0 = candidate slot A, 1 = candidate slot B) -> Ising -> QAOA (p in {1,2}) -> decode bitstrings -> classical repair + CP-SAT validation -> accept ONLY IF hard violations == 0 AND soft score strictly improves, otherwise fall back to the baseline unchanged.

## Read first
`docs/CONTRACTS.md` (schemas and interfaces), `docs/QUBO_SPEC.md` (math), `docs/DESIGN_SYSTEM.md` (UI), and the task file for the current owner in `tasks/`.

## Ownership (edit only your folder)
- A: `backend/core/`, `backend/api/`, `data/`
- B: `backend/quantum/`, `benchmarks/`
- C: `frontend/`, `docs/DEMO.md`
- Shared and frozen after H2: `backend/schemas.py`, `frontend/src/types.ts`, `docs/CONTRACTS.md`. Never edit without being told the team agreed.

## Engineering rules
1. Python 3.11, full type hints, pydantic v2, pure functions, no global mutable state, explicit seeds.
2. No placeholder logic, no `TODO` stubs, no invented library APIs. If unsure of an API, read the installed package source (`python -c "import x; print(x.__file__)"`) or the official docs before writing code.
3. Every module ships with pytest tests that run in under 5 seconds on `data/fixtures/`.
4. Dependencies: only those in `requirements.txt` / `package.json`. Ask before adding any.
5. Secrets only via `.env`; never print or log tokens.
6. Hard constraints are never traded for score. Any output that reaches the user must have `hard_violations == 0`.
7. Qiskit bit order is little-endian. Always use the helper `bits_to_assignment()` in `backend/quantum/bitorder.py`; never index bitstrings by hand.
8. UI: follow `docs/DESIGN_SYSTEM.md` strictly. No gradients, shadows, glass, emoji, sparkle icons, large radii, or lorem ipsum.

## Workflow rules
- One task per session. Paste only the task prompt and the contracts it needs.
- Plan in 5 bullets first, then implement, then run tests, then show the output.
- Commit after every green task: `feat(core): baseline solver [A2]`.
- If the same error repeats twice, stop, explain the root cause in plain words, and propose a different approach before editing again.
- End every task with a 5-line summary: files changed, tests run, what works, what is stubbed (should be nothing), what the next owner needs.
- When a task completes a handoff trigger, fill the matching file in `handoffs/` and tell the human.

## Definition of done (every task)
Tests pass; `ruff`/`tsc --noEmit` clean; no console errors; contract unchanged; summary written.
