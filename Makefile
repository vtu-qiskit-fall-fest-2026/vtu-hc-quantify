.PHONY: setup dev test mock data bench clean

PYTHON ?= python
PIP ?= pip
NPM ?= npm

setup:
	$(PIP) install -r requirements.txt
	@if [ -d "frontend" ]; then cd frontend && $(NPM) install; fi

dev:
	# Run FastAPI backend and Vite frontend concurrently
	python -m backend.api.main & cd frontend && $(NPM) run dev

test:
	pytest backend/tests/ -v
	$(PYTHON) scripts/e2e.py --dataset mini --backend ideal

mock:
	QUANTA_MOCK=1 python -m backend.api.main

data:
	$(PYTHON) -m backend.core.datagen --preset demo

bench:
	$(PYTHON) -m benchmarks.run_benchmarks

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf .pytest_cache runs/temp/
