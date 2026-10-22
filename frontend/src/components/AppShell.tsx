import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Database,
  Calendar,
  Network,
  BarChart3,
  Sun,
  Moon,
  Component,
  X,
  DatabaseZap,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore, UserRole } from '../store';
import { Segmented } from './Segmented';
import { KeyHintBar } from './KeyHint';
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

  // Auto-initialize default verified baseline on app load
  useEffect(() => {
    if (!runId) {
      api.getRun('run_fixture_mini')
        .then((res) => {
          setRunId('run_fixture_mini');
          setDatasetName('ds_mini');
          if (res.timetable) {
            setTimetable(res.timetable);
            setSolveStatus(res.timetable.solve_seconds, res.timetable.hard_violations);
          }
          if (res.clusters) setClusters(res.clusters);
          if (res.decisions) setDecisions(res.decisions);
        })
        .catch(() => {
          // Graceful fallback if API process is still bootstrapping
        });
    }
  }, [runId, setRunId, setDatasetName, setTimetable, setSolveStatus, setClusters, setDecisions]);

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
        if (k === 'd') navigate('/');
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
      const cachedRunId = 'run_fixture_mini';
      const res = await api.getRun(cachedRunId);

      setRunId(cachedRunId);
      setDatasetName('ds_mini');

      if (res.timetable) {
        setTimetable(res.timetable);
        setSolveStatus(res.timetable.solve_seconds, res.timetable.hard_violations);
      }
      if (res.clusters) {
        setClusters(res.clusters);
      }
      if (res.decisions) {
        setDecisions(res.decisions);
      }

      addToast('Loaded verified run_fixture_mini from disk cache', 'ok');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Error loading cache';
      addToast(msg, 'error');
    } finally {
      setLoadingCache(false);
    }
  };

  const navItems = [
    { to: '/', label: 'Dataset', icon: Database, shortcut: 'g d' },
    { to: '/timetable', label: 'Timetable', icon: Calendar, shortcut: 'g t' },
    { to: '/clusters', label: 'Cluster Lab', icon: Network, shortcut: 'g c' },
    { to: '/benchmarks', label: 'Benchmarks', icon: BarChart3, shortcut: 'g b' },
    { to: '/design', label: 'Design Tokens', icon: Component, shortcut: 'dev' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* 56px Left Rail */}
      <nav
        aria-label="Sidebar Navigation"
        className="w-14 min-w-[56px] h-full border-r border-line bg-panel flex flex-col justify-between items-center py-2 z-40 select-none"
      >
        <div className="flex flex-col items-center gap-1 w-full">
          {/* Logo Mark */}
          <div className="w-10 h-10 border border-line bg-panel-2 rounded-[2px] flex items-center justify-center font-mono font-bold text-accent text-sm mb-3">
            Q
          </div>

          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={`${item.label} (${item.shortcut})`}
                className={`relative group w-11 h-11 flex items-center justify-center rounded-[2px] transition-colors ${
                  isActive
                    ? 'text-accent bg-panel-2 font-semibold'
                    : 'text-text-2 hover:text-text hover:bg-panel-2/60'
                }`}
              >
                {/* 2px Left Accent Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-r-[1px]" />
                )}
                <item.icon className="w-4 h-4 stroke-[1.75]" />

                {/* Flyout Hover Label */}
                <div className="absolute left-[60px] hidden group-hover:flex items-center gap-2 px-2 py-1 bg-panel-2 border border-line text-xs font-medium text-text whitespace-nowrap rounded-[2px] z-50 pointer-events-none">
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] text-text-3">
                    {item.shortcut}
                  </span>
                </div>
              </NavLink>
            );
          })}
        </div>

        {/* Bottom utility */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            title={`Toggle Theme (${theme === 'dark' ? 'Light' : 'Dark'})`}
            className="w-9 h-9 flex items-center justify-center text-text-2 hover:text-text rounded-[2px] hover:bg-panel-2 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 stroke-[1.75]" />
            ) : (
              <Moon className="w-4 h-4 stroke-[1.75]" />
            )}
          </button>
        </div>
      </nav>

      {/* Main Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* 40px Top Status Bar */}
        <header className="h-10 min-h-[40px] px-3 border-b border-line bg-panel flex items-center justify-between text-xs select-none z-30">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-wider text-text uppercase text-[11px]">
              QUANTA
            </span>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1.5 text-text-2">
              <span className="text-[11px] text-text-3">DATASET:</span>
              <span className="font-mono text-text font-medium">{datasetName}</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1.5 text-text-2">
              <span className="text-[11px] text-text-3">RUN:</span>
              <span className="font-mono text-text font-medium">
                {runId || 'none'}
              </span>
            </div>
            {lastSolveSeconds !== null && (
              <>
                <span className="text-line">|</span>
                <span className="font-mono text-text-2">
                  Solved in {lastSolveSeconds.toFixed(1)} s
                </span>
              </>
            )}
            <span className="text-line">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-3">HARD:</span>
              <span
                className={`font-mono font-semibold px-1 py-0.5 rounded-[1px] flex items-center gap-1 ${
                  hardViolations === 0
                    ? 'text-ok bg-ok/10 border border-ok/30'
                    : 'text-bad bg-bad/10 border border-bad/30'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                {hardViolations} violations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleLoadCachedRun}
              disabled={loadingCache}
              title="Load verified fixture run from disk cache"
              className="h-6 px-2 border border-line bg-panel-2 hover:bg-panel text-text-2 hover:text-text font-mono text-[11px] rounded-[2px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <DatabaseZap className="w-3 h-3 text-accent" />
              <span>{loadingCache ? 'Loading...' : 'Load Cached Run'}</span>
            </button>

            <span className="text-line">|</span>

            <div className="flex items-center gap-1.5">
              <Segmented<UserRole>
                size="sm"
                options={[
                  { value: 'coordinator', label: 'Coordinator' },
                  { value: 'researcher', label: 'Researcher' },
                ]}
                value={role}
                onChange={(newRole) => {
                  setRole(newRole);
                  addToast(
                    newRole === 'researcher'
                      ? 'Switched to Researcher role: Physical IBM Quantum QPU and Noisy simulation unlocked'
                      : 'Switched to Coordinator role: Standard classical solver and local simulator mode',
                    'info'
                  );
                }}
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-bg p-3 relative">
          <Outlet />
        </main>

        {/* Shortcut KeyHint Bar */}
        <KeyHintBar onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Keyboard Shortcuts Modal */}
      {shortcutsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-line w-full max-w-sm rounded-[2px] p-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-line mb-3">
              <span className="font-semibold text-text">Keyboard Shortcuts</span>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="text-text-3 hover:text-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 font-mono">
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">g d</span>
                <span className="text-text">Go to Dataset</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">g t</span>
                <span className="text-text">Go to Timetable</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">g c</span>
                <span className="text-text">Go to Cluster Lab</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">g b</span>
                <span className="text-text">Go to Benchmarks</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">r</span>
                <span className="text-text">Trigger primary action</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-text-2">Esc</span>
                <span className="text-text">Close detail drawer/modal</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-2">?</span>
                <span className="text-text">Toggle this shortcut sheet</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
