# HO-06: ALL: feature freeze and demo readiness  (H32)

## Freeze actions
- [ ] A: all tests green (`make test`), `git tag v1`
- [ ] B: hardware run and benchmark files committed
- [ ] C: anti-generic checklist signed, shortcuts verified
- [ ] STATUS.md updated: unresolved bugs listed with severity
- [ ] From now on only bug fixes; each fix is announced in chat and tested on the demo path

## Demo readiness
- [ ] Clean clone test: new folder, `make setup`, `make data`, `make dev`, demo path works
- [ ] `.env.example` complete, no secrets in git (`git log -p | grep -i token` empty)
- [ ] Cached run available; network-off test passed
- [ ] Screen recording `demo.mp4` saved on desktop and USB
- [ ] 3 consecutive rehearsals timed (<= 4:30) with roles: presenter, clicker, Q&A defender
- [ ] README has honest-claims section and architecture diagram
- [ ] Slides exported to PDF

## Roles at the demo
Presenter: C. Clicker/operator: A (owns failure recovery). Technical Q&A: B (quantum), A (classical).
