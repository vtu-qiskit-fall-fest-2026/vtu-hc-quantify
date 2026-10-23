import {
  BenchmarkRow,
  FinalDecision,
  Job,
  QuantumConfig,
  QuantumResult,
  SubProblem,
  Timetable,
} from './types';
import { useAppStore } from './store';

function resolveApiBaseUrl(): string {
  let raw = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  raw = raw.trim().replace(/\/+$/, '');
  if (!raw.endsWith('/api')) {
    raw = `${raw}/api`;
  }
  return raw;
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  code?: string;
  statusCode: number;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const role = useAppStore.getState().role;
  const headers = new Headers(options.headers || {});

  if (!headers.has('X-Role')) {
    headers.set('X-Role', role);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new ApiError(
      `Network error connecting to API (${url}): ${err?.message || 'Server unreachable'}`,
      0
    );
  }

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    let code: string | undefined;

    try {
      const errData = await res.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
        code = errData.error.code;
      } else if (errData?.detail) {
        if (typeof errData.detail === 'object' && errData.detail.error?.message) {
          errorMsg = errData.detail.error.message;
          code = errData.detail.error.code;
        } else if (typeof errData.detail === 'string') {
          errorMsg = errData.detail;
        } else {
          errorMsg = JSON.stringify(errData.detail);
        }
      }
    } catch {
      // Body not JSON
    }

    throw new ApiError(errorMsg, res.status, code);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const api = {
  health: () => request<{ status: string; mock: boolean; version: string }>('/health'),

  uploadDatasets: (formData: FormData) =>
    request<{ dataset_id: string; stats: Record<string, number>; warnings: string[] }>(
      '/datasets',
      { method: 'POST', body: formData }
    ),

  createRun: (datasetId: string = 'ds_mini', seed: number = 42) =>
    request<{ run_id: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, seed }),
    }),

  runBaseline: (runId: string, timeLimitSeconds: number = 60) =>
    request<Job>(`/runs/${runId}/baseline`, {
      method: 'POST',
      body: JSON.stringify({ time_limit_s: timeLimitSeconds }),
    }),

  getRun: (runId: string) =>
    request<{
      run: { run_id: string; dataset_id: string; seed: number };
      timetable?: Timetable;
      clusters?: SubProblem[];
      decisions?: FinalDecision[];
    }>(`/runs/${runId}`),

  extractClusters: (runId: string, maxSize: number = 12, topK: number = 5) =>
    request<SubProblem[]>(`/runs/${runId}/clusters/extract`, {
      method: 'POST',
      body: JSON.stringify({ max_size: maxSize, top_k: topK }),
    }),

  submitQuantumJob: (runId: string, clusterId: string, config: QuantumConfig) =>
    request<Job>(`/runs/${runId}/clusters/${clusterId}/quantum`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),

  getClusterResult: (runId: string, clusterId: string) =>
    request<{ quantum: QuantumResult; decision: FinalDecision }>(
      `/runs/${runId}/clusters/${clusterId}/result`
    ),

  getBenchmarks: (runId: string) =>
    request<{
      rows: BenchmarkRow[];
      hardware: any[];
      figures: string[];
    }>(`/runs/${runId}/benchmarks`),

  publish: (runId: string, clusterIds: string[]) =>
    request<{ timetable: Timetable; export_url: string }>(`/runs/${runId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ cluster_ids: clusterIds }),
    }),

  getExportUrl: (runId: string) => `${API_BASE_URL}/runs/${runId}/export.csv`,
};
