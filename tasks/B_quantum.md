# MEMBER B: Quantum + benchmarks

Agent: Claude Code recommended. Load `AGENTS.md` and `docs/QUBO_SPEC.md`. Work only in `backend/quantum/` and `benchmarks/`. Test against `data/fixtures/subproblem_6.json` and `subproblem_12.json` from A until A3 ships real ones.

## B0 (H0-2): accounts and environment
Create the IBM Quantum Platform account, generate an API key, put `IBM_QUANTUM_TOKEN=` (and `IBM_QUANTUM_INSTANCE=` if required) in `.env` (never commit). Verify:
```
python -c "import qiskit, qiskit_aer, qiskit_ibm_runtime, qiskit_optimization; print(qiskit.__version__)"
python - <<'PY'
from qiskit_ibm_runtime import QiskitRuntimeService
s = QiskitRuntimeService()   # after saving the account per current IBM docs
print([b.name for b in s.backends()][:10])
PY
```
Record available backends, qubit counts and open-plan quota in `STATUS.md`.

## B1 (H2-6): QUBO, Ising, brute force
**Prompt:**
```
Read docs/QUBO_SPEC.md sections 1-6 and docs/CONTRACTS.md. In backend/quantum/qubo.py implement build_qubo(sp: SubProblem, cfg: QuantumConfig) -> QuadraticProgram using the exact expansion in section 4 (including fixed-neighbor linear terms, optional pairwise lambda_cap term, penalty_overrides). Implement energy(sp, cfg, x: list[int]) as an independent direct evaluation of the cost function (no QuadraticProgram) so we can cross-check. Implement to_ising(qp) -> (SparsePauliOp, offset): use QuadraticProgram.to_ising if it exists in the installed qiskit-optimization, else the manual conversion in section 5. Implement brute_force(sp, cfg) -> dict with ground_x, ground_energy, max_energy, all energies as a numpy array indexed by integer assignment. Create backend/quantum/bitorder.py with bits_to_assignment and assignment_to_bits per section 6. Tests: (1) for all 2^n states on both fixtures QUBO objective == energy() == <x|H|x> + offset within 1e-9; (2) brute_force ground state equals argmin of energy(); (3) bitorder round-trip. Run tests and show output; state which to_ising path was used.
```

## B2 (H6-10): ideal QAOA
**Prompt:**
```
Read docs/QUBO_SPEC.md section 7. In backend/quantum/qaoa.py implement run_qaoa_ideal(sp, cfg, progress_cb) -> QuantumResult. Use QAOAAnsatz from qiskit.circuit.library with reps=cfg.p, qiskit.primitives.StatevectorEstimator for expectation values, scipy.optimize.minimize(COBYLA, maxiter=cfg.maxiter) with cfg.restarts random starts (gamma ~ U[0,pi], beta ~ U[0,pi/2]) seeded by np.random.default_rng(cfg.seed); also implement a small SPSA optimizer selectable with cfg.optimizer. Record energy_history (expectation + offset per evaluation of the best restart) and call progress_cb('optimize', fraction, energy) at every evaluation. After optimizing, bind parameters, add measure_all, sample with StatevectorSampler at cfg.shots, normalize to bits[i]=course i via bitorder, compute energy of each bitstring with energy(), keep the top 32 by count. Compute ground_energy via brute_force and approx_ratio = (E_max - E_best_sampled)/(E_max - E_min). Transpile the bound circuit with basis_gates=['cx','rz','sx','x'], optimization_level=3 and a heavy-hex-like coupling map (use qiskit.transpiler.CouplingMap.from_heavy_hex or a line map; document which) and record depth and two_qubit_gates and transpile_seconds. Tests: p=1 on the 6-qubit fixture gets approx_ratio >= 0.85 with seed fixed; p=2 is not worse than p=1 on average over 3 seeds (report numbers; if it is worse, say so and don't hide it); bit-order test from section 6. Runtime for 12 qubits p=2 must be under 90 s; if not, reduce restarts adaptively and report.
```

