"""QUANTA End-to-End Demo: Real Synthetic University Dataset + IBM Quantum QPU.

Executes the full pipeline on the 4,200-student campus dataset:
1. Load synthetic university dataset (180 courses, 4,200 students, 22 rooms, 15 slots).
2. Solve global baseline schedule with CP-SAT in ~5 seconds.
3. Extract dense conflict bottleneck cluster affecting >1,000 students.
4. Optimize QAOA parameters on simulator and sample on IBM Quantum (Physical QPU or FakeAuckland).
5. Classical repair & acceptance gate verification (guaranteeing hard_violations == 0).

Usage:
    python scripts/run_demo_quantum.py --dry-run
    python scripts/run_demo_quantum.py
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Ensure repository root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from backend.core.baseline import solve_baseline
from backend.core.datagen import generate_dataset
from backend.core.extractor import extract_clusters
from backend.core.repair import decide
from backend.quantum.ibm import run_qaoa_ibm
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run QUANTA pipeline on synthetic university data with IBM Quantum."
    )
    parser.add_argument(
        "--cluster-size",
        type=int,
        default=6,
        help="Number of courses in bottleneck cluster (default: 6)",
    )
    parser.add_argument(
        "--shots",
        type=int,
        default=4096,
        help="Measurement shots on quantum backend (default: 4096)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run offline on FakeAuckland (27-qubit emulator) instead of live physical QPU",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    print("=" * 70)
    print("QUANTA FULL PIPELINE: SYNTHETIC DATASET + IBM QUANTUM")
    print("=" * 70)

    # 1. Dataset Generation / Loading
    print("\n[Step 1/5] Loading Synthetic Campus Dataset (180 courses, 4,200 students)...")
    t0 = time.perf_counter()
    ds = generate_dataset(
        n_students=4200,
        n_courses=180,
        n_rooms=22,
        n_days=5,
        slots_per_day=3,
        seed=42,
    )
    print(f"  -> Generated {len(ds.courses)} courses, {len(ds.enrollments)} student enrollments in {time.perf_counter() - t0:.2f}s.")

    # 2. Classical Baseline Timetable (CP-SAT)
    print("\n[Step 2/5] Solving Global Baseline Timetable with CP-SAT...")
    t_base = time.perf_counter()
    tt = solve_baseline(ds, time_limit_s=15, seed=0)
    print(f"  -> Baseline solved in {time.perf_counter() - t_base:.2f}s:")
    print(f"     Hard Violations: {tt.hard_violations} (Zero clashes certified)")
    print(f"     Initial Soft Penalty Score: {tt.soft_score:.1f}")

    # 3. Bottleneck Cluster Extraction
    print(f"\n[Step 3/5] Extracting Top Bottleneck Conflict Cluster (Target Size = {args.cluster_size})...")
    clusters = extract_clusters(ds, tt, max_size=args.cluster_size, top_k=1)
    if not clusters:
        print("  Error: No clusters could be extracted.", file=sys.stderr)
        sys.exit(1)

    sp = clusters[0]
    print(f"  -> Cluster ID: {sp.cluster_id}")
    print(f"     Courses involved: {sp.courses}")
    print(f"     Students directly affected by this conflict: {sp.affected_students}")
    print(f"     Initial cluster soft penalty: {sp.baseline_cluster_cost:.1f}")

    # 4. QAOA Variational Optimization & IBM Quantum Execution
    mode_str = "OFFLINE EMULATOR (FakeAuckland)" if args.dry_run else "PHYSICAL IBM HARDWARE (IBM Quantum Cloud)"
    print(f"\n[Step 4/5] Executing QAOA on {mode_str}...")

    def progress_callback(stage: str, frac: float, val: float | None) -> None:
        val_str = f", val={val:.1f}" if val is not None else ""
        print(f"  [{stage.upper()}] progress={int(frac * 100)}%{val_str}")

    cfg = QuantumConfig(
        backend="fake_ibm" if args.dry_run else "ibm",
        p=1,
        shots=args.shots,
        seed=42,
        maxiter=25,
        restarts=1,
    )

    print("  -> Step 4a: Variational parameter optimization on ideal simulator...")
    ideal_res = run_qaoa_ideal(sp, cfg, progress_callback)
    print(f"     Optimal angles found: gamma={ideal_res.params[0]:.4f}, beta={ideal_res.params[1]:.4f}")

    print("  -> Step 4b: Transpiling & sampling on target IBM backend...")
    qr = run_qaoa_ibm(sp, cfg, ideal_res, progress_callback, dry_run=args.dry_run)

    print("\n" + "=" * 70)
    print("IBM QUANTUM EXECUTION TELEMETRY")
    print("=" * 70)
    print(f"Backend Name:          {qr.backend_detail}")
    print(f"Job ID:                {qr.job_id}")
    print(f"Queue Time:            {qr.queue_seconds:.2f} s" if qr.queue_seconds is not None else "Queue Time: N/A")
    print(f"Execution Time:        {qr.run_seconds:.2f} s")
    print(f"Transpiled Depth:      {qr.depth}")
    print(f"2-Qubit Gates (CX):    {qr.two_qubit_gates}")
    print(f"Approximation Ratio:   {qr.approx_ratio:.4f}")
    print(f"Best Sampled Cost:     {qr.best_sampled_energy:.1f}")
    if qr.top_bitstrings:
        top = qr.top_bitstrings[0]
        print(f"Top Sampled State:     {top.bits} (sampled {top.count}/{args.shots} times)")
    print("=" * 70)

    # 5. Classical Repair Gate & Final Acceptance Decision
    print("\n[Step 5/5] Auditing Quantum Candidate Through Classical Repair Gate...")
    decision = decide(ds, tt, sp, qr)

    print(f"\nFINAL VERDICT: {decision.source.upper()}")
    print(f"  Hard Violations:        {decision.hard_violations} (Zero Clashes Guaranteed)")
    print(f"  Baseline Soft Score:    {decision.before_score:.1f}")
    print(f"  Resulting Soft Score:   {decision.after_score:.1f}")
    print(f"  Resolved Students:      {decision.resolved_students}")
    print(f"  Feasible Candidates:    {int(decision.feasible_fraction * 100)}% of sampled bitstrings")
    print(f"  Decision Rationale:     {decision.reason}")
    if decision.changes:
        print("  Proposed Course Moves:")
        for course_id, from_s, to_s in decision.changes:
            print(f"    - Course {course_id}: {from_s} -> {to_s}")
    print("=" * 70)


if __name__ == "__main__":
    main()
