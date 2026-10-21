"""Headless End-to-End Pipeline Verification Script.

Task: A5b (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md, tasks/A_backend.md, and handoffs/HO-04_A_to_C_real_api.md
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.core.baseline import solve_baseline
from backend.core.datagen import generate_dataset
from backend.core.extractor import extract_clusters
from backend.core.repair import decide
from backend.quantum.interface import run_quantum
from backend.schemas import Dataset, QuantumConfig


def run_e2e_pipeline(
    dataset_name: str = "mini",
    backend: str = "ideal",
    seed: int = 42,
    time_limit_s: int = 15,
) -> int:
    print(f"=== [QUANTA] Running Headless End-to-End Pipeline ({dataset_name.upper()} | {backend.upper()}) ===")
    t_start = time.time()

    # 1. Dataset Loading / Generation
    if dataset_name == "mini":
        print("1. Generating synthetic mini dataset (12 courses, 60 students)...")
        ds: Dataset = generate_dataset(
            n_students=60,
            n_courses=12,
            n_rooms=4,
            n_days=2,
            slots_per_day=4,
            seed=seed,
            name="mini_e2e",
        )
    else:  # demo
        print("1. Generating synthetic demo dataset (180 courses, 4200 students)...")
        ds = generate_dataset(
            n_students=4200,
            n_courses=180,
            n_rooms=22,
            n_days=5,
            slots_per_day=3,
            seed=seed,
            name="demo_e2e",
        )
    print(f"   -> Courses: {len(ds.courses)}, Enrollments: {len(ds.enrollments)}, Rooms: {len(ds.rooms)}, Slots: {len(ds.slots)}")

    # 2. Classical Baseline Solving
    print(f"2. Solving global baseline with CP-SAT (time_limit={time_limit_s}s)...")
    t0 = time.time()
    tt = solve_baseline(ds, time_limit_s=time_limit_s, seed=seed)
    print(f"   -> Solved in {time.time() - t0:.2f}s | Hard Violations: {tt.hard_violations}, Soft Score: {tt.soft_score:.1f}")
    assert tt.hard_violations == 0, "Certified baseline must have 0 hard violations!"

    # 3. Bottleneck Cluster Extraction
    print("3. Extracting conflict bottleneck clusters via NetworkX...")
    clusters = extract_clusters(ds, tt, max_size=12 if dataset_name == "demo" else 6, top_k=3)
    if not clusters:
        print("   -> No conflict clusters identified in timetable.")
        return 0
    sp = clusters[0]
    print(f"   -> Top Cluster '{sp.cluster_id}': {len(sp.courses)} courses, {sp.affected_students} affected students, baseline cost {sp.baseline_cluster_cost:.1f}")

    # 4. Variational Quantum Run
    print(f"4. Executing QAOA on {backend} backend (p=1, shots=1024)...")
    cfg = QuantumConfig(
        backend=backend,  # type: ignore[arg-type]
        p=1,
        shots=1024,
        seed=seed,
    )
    t_q = time.time()
    qr = run_quantum(sp, cfg)
    print(f"   -> Quantum Result in {time.time() - t_q:.2f}s | Approx Ratio: {qr.approx_ratio if qr.approx_ratio is not None else 0.0:.3f}, Depth: {qr.depth}, 2Q Gates: {qr.two_qubit_gates}")

    # 5. Classical Repair & Decision Gate
    print("5. Classical Repair Gate & Strict Improvement Decision...")
    decision = decide(ds, tt, sp, qr)
    print(f"   -> Decision Source: {decision.source}")
    print(f"   -> Before Score: {decision.before_score:.1f} | After Score: {decision.after_score:.1f}")
    print(f"   -> Resolved Students: {decision.resolved_students}")
    print(f"   -> Hard Violations: {decision.hard_violations} (Must be 0)")
    print(f"   -> Changes: {len(decision.changes)} course moves")
    print(f"   -> Reason: {decision.reason}")

    assert decision.hard_violations == 0, "FinalDecision must have 0 hard violations!"
    print(f"=== [QUANTA] Headless E2E Completed in {time.time() - t_start:.2f}s ===")
    return 0


def main():
    parser = argparse.ArgumentParser(description="QUANTA Headless End-to-End Pipeline")
    parser.add_argument("--dataset", choices=["mini", "demo"], default="mini", help="Dataset preset")
    parser.add_argument("--backend", choices=["ideal", "noisy", "fake_ibm", "ibm"], default="ideal", help="Quantum backend")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed")
    parser.add_argument("--time-limit", type=int, default=15, help="CP-SAT baseline solver time limit (seconds)")
    args = parser.parse_args()

    return run_e2e_pipeline(
        dataset_name=args.dataset,
        backend=args.backend,
        seed=args.seed,
        time_limit_s=args.time_limit,
    )


if __name__ == "__main__":
    sys.exit(main())
