"""Headless End-to-End Pipeline Verification Script."""
from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.core.datagen import generate_dataset
from backend.core.baseline import solve_baseline
from backend.core.extractor import extract_clusters
from backend.quantum.interface import run_quantum
from backend.schemas import QuantumConfig
from backend.core.repair import decide


def run_e2e_pipeline():
    print("=== [QUANTA] Running Headless End-to-End Pipeline ===")
    
    # 1. Dataset Generation
    print("1. Generating synthetic mini dataset (12 courses)...")
    ds = generate_dataset(n_students=60, n_courses=12, n_rooms=4, n_days=2, slots_per_day=4, seed=42)
    print(f"   -> Courses: {len(ds.courses)}, Enrollments: {len(ds.enrollments)}, Rooms: {len(ds.rooms)}")

    # 2. Classical Baseline
    print("2. Solving global baseline with CP-SAT / heuristic...")
    tt = solve_baseline(ds, time_limit_s=5, seed=0)
    print(f"   -> Baseline Hard Violations: {tt.hard_violations}, Soft Score: {tt.soft_score:.1f}")

    # 3. Bottleneck Cluster Extraction
    print("3. Extracting conflict clusters via NetworkX...")
    clusters = extract_clusters(ds, tt, max_size=6, top_k=2)
    if not clusters:
        print("   -> No clusters found.")
        return 0
    sp = clusters[0]
    print(f"   -> Cluster '{sp.cluster_id}' extracted: {len(sp.courses)} courses, {sp.affected_students} affected students")

    # 4. Variational Quantum Run
    print("4. Executing QAOA on ideal simulator (p=1, shots=1024)...")
    cfg = QuantumConfig(backend="ideal", p=1, shots=1024, seed=7)
    qr = run_quantum(sp, cfg)
    print(f"   -> Quantum Result: Approx Ratio: {qr.approx_ratio:.3f}, Circuit Depth: {qr.depth}, 2Q Gates: {qr.two_qubit_gates}")

    # 5. Classical Repair & Decision Gate
    print("5. Classical Repair Gate & Decision...")
    decision = decide(ds, tt, sp, qr)
    print(f"   -> Decision Source: {decision.source}")
    print(f"   -> Hard Violations: {decision.hard_violations}")
    print(f"   -> Reason: {decision.reason}")
    print("=== [QUANTA] End-to-End Pipeline Completed Successfully ===")
    return 0


if __name__ == "__main__":
    sys.exit(run_e2e_pipeline())
