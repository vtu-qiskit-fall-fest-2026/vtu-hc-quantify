# HO-01: A -> C: API mock mode  (target H3)

## Delivered
- [ ] `QUANTA_MOCK=1 make mock` serves every endpoint in `docs/CONTRACTS.md` section 3 from `data/fixtures/`
- [ ] `docs/api.md` generated from OpenAPI
- [ ] CORS for `http://localhost:5173`
- [ ] Jobs complete in ~3 s with growing `energy_trace`
- [ ] Role 403 for `ibm`/`noisy` as coordinator

## Verify
```
QUANTA_MOCK=1 make mock &
curl -s localhost:8000/api/health
curl -s -X POST localhost:8000/api/runs -H 'content-type: application/json' -d '{"dataset_id":"mini"}'
curl -s -X POST localhost:8000/api/runs/mock/clusters/extract
curl -s -H 'X-Role: coordinator' -X POST localhost:8000/api/runs/mock/clusters/c1/quantum -H 'content-type: application/json' -d '{"backend":"ibm"}'   # expect 403
```

## Known limits
Mock data is static: one dataset, one run id `mock`.

## C's first prompt
```
Read docs/CONTRACTS.md and docs/api.md. Point src/api.ts at http://localhost:8000/api (mock mode). Verify each client method against the live mock with a Vitest integration test that calls /health, /runs, extract, quantum job polling until done, and result. Fix any type mismatch in src/types.ts (report the mismatch to A instead of editing schemas.py).
```
