import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  X,
  DatabaseZap,
  Zap,
  Check,
} from 'lucide-react';
import { useAppStore, UserRole } from '../store';
import { PillSegmented } from './PillSegmented';
import { PillButton } from './PillButton';
import { ToastContainer } from './Toast';
import { api, ApiError } from '../api';

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    role,
    setRole,
    theme,
    toggleTheme,
    datasetName,
    setDatasetName,
    runId,
    setRunId,
    hardViolations,
    lastSolveSeconds,
    setTimetable,
    setClusters,
    setDecisions,
    setSolveStatus,
    addToast,
  } = useAppStore();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [loadingCache, setLoadingCache] = useState(false);

  // Keyboard navigation shortcuts
  useEffect(() => {
    let pendingG = false;
    let timer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setShortcutsOpen(false);
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        pendingG = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
          pendingG = false;
        }, 1000);
        return;
      }

      if (pendingG) {
        pendingG = false;
        clearTimeout(timer);
        const k = e.key.toLowerCase();
        if (k === 'o') navigate('/');
        else if (k === 'd') navigate('/dataset');
        else if (k === 't') navigate('/timetable');
        else if (k === 'c') navigate('/clusters');
        else if (k === 'b') navigate('/benchmarks');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [navigate]);

  const handleLoadCachedRun = async () => {
    setLoadingCache(true);
    try {
      const cached = await api.getRun('run_fixture_mini');
      if (cached.run?.run_id) {
        setRunId(cached.run.run_id);
        setDatasetName(cached.run.dataset_id);
      }
      if (cached.timetable) {
        setTimetable(cached.timetable);
        setSolveStatus(cached.timetable.solve_seconds, cached.timetable.hard_violations);
      }
      if (cached.clusters) {
        setClusters(cached.clusters);
      }
      if (cached.decisions) {
        setDecisions(cached.decisions);
      }
      addToast('Restored certified demo run', 'ok');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error restoring cached run';
      addToast(msg, 'error');
    } finally {
      setLoadingCache(false);
    }
  };

  const navItems = [
    { to: '/', label: 'Overview', exact: true },
    { to: '/dataset', label: 'Dataset' },
    { to: '/timetable', label: 'Timetable' },
    { to: '/clusters', label: 'Cluster Lab' },
    { to: '/benchmarks', label: 'Benchmarks' },
  ];

  // 8 circle dots around a center dot for the quantum coupling logo mark
  const ringDots = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      cx: 18 + 10.5 * Math.cos(rad),
      cy: 18 + 10.5 * Math.sin(rad),
      key: deg,
    };
  });

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui flex flex-col selection:bg-greenSoft selection:text-green">
      {/* Top Floating Pill Navigation (Section A: 56px high, floating white pill, radius 999, 1px line border) */}
      <header className="sticky top-2 z-50 px-4 max-w-[1440px] w-full mx-auto">
        <div className="bg-tile border border-line shadow-hairline rounded-pill h-14 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 transition-colors">
          {/* Logo Mark: 36px filled --green circle with white dotted-ring SVG + QUANTA + HYBRID chip */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group flex-shrink-0 select-none py-1 pl-1"
          >
            <div className="w-9 h-9 rounded-full bg-green flex items-center justify-center flex-shrink-0 text-white shadow-hairline">
              <svg viewBox="0 0 36 36" className="w-6 h-6">
                <circle cx="18" cy="18" r="10.5" fill="none" stroke="white" strokeOpacity="0.3" strokeDasharray="2 2" />
                <circle cx="18" cy="18" r="2.2" fill="white" />
                {ringDots.map((dot) => (
                  <circle key={dot.key} cx={dot.cx} cy={dot.cy} r="1.6" fill="white" />
                ))}
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight font-ui text-ink">
                QUANTA
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-pill bg-greenSoft text-green font-semibold">
                HYBRID
              </span>
            </div>
          </NavLink>

          {/* Centered Route Pills */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`px-4 py-1.5 rounded-pill text-xs transition-all duration-150 font-ui ${
                    isActive
                      ? 'bg-greenSoft text-green font-semibold'
                      : 'text-ink2 hover:text-ink hover:bg-tileMint/60 font-medium'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Right Controls: Demo Run Pill, Role Segmented, Theme 40px Circle, Run Optimizer Primary */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Demo Run Secondary Pill */}
            <PillButton
              size="sm"
              variant="secondary"
              onClick={handleLoadCachedRun}
              disabled={loadingCache}
              icon={<DatabaseZap className="w-3.5 h-3.5 text-green" />}
              className="hidden lg:inline-flex"
            >
              {loadingCache ? 'Loading...' : 'Demo run'}
            </PillButton>

            {/* Role Switcher Pill Segmented (white track, active segment green-soft) */}
            <PillSegmented
              size="sm"
              variant="light"
              value={role}
              onChange={(r) => setRole(r as UserRole)}
              options={[
                { value: 'coordinator', label: 'Coord' },
                { value: 'researcher', label: 'Research' },
              ]}
            />

            {/* Theme Toggle Button (40px circle) */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-10 h-10 rounded-full border border-line bg-tile hover:bg-tileMint/70 flex items-center justify-center text-ink2 hover:text-ink transition-colors flex-shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-warn" />
              ) : (
                <Moon className="w-4 h-4 text-ink3" />
              )}
            </button>

            {/* Run Optimizer SOLID green primary pill with bolt icon */}
            <PillButton
              size="sm"
              variant="primary"
              onClick={() => navigate('/clusters')}
              icon={<Zap className="w-3.5 h-3.5 fill-current" />}
            >
              <span className="hidden sm:inline">Run optimizer</span>
              <span className="sm:hidden">Run</span>
            </PillButton>
          </div>
        </div>

        {/* Status Line: 3 white pill chips (run id, dataset, 0 hard violations) and ? keys ghost chip */}
        <div className="flex items-center justify-between text-xs px-2 sm:px-4 py-3 text-ink2">
          <div className="flex items-center gap-2 font-mono flex-wrap">
            {/* Run ID Chip */}
            <div className="px-3 py-0.5 rounded-pill bg-tile border border-line text-[11px] font-mono text-ink2 flex items-center gap-1.5 shadow-hairline">
              <span className="text-ink3 font-sans">run:</span>
              <span className="text-ink font-semibold">{runId || 'run_fixture_mini'}</span>
            </div>

            {/* Dataset Chip */}
            <div className="px-3 py-0.5 rounded-pill bg-tile border border-line text-[11px] font-mono text-ink2 flex items-center gap-1.5 shadow-hairline">
              <span className="text-ink3 font-sans">dataset:</span>
              <span className="text-ink font-semibold">{datasetName}</span>
            </div>

            {/* Solve Time Chip */}
            {lastSolveSeconds !== null && (
              <div className="px-3 py-0.5 rounded-pill bg-tile border border-line text-[11px] font-mono text-ink2 flex items-center gap-1.5 shadow-hairline">
                <span className="text-ink3 font-sans">solved:</span>
                <span className="text-ink font-semibold">{lastSolveSeconds.toFixed(1)}s</span>
              </div>
            )}

            {/* 0 Hard Violations Badge */}
            <div className="px-3 py-0.5 rounded-pill bg-tile border border-line text-[11px] font-mono text-green font-semibold flex items-center gap-1.5 shadow-hairline">
              <div className="w-3.5 h-3.5 rounded-full bg-green flex items-center justify-center text-white flex-shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <span>{hardViolations} hard violations</span>
            </div>
          </div>

          {/* ? Keys Ghost Chip */}
          <div className="flex items-center">
            <button
              onClick={() => setShortcutsOpen(true)}
              className="px-2.5 py-0.5 text-[11px] font-mono text-ink3 hover:text-ink rounded-pill hover:bg-tile/80 border border-transparent hover:border-line transition-all"
              title="Keyboard shortcuts (?)"
            >
              ? keys
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area: tighter vertical padding to ensure first bento row is visible within 900px */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-1 pb-10">
        <Outlet />
      </main>

      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Keyboard Shortcuts Dialog */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tile border border-line rounded-tile p-6 max-w-md w-full shadow-hairline relative">
            <button
              onClick={() => setShortcutsOpen(false)}
              className="absolute top-4 right-4 text-ink3 hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-base mb-1 font-ui">Keyboard Shortcuts</h3>
            <p className="text-xs text-ink3 mb-4">Fast navigation across QUANTA stages</p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink2">Go to Overview</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">g o</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink2">Go to Dataset</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">g d</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink2">Go to Timetable</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">g t</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink2">Go to Cluster Lab</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">g c</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/40">
                <span className="text-ink2">Go to Benchmarks</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">g b</kbd>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink2">Run QAOA in Cluster Lab</span>
                <kbd className="px-2 py-0.5 rounded-pill bg-tileMint font-mono text-ink font-semibold">r</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
