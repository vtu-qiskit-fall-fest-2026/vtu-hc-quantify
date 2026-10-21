# QUANTA Vibe-Coding Kit

Quantum-Assisted Timetabling & Allocation: hybrid CP-SAT + QAOA exam scheduler. This kit is everything three people and their AI agents need to build it in 36 hours.

## How to use this kit
1. Create the repo `quanta/` and copy this entire folder's contents into its root (so `AGENTS.md` sits at the root and `docs/`, `tasks/`, `handoffs/` beside it).
2. Run `ln -s AGENTS.md CLAUDE.md` (Claude Code reads CLAUDE.md). For Cursor, copy AGENTS.md into `.cursor/rules/quanta.mdc`.
3. All three members read, in order: `docs/PRD.md` -> `docs/ARCHITECTURE.md` -> `docs/CONTRACTS.md` -> `docs/PLAN_36H.md` (20 min total).
4. Each member then opens their task file: `tasks/A_backend.md`, `tasks/B_quantum.md`, `tasks/C_frontend.md`. Paste prompts one at a time into your agent.
5. When a task finishes, fill the matching `handoffs/HO-xx.md` and tick it in `STATUS.md`.

## File map
| File | Purpose |
|---|---|
| `AGENTS.md` | Standing rules every AI agent loads automatically |
| `STATUS.md` | Live tracker: tasks, handoffs, blockers (update every 2-3 h) |
| `docs/PRD.md` | Problem, users, scope tiers, definition of done |
| `docs/ARCHITECTURE.md` | Lean 36 h architecture and what was cut |
| `docs/CONTRACTS.md` | Schemas, API, module interfaces (frozen at H2) |
| `docs/QUBO_SPEC.md` | Exact math: QUBO, Ising, QAOA, bit order, tests |
| `docs/DESIGN_SYSTEM.md` | Non-generic UI design system and screens |
| `docs/PLAN_36H.md` | Hour-by-hour plan, roles, sleep, checkpoints |
| `docs/TESTING.md` | Test strategy and acceptance checks |
| `docs/DEMO.md` | Demo script, fallbacks, slide outline |
| `docs/PROMPT_PLAYBOOK.md` | How to drive agents, debug prompts, polish prompts |
| `docs/RISKS.md` | Risks and mitigations |
| `docs/RESOURCES.md` | Docs, datasets, tools |
| `tasks/*.md` | Per-member tasks with exact agent prompts |
| `handoffs/*.md` | Handoff template, six pre-written handoffs, log |

## Corrections to the original proposal (already applied in this kit)
- One qubit per course (slot A or slot B) instead of one-hot over all slots: 12 courses = 12 qubits.
- Unpinned install then lock (`qiskit-aer 0.15` does not match Qiskit 2.x).
- IBM backend chosen at runtime, never hardcoded.
- Own ~80-line QAOA with `QAOAAnsatz` + primitives, not `qiskit-algorithms`.
- Celery/Redis/Postgres/JWT cut for the hackathon; they remain on the roadmap slide.
- Honest claim: pipeline, safety fallback and benchmarking, not quantum advantage.
