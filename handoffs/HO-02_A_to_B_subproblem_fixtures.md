# HO-02: A -> B: SubProblem fixtures  (tiny at H3, real at H12)

## Delivered
- [x] H3: `data/fixtures/subproblem_6.json`, `subproblem_12.json` (hand-built but consistent), validated against `schemas.py`
- [x] H12: real SubProblems from the demo dataset via `extract_clusters` (`runs/<id>/clusters.json`, copy to `data/fixtures/real_cluster_*.json`)
- [x] `baseline_cluster_cost` equals the all-zeros energy per `docs/QUBO_SPEC.md`

## Verify
```
pytest backend/tests/test_schemas.py backend/tests/test_extractor.py -q
python - <<'PY'
import json; sp=json.load(open('data/fixtures/subproblem_12.json'))
print(len(sp['courses']), {c:sp['candidates'][c] for c in sp['courses'][:2]})
PY
```

## Known limits
Fixtures use default penalty table. Real clusters may have fewer than 12 courses after dropping courses with no valid candidate B.

## B's first prompt
```
Load data/fixtures/subproblem_12.json with backend.schemas.SubProblem. Compute the all-zeros energy with backend.quantum.qubo.energy and assert it equals baseline_cluster_cost within 1e-9; if not, report the exact discrepancy (formula difference) to A instead of editing the fixture.
```
