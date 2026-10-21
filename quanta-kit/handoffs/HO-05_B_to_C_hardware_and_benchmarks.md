# HO-05: B -> C (and A): hardware run and benchmarks  (target H28)

## Delivered
- [ ] `runs/hardware/<ts>.json` with backend, qubits, job_id, queue_seconds, depth, two_qubit_gates, params, counts
- [ ] `benchmarks/results.csv`, `benchmarks/results.md`, `benchmarks/figs/*.png`
- [ ] Honest summary paragraph in `benchmarks/results.md` (numbers, mean/std, failed count)
- [ ] Hardware run decoded through `decide()` once (screenshot or JSON of FinalDecision)

## Verify
```
ls runs/hardware/ benchmarks/figs/
head -5 benchmarks/results.csv
curl -s localhost:8000/api/runs/mock/benchmarks | python -m json.tool | head -40
```

## Known limits
Hardware run used p=__ with parameters trained on the ideal simulator. Approx ratio on hardware = __ (vs ideal __). Say this plainly in the demo.

## C's first prompt
```
Read benchmarks/results.csv and the newest file in runs/hardware/. Verify the Benchmarks page renders every column and the IBM run Panel with no placeholder values. Fix any display issue (units, rounding to 2 decimals, long job ids truncated with hover). Add a visible 'Data source' line with the file name and timestamp under each chart.
```
