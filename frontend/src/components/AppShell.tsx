import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  X,
  DatabaseZap,
  ShieldCheck,
  Zap,
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

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui flex flex-col selection:bg-greenSoft selection:text-green">
      {/* Top Floating Pill Navigation (Reference: 48px high, centered, white pill) */}
      <header className="sticky top-4 z-50 px-4 max-w-[1440px] w-full mx-auto">
        <div className="bg-tile/95 backdrop-blur-md border border-line shadow-hover rounded-pill h-14 px-4 flex items-center justify-between gap-3 transition-colors">
          {/* Logo Mark: Dotted circular cluster glyph + wordmark */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group flex-shrink-0 select-none py-1 pl-1"
          >
            <div className="relative w-7 h-7 flex items-center justify-center">
              {/* Dotted cluster ring reminiscent of Nanoplazz + Quantum coupling */}
              <div className="absolute inset-0 rounded-full border border-green/30 border-dashed animate-[spin_16s_linear_infinite]" />
              <div className="w-4 h-4 rounded-full bg-greenSoft flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-base tracking-tight font-ui text-ink">
                QUANTA
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded-full bg-greenSoft text-green font-medium">
                Hybrid
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
                  className={`px-4 py-1.5 rounded-pill text-xs font-medium transition-all duration-150 font-ui ${
                    isActive
                      ? 'bg-greenSoft text-green shadow-hairline font-semibold'
                      : 'text-ink2 hover:text-ink hover:bg-tileMint/50'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Right Controls: Role, Theme, Cache Loader, and Primary CTA */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Demo Cache Load */}
            <button
              onClick={handleLoadCachedRun}
              disabled={loadingCache}
              title="Load certified demo run (offline)"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-pill border border-line text-ink2 hover:text-ink hover:bg-tileMint/60 transition-colors"
            >
              <DatabaseZap className="w-3.5 h-3.5 text-green" />
              <span>{loadingCache ? 'Loading...' : 'Demo Run'}</span>
            </button>

            {/* Role Switcher Pill */}
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

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-ink2 hover:text-ink hover:bg-tileMint/60 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-warn" />
              ) : (
                <Moon className="w-4 h-4 text-ink3" />
              )}
            </button>

            {/* Run Optimizer Pill CTA */}
            <PillButton
              size="sm"
              variant="primary"
              onClick={() => navigate('/clusters')}
              icon={<Zap className="w-3.5 h-3.5 fill-current" />}
            >
              <span className="hidden sm:inline">Run Optimizer</span>
              <span className="sm:hidden">Run</span>
            </PillButton>
          </div>
        </div>

        {/* Thin Status Line below Nav: Run ID, Baseline time, Hard Violations Badge */}
        <div className="flex items-center justify-between text-[11px] px-6 py-1.5 text-ink3">
          <div className="flex items-center gap-3 font-mono truncate">
            <span>
              run:{' '}
              <span className="text-ink font-semibold">{runId || 'run_fixture_mini'}</span>
            </span>
            <span className="hidden sm:inline text-line">•</span>
            <span className="hidden sm:inline">
              dataset: <span className="text-ink">{datasetName}</span>
            </span>
            {lastSolveSeconds !== null && (
              <>
                <span className="text-line">•</span>
                <span>
                  solved in <span className="text-green font-semibold">{lastSolveSeconds.toFixed(2)}s</span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                hardViolations === 0
                  ? 'bg-greenSoft text-green border border-green/30'
                  : 'bg-bad/15 text-bad border border-bad/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{hardViolations} hard violations</span>
            </span>

            <button
              onClick={() => setShortcutsOpen(true)}
              className="hidden md:inline text-ink3 hover:text-ink underline decoration-dotted ml-2"
              title="Keyboard shortcuts (?)"
            >
              ? keys
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area: 24px padding, max-width 1440px */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 pb-16">
        <Outlet />
      </main>

      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Keyboard Shortcuts Dialog */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tile border border-line rounded-tile p-6 max-w-md w-full shadow-hover relative">
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
