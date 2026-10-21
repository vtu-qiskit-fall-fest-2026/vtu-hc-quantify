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
Physical hardware runs executed on `ibm_fez` (job ID `dbce3avi0auc73dupdpg`, queue 39.60s, run 55.90s, depth 110, 50 CX) and `ibm_kingston` (job ID `dbcfb3vi0auc73durnc0`, queue 9.47s, run 27.19s, depth 65, 20 CX) on Heron/Eagle 156-qubit QPUs. Both achieved approximation ratio 1.0000. Variational parameters were trained on ideal statevector simulation (p=1). Under dense conflict topologies ($N=12$), two-qubit CX counts exceed 200, causing output dispersion under physical depolarizing noise.

## C's first prompt
```
Read benchmarks/results.csv and the newest file in runs/hardware/. Verify the Benchmarks page renders every column and the IBM run Panel with no placeholder values. Fix any display issue (units, rounding to 2 decimals, long job ids truncated with hover). Add a visible 'Data source' line with the file name and timestamp under each chart.
```
