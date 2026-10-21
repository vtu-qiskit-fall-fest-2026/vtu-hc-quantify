# HO-04: A -> C: real API live  (target H14)

## Delivered
- [x] `make dev` runs API (:8000, no mock) and serves real baseline, extract, quantum (ideal), decision
- [x] `/runs/{id}/benchmarks` returns real rows (may be empty until B6; return `rows: []`, not an error)
- [x] Error format `{error:{code,message}}` verified on bad CSV upload
- [x] `scripts/e2e.py` passes on the mini dataset

## Verify
```
make dev &   # API without QUANTA_MOCK
python scripts/e2e.py --dataset mini --backend ideal
curl -s localhost:8000/api/health   # {"mock": false}
```

## Known limits
IBM backend may be unavailable until B4. Baseline on the demo dataset can take up to the time limit (60 s); UI must show the elapsed timer.

## C's first prompt
```
Turn off mock mode in the frontend dev setup (VITE_API_URL stays the same, API is now real). Walk through Dataset -> Timetable -> Cluster Lab with the mini dataset and then the demo dataset. List every contract mismatch or UI break you see (with endpoint, payload and console error) and fix frontend-side issues; send API-side issues to A as a numbered list in STATUS.md Blockers.
```
