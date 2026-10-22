"""CLI runner for submitting QUANTA QAOA jobs to IBM Quantum hardware or offline emulator.

Owner: Member B (Quantum + benchmarks)
Usage:
    python scripts/submit_hardware.py --fixture subproblem_6 --p 1 --shots 4096 --dry-run
    python scripts/submit_hardware.py --fixture subproblem_6 --p 1 --shots 4096
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure repository root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from backend.quantum.ibm import run_qaoa_ibm
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig, SubProblem


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Submit QUANTA QAOA job to IBM Quantum.")
    parser.add_argument(
        "--fixture",
        type=str,
        default="subproblem_6",
        help="Subproblem fixture name (e.g. subproblem_6 or subproblem_12) or path to JSON file",
    )
    parser.add_argument("--p", type=int, default=1, choices=[1, 2], help="QAOA circuit reps (default 1)")
    parser.add_argument("--shots", type=int, default=4096, help="Measurement shots (default 4096)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run offline using FakeAuckland instead of real physical QPU",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Resolve fixture file
    fixtures_dir = repo_root / "data" / "fixtures"
    if args.fixture.endswith(".json"):
        fixture_path = Path(args.fixture)
    else:
        fixture_path = fixtures_dir / f"{args.fixture}.json"

    if not fixture_path.exists():
        print(f"Error: Fixture file not found: {fixture_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading cluster subproblem from {fixture_path.name}...")
    with open(fixture_path, "r", encoding="utf-8") as f:
        sp = SubProblem.model_validate_json(f.read())

    print(f"Cluster: {sp.cluster_id} ({len(sp.courses)} courses)")
    print(f"Mode: {'OFFLINE EMULATOR (FakeAuckland)' if args.dry_run else 'PHYSICAL IBM HARDWARE'}")
    print(f"QAOA: p={args.p}, shots={args.shots}")

    # Stage 1: Ideal optimization to find variational angles
    print("\n[1/2] Optimizing QAOA parameters on ideal simulator...")
    ideal_cfg = QuantumConfig(
        backend="ideal",
        p=args.p,
        optimizer="COBYLA",
        restarts=3,
        maxiter=50,
        seed=42,
    )

    def print_progress(stage: str, frac: float, val: float | None) -> None:
        val_str = f", val={val:.1f}" if val is not None else ""
        print(f"  [{stage.upper()}] progress={frac * 100:.0f}%{val_str}")

    ideal_result = run_qaoa_ideal(sp, ideal_cfg, progress_cb=print_progress)
    print(f"Ideal optimization complete: best_energy={ideal_result.best_sampled_energy:.1f}, params={ideal_result.params}")

    # Stage 2: Hardware execution
    print("\n[2/2] Transpiling and executing on target hardware...")
    hw_backend_name = "fake_ibm" if args.dry_run else "ibm"
    hw_cfg = QuantumConfig(
        backend=hw_backend_name,
        p=args.p,
        shots=args.shots,
        seed=42,
    )

    hw_result = run_qaoa_ibm(
        sp,
        hw_cfg,
        ideal_result,
        progress_cb=print_progress,
        dry_run=args.dry_run,
    )

    print("\n" + "=" * 60)
    print("HARDWARE EXECUTION RESULTS")
    print("=" * 60)
    print(f"Backend:            {hw_result.backend_detail}")
    print(f"Job ID:             {hw_result.job_id}")
    print(f"Queue Time:         {hw_result.queue_seconds:.2f} s")
    print(f"Run Time:           {hw_result.run_seconds:.2f} s")
    print(f"Transpiled Depth:   {hw_result.depth}")
    print(f"2-Qubit Gates:      {hw_result.two_qubit_gates}")
    print(f"Approx Ratio:       {hw_result.approx_ratio:.4f}")
    print(f"Ground Energy:      {hw_result.ground_energy:.1f}")
    print(f"Best Sampled Energy:{hw_result.best_sampled_energy:.1f}")
    print(f"Top Candidate Bits: {hw_result.top_bitstrings[0].bits} (count={hw_result.top_bitstrings[0].count})")
    print("=" * 60)
    print("Telemetry artifact saved to runs/hardware/")


if __name__ == "__main__":
    main()
