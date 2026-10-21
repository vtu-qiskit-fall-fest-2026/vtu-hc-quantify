# PROMPT PLAYBOOK: driving AI agents without losing hours

## Session hygiene
1. One task per session. New task, new session (or `/clear`).
2. Open with: "Read AGENTS.md, then docs/<relevant>.md, then do task X." Do not paste the whole kit.
3. Make the agent plan in 5 bullets and wait for "go". Skim the plan for contract violations; this takes 30 seconds and saves 30 minutes.
4. Require tests and shown output before it claims done.
5. Commit after each green task. If it goes wrong, `git reset --hard` beats arguing.
6. Keep the agent in its folder. If it wants to edit `schemas.py`, stop it and raise a contract change.
7. Every ~90 minutes, ask a fresh agent to review the last hour of diffs.

## Prompt skeleton
```
Context: [one sentence about where this fits in the pipeline]
Read: [files]
Task: [exact deliverable, file paths, function signatures]
Constraints: [from AGENTS.md that matter most here]
Tests: [what must pass, with numbers]
Output: plan first (5 bullets), then code, then run tests, then 5-line summary.
```

## Debug prompts
**Stuck on an error (after the same error twice):**
```
Stop editing. Paste of the full traceback is below. In plain words: (1) what is the root cause, (2) which assumption we made was wrong, (3) two different fixes with trade-offs. Do not change code until I pick one.
```
**Library API unsure:**
```
Do not guess the API. Run `python -c "import <pkg>, inspect; print(<pkg>.__version__, <pkg>.__file__)"`, read the relevant source or docstring of <symbol>, and show me the exact signature before writing code.
```
**Suspect a bit-order bug:**
```
Write a 3-qubit test where the optimal assignment is x=[1,0,0]. Run QAOA ideal, print the raw most frequent bitstring, bits_to_assignment() output, and the classical energy of both interpretations. Explain which is right and fix bitorder usage everywhere with grep.
```
**QAOA does not converge:**
```
Plot energy_history for 5 seeds, print final expectation vs ground energy, try (a) rescaling the Hamiltonian by dividing coefficients by max abs coefficient, (b) gamma init range [0, pi/max_coeff], (c) more restarts. Report which helps with numbers. Do not change the QUBO.
```
**Solver too slow:**
```
Profile the CP-SAT model: print number of variables and constraints, solve log, and best bound. Propose reductions (pair-conflict aggregation instead of per-student variables, symmetry breaking on rooms, greedy hint, time limit with best feasible). Implement the one with the best expected gain and re-measure.
```
**Review a diff:**
```
Review the last N commits for: contract violations (docs/CONTRACTS.md), places where hard_violations could be > 0 in an output, untested branches, swallowed exceptions, hardcoded backend names or secrets. List findings by severity with file:line. Do not fix yet.
```
**Frontend visual bug:**
```
Describe what you expect from docs/DESIGN_SYSTEM.md for this component, inspect the rendered DOM and computed styles, and list each deviation (font, size, spacing, color token, radius). Fix deviations only; no new features.
```

## Anti-patterns
- Pasting whole files into chat instead of paths.
- Letting two agents edit the same folder.
- Accepting "should work" without test output.
- Adding features after H32.
- Letting the UI agent invent API fields; types come from CONTRACTS.md.
