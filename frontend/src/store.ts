import { create } from 'zustand';
import { Timetable, SubProblem, FinalDecision } from './types';

export type UserRole = 'coordinator' | 'researcher';
export type AppTheme = 'dark' | 'light';

export interface ToastMessage {
  id: string;
  type: 'info' | 'ok' | 'warn' | 'error';
  message: string;
}

interface AppState {
  role: UserRole;
  theme: AppTheme;
  datasetName: string;
  runId: string | null;
  timetable: Timetable | null;
  clusters: SubProblem[];
  decisions: FinalDecision[];
  activeClusterId: string | null;
  hardViolations: number;
  lastSolveSeconds: number | null;
  toasts: ToastMessage[];

  setRole: (role: UserRole) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setDatasetName: (name: string) => void;
  setRunId: (runId: string | null) => void;
  setTimetable: (timetable: Timetable | null) => void;
  setClusters: (clusters: SubProblem[]) => void;
  setDecisions: (decisions: FinalDecision[]) => void;
  setActiveClusterId: (clusterId: string | null) => void;
  setSolveStatus: (solveSeconds: number, hardViolations: number) => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  role: 'coordinator',
  theme: 'light',
  datasetName: 'ds_mini',
  runId: null,
  timetable: null,
  clusters: [],
  decisions: [],
  activeClusterId: null,
  hardViolations: 0,
  lastSolveSeconds: null,
  toasts: [],

  setRole: (role) => set({ role }),
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    set({ theme: nextTheme });
  },
  setDatasetName: (datasetName) => set({ datasetName }),
  setRunId: (runId) => {
    if (runId !== get().runId) {
      set({
        runId,
        clusters: [],
        decisions: [],
        activeClusterId: null,
        timetable: null,
        hardViolations: 0,
        lastSolveSeconds: null,
      });
    } else {
      set({ runId });
    }
  },
  setTimetable: (timetable) =>
    set({
      timetable,
      hardViolations: timetable ? timetable.hard_violations : 0,
      lastSolveSeconds: timetable ? timetable.solve_seconds : null,
    }),
  setClusters: (clusters) =>
    set({
      clusters,
      activeClusterId: clusters.length > 0 ? clusters[0].cluster_id : null,
    }),
  setDecisions: (decisions) => set({ decisions }),
  setActiveClusterId: (activeClusterId) => set({ activeClusterId }),
  setSolveStatus: (lastSolveSeconds, hardViolations) =>
    set({ lastSolveSeconds, hardViolations }),
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
