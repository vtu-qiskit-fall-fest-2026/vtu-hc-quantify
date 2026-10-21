# RESOURCES

## Classical
- OR-Tools CP-SAT: developers.google.com/optimization/cp (scheduling, nurse rostering, and CP-SAT primer pages are the closest patterns)
- NetworkX: networkx.org/documentation (k_core, density, greedy modularity, subgraph)
- Exam timetabling datasets for realism: Carter/Toronto benchmark set, ITC 2007 Examination Track

## Quantum
- IBM Quantum Platform docs: quantum.cloud.ibm.com/docs (primitives V2, runtime job mode, transpilation presets, QAOA tutorials)
- Qiskit SDK docs: quantum.cloud.ibm.com/docs/api/qiskit (QAOAAnsatz, StatevectorEstimator/Sampler, transpiler)
- Qiskit Optimization: qiskit-community.github.io/qiskit-optimization (QuadraticProgram, to_ising)
- Qiskit Aer noise: qiskit.github.io/qiskit-aer
- QAOA background: Farhi, Goldstone, Gutmann (2014) "A Quantum Approximate Optimization Algorithm"; Lucas (2014) "Ising formulations of many NP problems"
- Check versions after install: `pip freeze | grep -i -E "qiskit|ortools"`

## Frontend
- React, Vite, TypeScript: vite.dev, react.dev
- Tailwind: tailwindcss.com/docs
- TanStack Table: tanstack.com/table
- Recharts: recharts.org
- d3-force: d3js.org/d3-force
- papaparse: papaparse.com
- Lucide: lucide.dev
- IBM Plex fonts: fontsource.org/fonts/ibm-plex-sans, fontsource.org/fonts/ibm-plex-mono
- Data-dense pattern reference: carbondesignsystem.com (data table, data visualization sections)

## Tools for vibe coding
- Claude Code (terminal agent): best for multi-file backend work, reads CLAUDE.md
- Cursor: best for inline UI iteration, reads `.cursor/rules`
- Git worktrees (optional): `git worktree add ../quanta-b b/main` so each member's agent has its own checkout

## Setup commands (cheat sheet)
```
python -m venv .venv && source .venv/bin/activate
pip install ortools networkx scipy numpy pandas qiskit qiskit-optimization qiskit-aer qiskit-ibm-runtime fastapi "uvicorn[standard]" pydantic sqlalchemy python-multipart pytest ruff matplotlib
pip freeze > requirements.lock
npm create vite@latest frontend -- --template react-ts
cd frontend && npm i tailwindcss @tanstack/react-table recharts d3-force papaparse lucide-react react-router-dom zustand @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono && npm i -D vitest
```