## B3 (H10-14): noisy simulation
**Prompt:**
```
In backend/quantum/noise.py build make_noise_model(scale: float) with qiskit_aer.noise: depolarizing 1e-3 on 1-qubit gates and 1e-2 on 2-qubit gates, thermal relaxation T1=120us T2=90us with gate times 50ns/400ns, readout error 2%, all error rates multiplied by scale. Implement run_qaoa_noisy(sp, cfg, ideal_result, progress_cb): reuse ideal_result.params (do NOT re-optimize), transpile for an AerSimulator with the noise model and the basis gates, sample with SamplerV2 from qiskit_aer.primitives at cfg.shots, normalize bitstrings, attach energies, compute approx_ratio and metrics. Add noise_sweep(sp, cfg, ideal_result, scales=(0,0.5,1,2)) returning a list of {scale, approx_ratio, mean_energy, feasible_hint}. Tests: scale 0 reproduces the ideal distribution within sampling error (TVD < 0.1); ratio at scale 2 <= ratio at scale 0 (average of 3 seeds). Report numbers.
```

## B4 (H14-24): IBM hardware (submit the first job by H20)
**Prompt:**
```
Read docs/QUBO_SPEC.md section 9 and the INSTALLED qiskit-ibm-runtime documentation or source for the exact QiskitRuntimeService constructor and SamplerV2 usage (verify argument names; do not guess). In backend/quantum/ibm.py implement run_qaoa_ibm(sp, cfg, ideal_result, progress_cb, dry_run=False): select the backend with service.least_busy(operational=True, simulator=False, min_num_qubits=n); build the pass manager with generate_preset_pass_manager(backend=backend, optimization_level=3); bind ideal_result.params, add measure_all, run the pass manager, submit SamplerV2 in job mode with shots=cfg.shots; poll status calling progress_cb('queue', ...) then ('sample', ...); on completion normalize bitstrings, attach energies, compute metrics, queue_seconds from job metrics when available. Persist raw counts, backend name, num_qubits, job_id, params, depth, 2q gate count, queue and run seconds to runs/hardware/<UTC-timestamp>.json. dry_run=True (and cfg.backend=='fake_ibm') uses a FakeBackend from qiskit_ibm_runtime.fake_provider with AerSimulator.from_backend so the whole path runs offline. Never print the token; read it from the environment. Add scripts/submit_hardware.py CLI (--fixture subproblem_12 --p 1 --shots 4096 [--dry-run]) and run the dry run now, then submit one real job and report the job id. Tests: dry-run path returns a valid QuantumResult; missing token raises a clear error.
```
**Tips:** optimize on the ideal simulator, sample on hardware; one 12-qubit p=1 job with 4096 shots is enough; keep a second job for p=2 only if quota remains.

## B5 (H12-16): public interface  (triggers HO-03)
**Prompt:**
```
Create backend/quantum/interface.py with run_quantum(sp, cfg, progress_cb) -> QuantumResult exactly as in docs/CONTRACTS.md section 4. Dispatch: 'ideal' -> run_qaoa_ideal; 'noisy' -> run ideal then run_qaoa_noisy; 'fake_ibm' -> ideal then run_qaoa_ibm(dry_run=True); 'ibm' -> ideal then run_qaoa_ibm. Always call progress_cb with stages qubo, ising, circuit, optimize, sample, transpile, queue, done (queue only for ibm). Catch hardware errors and raise QuantumBackendError with a readable message. Guarantee the function is thread-safe (no module-level mutable state) and cancels cleanly. Write tests/test_interface.py running every backend except 'ibm' on subproblem_6. Then write handoffs/HO-03.md results (fill the template: signature, example call, timing table, known limits).
```

## B6 (H20-28): benchmark harness  (triggers HO-05)
**Prompt:**
```
In benchmarks/run_benchmarks.py build 10 seeded clusters for each size in (6, 8, 10, 12) using backend.core.extractor on datasets generated with different seeds (fall back to random synthetic SubProblems with the same structure if the extractor is not ready; mark clearly which). For each cluster run: brute_force (ground truth), cpsat on the same QUBO objective (ortools CP-SAT with boolean variables), simulated annealing (own implementation, 200 restarts, fixed seed), QAOA ideal p=1, p=2, QAOA noisy p=1, and merge the saved hardware run(s). Write benchmarks/results.csv with BenchmarkRow columns, a Markdown table benchmarks/results.md with mean and std per (size, method), and PNGs in benchmarks/figs/: approx ratio by method; depth and 2q gates vs p; ratio vs noise scale. Never drop failed runs: include a failed column and count. Print an honest summary paragraph: where QAOA matches, trails or beats the baselines, with numbers. Add `make bench`. Runtime budget: under 25 minutes; parallelize with multiprocessing if needed.
```
