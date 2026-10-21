# QUBO / ISING / QAOA SPEC (owner: B)

## 1. Variables
For cluster course c: `x_c in {0,1}`. `slot_c(0) = A_c` (current baseline slot), `slot_c(1) = B_c` (best alternative). Qubit index i = position of c in `SubProblem.courses`. n = len(courses) <= 14.

## 2. Slot relation and penalty
```
rel(s, t):  s == t                         -> 'same_slot'
            same day and |order_s - order_t| == 1 -> 'adjacent_same_day'
            same day                       -> 'same_day'
            else                           -> 'none'
pen(rel) = penalty_table[rel]    # defaults: 1000 / 10 / 1 / 0 (override via QuantumConfig.penalty_overrides)
```

## 3. Cost function (minimize)
```
E(x) = sum_{(c,d) in pair_weights} n_cd * pen(rel(slot_c(x_c), slot_d(x_d)))
     + sum_{c} sum_{k in fixed_neighbors(c)} n_ck * pen(rel(slot_c(x_c), slot_k))
     + lambda_cap * sum_{(c,d)} [x_c, x_d put both into the same slot t and size_c + size_d > spare_t]   # optional, default 0
```
The capacity term is a pairwise approximation; triples are caught by classical validation. Capacity and room assignment are authoritative in `validate()`, never in the QUBO.

## 4. Expansion to QUBO coefficients
Pair term with f_ab = n_cd * pen(rel(slot_c(a), slot_d(b))):
```
f(xc,xd) = f00 + (f10 - f00) xc + (f01 - f00) xd + (f00 - f01 - f10 + f11) xc xd
```
Fixed-neighbor term with g(a) = n_ck * pen(rel(slot_c(a), slot_k)):  `g(0) + (g(1) - g(0)) xc`.
Accumulate constants into `offset`, linear into `linear[c]`, quadratic into `quad[(c,d)]` (c<d). Build a `qiskit_optimization.QuadraticProgram` with n binary vars and `minimize(constant=offset, linear=..., quadratic=...)`.

## 5. Ising
Substitute `x = (1 - Z) / 2`. Use `QuadraticProgram.to_ising()` if present in the installed qiskit-optimization; otherwise implement manually:
```
linear a_i x_i      -> a_i/2 (I - Z_i)
quad   b_ij x_i x_j -> b_ij/4 (I - Z_i - Z_j + Z_i Z_j)
```
Return `(SparsePauliOp, offset)`. **Test (mandatory):** for every x in {0,1}^n, `<x|H|x> + offset == E(x)` within 1e-9, on both fixtures.

## 6. Bit order (the #1 bug source)
Qiskit measurement strings are little-endian: the rightmost character is qubit 0. `bitorder.py` provides:
```python
def bits_to_assignment(bitstring: str) -> list[int]:  # returns [x_0, x_1, ..., x_{n-1}] with x_i for qubit i
    return [int(ch) for ch in reversed(bitstring)]
def assignment_to_bits(x: list[int]) -> str: return ''.join(str(v) for v in reversed(x))
```
`QuantumResult.top_bitstrings[].bits` stores the normalized string where `bits[i]` is course i (i.e., already reversed). Test: for a random QUBO, the most-sampled bitstring after training maps to an energy equal to `E(bits_to_assignment(raw))` computed classically.

## 7. QAOA (own implementation)
- Ansatz: `QAOAAnsatz(cost_operator=H, reps=p)` (mixer default X). Initial state |+>^n.
- Optimization loop: `StatevectorEstimator().run([(ansatz, H, params)])` -> expectation (add offset when logging). Optimizer: `scipy.optimize.minimize(method='COBYLA', options={'maxiter': cfg.maxiter})`, or own SPSA (a=0.2, c=0.1, A=maxiter/10, alpha=0.602, gamma=0.101).
- Init: gamma in U[0, pi], beta in U[0, pi/2]. `restarts` random starts (default 5), keep best final energy. Seeded with `np.random.default_rng(cfg.seed)`.
- `energy_history`: expectation + offset on every function evaluation of the best restart.
- Sampling: add measurements, `StatevectorSampler` (ideal) with `shots`, normalize bit order, attach classical energy via the QUBO.
- Ground truth: `brute_force(qubo)` enumerates 2^n states with numpy (n<=14 is 16,384 states, instant). `approx_ratio = (E_max - E_best_sampled) / (E_max - E_min)` using the full energy range so 1.0 = found the optimum, and also report `ground_energy`.
- Circuit metrics: `transpile(circ, basis_gates=['cx','rz','sx','x'], coupling_map=heavy_hex_like or backend, optimization_level=3)`; record `depth()` and `count_ops().get('cx',0) + count_ops().get('ecr',0)`.

## 8. Noisy simulation (noise.py)
`NoiseModel` with depolarizing 1e-3 (1q), 1e-2 (2q), thermal relaxation T1=120us T2=90us (gate times 50ns / 400ns), readout error 2%. Scale factor `noise_scale` multiplies error rates. At n=12 do not re-optimize under noise: evaluate fixed ideal parameters. Report ratio vs noise scale in {0, 0.5, 1, 2}.

## 9. IBM hardware (ibm.py)
```python
service = QiskitRuntimeService(channel='ibm_quantum_platform', token=os.environ['IBM_QUANTUM_TOKEN'], instance=os.getenv('IBM_QUANTUM_INSTANCE'))
backend = service.least_busy(operational=True, simulator=False, min_num_qubits=n)
pm = generate_preset_pass_manager(backend=backend, optimization_level=3)
isa = pm.run(circuit_with_measurements_and_bound_params)
sampler = SamplerV2(mode=backend)   # job mode on open plan
job = sampler.run([isa], shots=cfg.shots)
```
Verify the exact `channel` string and constructor arguments against the installed qiskit-ibm-runtime docs before use (they have changed across releases). `fake_ibm` uses `qiskit_ibm_runtime.fake_provider` with `AerSimulator.from_backend(fake)` so the entire code path is testable offline. Persist `queue_seconds`, `job_id`, and raw counts to `runs/hardware/`.

## 10. Repair semantic (A implements, B must understand)
Decoded changes = courses with x_c = 1. `validate()` reapplies them to the baseline and checks: no student clash in a slot, slot total enrollment within allotted room capacity, room assignment solvable. Repair flips the offending course with the lowest cost increase back to slot A until feasible or gives up. Accept only if feasible and soft score strictly decreases.

## 11. Acceptance tests (B)
1. Ising equivalence on all states (fixtures 6 and 12 qubits).
2. p=1, 6 qubits: approx_ratio >= 0.85, fixed seed.
3. Bit-order test described in section 6.
4. `run_quantum` with backend `fake_ibm` returns a valid QuantumResult in < 60 s.
5. No import of ortools anywhere in `backend/quantum/`.
