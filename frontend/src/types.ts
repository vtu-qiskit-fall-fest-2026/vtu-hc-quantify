/**
 * TypeScript contracts mirroring backend/schemas.py (Pydantic v2).
 * Frozen at H2 per docs/CONTRACTS.md.
 */

export interface Assignment {
  course_id: string;
  slot_id: string;
  room_ids: string[];
}

export interface Timetable {
  run_id: string;
  assignments: Assignment[];
  hard_violations: number;
  soft_score: number;
  penalty_breakdown: Record<string, number>;
  solve_seconds: number;
  seed: number;
}

export interface PairWeight {
  a: string;
  b: string;
  shared_students: number;
}

export interface FixedNeighbor {
  course_id: string;
  slot_id: string;
  shared_students: number;
}

export interface SubProblem {
  cluster_id: string;
  courses: string[];
  candidates: Record<string, [string, string]>;
  sizes: Record<string, number>;
  pair_weights: PairWeight[];
  fixed_neighbors: FixedNeighbor[];
  spare_capacity: Record<string, number>;
  slot_meta: Record<string, [number, number]>;
  penalty_table: Record<string, number>;
  affected_students: number;
  baseline_cluster_cost: number;
}

export interface QuantumConfig {
  backend: 'ideal' | 'noisy' | 'ibm' | 'fake_ibm';
  p?: 1 | 2;
  optimizer?: 'COBYLA' | 'SPSA';
  shots?: number;
  seed?: number;
  restarts?: number;
  maxiter?: number;
  lambda_cap?: number;
  noise_scale?: number;
  penalty_overrides?: Record<string, number>;
}

export interface BitstringCount {
  bits: string;
  count: number;
  energy: number;
}

export interface QuantumResult {
  backend: string;
  backend_detail: string;
  p: number;
  shots: number;
  params: number[];
  energy_history: number[];
  top_bitstrings: BitstringCount[];
  ground_energy?: number | null;
  best_sampled_energy: number;
  approx_ratio?: number | null;
  depth: number;
  two_qubit_gates: number;
  transpile_seconds: number;
  run_seconds: number;
  queue_seconds?: number | null;
  job_id?: string | null;
  noise_scale?: number | null;
}

export interface FinalDecision {
  cluster_id: string;
  source: 'quantum_repaired' | 'baseline_fallback';
  before_score: number;
  after_score: number;
  resolved_students: number;
  hard_violations: number; // MUST be 0
  changes: [string, string, string][]; // [course_id, from_slot, to_slot]
  feasible_fraction: number;
  reason: string;
}

export interface BenchmarkRow {
  cluster_size: number;
  seed: number;
  method: string;
  objective: number;
  approx_ratio?: number | null;
  feasible_pct: number;
  runtime_s: number;
  depth?: number | null;
  two_qubit_gates?: number | null;
  failed: boolean;
}

export interface Job {
  job_id: string;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'error';
  stage: string;
  progress: number;
  energy_trace: number[];
  result_ref?: string | null;
  error?: string | null;
}
