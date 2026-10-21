# HO-05: B -> C (and A): hardware run and benchmarks  (target H28)

## Delivered
- [x] `runs/hardware/<ts>.json` with backend, qubits, job_id, queue_seconds, depth, two_qubit_gates, params, counts
- [x] `benchmarks/results.csv`, `benchmarks/results.md`, `benchmarks/figs/*.png`
- [x] Honest summary paragraph in `benchmarks/results.md` (numbers, mean/std, failed count: 0)
- [x] Hardware run decoded through `decide()` once (`benchmarks/hardware_decision.json`)

## Verify
```
ls runs/hardware/ benchmarks/figs/
head -5 benchmarks/results.csv
curl -s localhost:8000/api/runs/mock/benchmarks | python -m json.tool | head -40
```

## Known limits
Physical hardware run executed on `ibm_fez` (156 qubits, job ID `dbce3avi0auc73dupdpg`, queue 39.60s, run 55.90s, depth 110, 50 CX gates). Variational parameters were trained on ideal statevector simulation (p=1). Physical hardware achieved approximation ratio 1.0000 (ground energy 110.0, top bitstring `001110` with count 210/4096). Under dense conflict topologies ($N=12$), two-qubit CX counts exceed 200, causing output dispersion under physical depolarizing noise.

## C's first prompt
```
Read benchmarks/results.csv and the newest file in runs/hardware/. Verify the Benchmarks page renders every column and the IBM run Panel with no placeholder values. Fix any display issue (units, rounding to 2 decimals, long job ids truncated with hover). Add a visible 'Data source' line with the file name and timestamp under each chart.
```
