# HO-03: B -> A: `run_quantum` interface  (target H14)

## Delivered
- [x] `backend/quantum/interface.py::run_quantum(sp, cfg, progress_cb) -> QuantumResult`
- [x] Backends working: ideal, noisy, fake_ibm (ibm ready for physical hardware submission)
- [x] Stages emitted: qubo, ising, circuit, optimize, sample, transpile, queue(ibm only), done
- [x] Timings table (12 qubits): ideal p=1 2.18 s, p=2 1.90 s, noisy 7.81 s, fake_ibm 21.08 s
- [x] Thread-safe, no global state, raises `QuantumBackendError` with readable message

## Signature
```python
from backend.quantum.interface import run_quantum, QuantumBackendError
qr = run_quantum(sp, QuantumConfig(backend='ideal', p=1, seed=7), progress_cb=lambda stage, frac, energy: None)
```
`top_bitstrings[i].bits[j]` is course `sp.courses[j]` (already normalized, little-endian handled).

## Verify
```
pytest backend/tests/test_interface.py -q
python -c "import json;from backend.schemas import *;from backend.quantum.interface import run_quantum;sp=SubProblem(**json.load(open('data/fixtures/subproblem_6.json')));print(run_quantum(sp,QuantumConfig(backend='ideal'),lambda *a:None).approx_ratio)"
```

## Known limits
IBM hardware runs take minutes due to cloud queuing; API must treat them as long asynchronous jobs. Noisy simulation on Aer at 12 qubits takes 7.81 s; offline FakeAuckland takes 21.08 s.

## A's first prompt
```
Wire backend.quantum.interface.run_quantum into the quantum job in backend/api: lazy import, pass a progress_cb that updates the job row (stage, progress, energy_trace append), then call decide() with the returned QuantumResult and store both artifacts. If run_quantum raises QuantumBackendError return job status 'error' with the message. Add an API test using backend='ideal' on the mini dataset.
```
