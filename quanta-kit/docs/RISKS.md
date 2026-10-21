# RISKS

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | IBM queue long or backend down | High | High | Submit first real job by H20; `fake_ibm` path; demo replays saved JSON; say so openly | B |
| 2 | CP-SAT too slow on 180 courses | Med | High | Aggregate pair conflicts; greedy hint; 60 s limit with best feasible; cached baseline | A |
| 3 | Bit-order bug silently inverts results | High | High | Mandatory bit-order test; single helper module; grep for manual indexing | B |
| 4 | QAOA below baseline | High | Med | That is expected and is the fallback working; present honestly with brute-force reference | B/C |
| 5 | Contract drift between A, B, C | High | High | Frozen CONTRACTS.md; fixture-validated tests; vote log in STATUS.md | All |
| 6 | Candidate slot B invalid (capacity) | Med | Med | Extractor filters by spare capacity and clashes; repair + validation catch the rest | A |
| 7 | Library versions mismatch (Qiskit 2.x, aer, runtime) | Med | High | Unpinned install at H0-2, `requirements.lock`, pip freeze committed | A/B |
| 8 | UI looks generic | Med | Med | Design system tokens, anti-generic checklist, refinement prompt | C |
| 9 | Agent hallucinated API | Med | Med | AGENTS.md rule 2, inspect installed source, tests | All |
| 10 | Burnout / sleep debt | High | High | Sleep plan in PLAN_36H.md, freeze at H32 | All |
| 11 | Demo-day failure (network, laptop) | Med | High | Cached runs, recording, offline fonts, two browsers | C |
| 12 | Over-claiming | Med | High | Honest-claims section, no 'advantage' language | All |

## Honest-claims statement (use in README and slides)
QUANTA demonstrates a safe hybrid integration pattern. On 12-qubit clusters QAOA is expected to match, not beat, classical baselines; the project's contribution is the decomposition, the guaranteed-feasibility fallback, and a reproducible benchmark harness that shows when quantum hardware begins to help.
