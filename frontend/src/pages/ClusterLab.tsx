import React, { useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3-force';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Play, Send } from 'lucide-react';
import { useAppStore } from '../store';
import { api, ApiError } from '../api';
import {
  QuantumConfig,
  QuantumResult,
  FinalDecision,
  Job,
} from '../types';
import { Panel } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { Slider } from '../components/Slider';
import { Stepper, StepItem } from '../components/Stepper';
import { Stat } from '../components/Stat';

// 8 Muted Hues Palette from docs/DESIGN_SYSTEM.md
const SLOT_PALETTE: Record<string, string> = {
  D1S1: '#4589FF',
  D1S2: '#8A9BB0',
  D1S3: '#42BE65',
  D1S4: '#B28600',
  D2S1: '#D4749B',
  D2S2: '#6FA8A0',
  D2S3: '#9B8AC4',
  D2S4: '#C98B5A',
};

const DEFAULT_SLOT_COLOR = '#5C6674';

const PIPELINE_STEPS: StepItem[] = [
  { id: 'extract', label: 'Extract' },
  { id: 'qubo', label: 'QUBO' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'sample', label: 'Sample' },
  { id: 'repair', label: 'Repair' },
  { id: 'decide', label: 'Decide' },
];

export const ClusterLabPage: React.FC = () => {
  const {
    role,
    runId,
    clusters,
    setClusters,
    activeClusterId,
    setActiveClusterId,
    addToast,
    decisions,
    setDecisions,
    setTimetable,
  } = useAppStore();

  const [loadingClusters, setLoadingClusters] = useState(false);
  const [runningJob, setRunningJob] = useState<Job | null>(null);
  const [quantumResult, setQuantumResult] = useState<QuantumResult | null>(null);
  const [currentDecision, setCurrentDecision] = useState<FinalDecision | null>(null);
  const [viewMode, setViewMode] = useState<'before' | 'after'>('before');

  // Quantum Config State
  const [backendChoice, setBackendChoice] = useState<'ideal' | 'noisy' | 'ibm'>('ideal');
  const [pChoice, setPChoice] = useState<1 | 2>(1);
  const [optimizerChoice, setOptimizerChoice] = useState<'COBYLA' | 'SPSA'>('COBYLA');
  const [shotsChoice, setShotsChoice] = useState<number>(4096);
  const [sameSlotPenalty, setSameSlotPenalty] = useState<number>(1000);
  const [adjacentSameDayPenalty, setAdjacentSameDayPenalty] = useState<number>(10);
  const [sameDayPenalty, setSameDayPenalty] = useState<number>(1);

  // Load Clusters if empty
  useEffect(() => {
    const fetchClusters = async () => {
      setLoadingClusters(true);
      try {
        const targetRun = runId || 'run_fixture_mini';
        const res = await api.extractClusters(targetRun, 12, 5);
        setClusters(res);
      } catch (err: any) {
        const msg = err instanceof ApiError ? err.message : err.message || 'Error extracting clusters';
        addToast(msg, 'error');
      } finally {
        setLoadingClusters(false);
      }
    };

    if (clusters.length === 0) {
      fetchClusters();
    }
  }, [clusters.length, runId, setClusters, addToast]);

  const activeCluster = useMemo(() => {
    return (
      clusters.find((c) => c.cluster_id === activeClusterId) ||
      clusters[0] ||
      null
    );
  }, [clusters, activeClusterId]);

  // Handle Run Quantum Pipeline
  const handleRunQuantum = async () => {
    if (!activeCluster) return;
    const targetRun = runId || 'run_fixture_mini';

    const cfg: QuantumConfig = {
      backend: backendChoice,
      p: pChoice,
      optimizer: optimizerChoice,
      shots: shotsChoice,
      seed: 7,
      restarts: 5,
      maxiter: 150,
      lambda_cap: 0.0,
      noise_scale: backendChoice === 'noisy' ? 1.0 : undefined,
      penalty_overrides: {
        same_slot: sameSlotPenalty,
        adjacent_same_day: adjacentSameDayPenalty,
        same_day: sameDayPenalty,
      },
    };

    try {
      const initialJob = await api.submitQuantumJob(
        targetRun,
        activeCluster.cluster_id,
        cfg
      );
      setRunningJob(initialJob);

      // Poll until done or error
      let done = false;
      let currentJob = initialJob;
      while (!done) {
        await new Promise((r) => setTimeout(r, 600));
        currentJob = await api.getJob(currentJob.job_id);
        setRunningJob({ ...currentJob });

        if (currentJob.status === 'done' || currentJob.status === 'error') {
          done = true;
        }
      }

      if (currentJob.status === 'error') {
        throw new Error(currentJob.error || 'Quantum execution pipeline failed');
      }

      // Fetch Result & Decision
      const resData = await api.getClusterResult(
        targetRun,
        activeCluster.cluster_id
      );
      setQuantumResult(resData.quantum);
      setCurrentDecision(resData.decision);
      setDecisions([...decisions, resData.decision]);
      setViewMode('after');

      if (resData.decision.source === 'quantum_repaired') {
        addToast(`Accepted: ${resData.decision.reason}`, 'ok');
      } else {
        addToast(`Fallback: ${resData.decision.reason}`, 'warn');
      }
    } catch (err: any) {
      setRunningJob(null);
      const msg = err instanceof ApiError ? err.message : err.message || 'Quantum run failed';
      addToast(msg, 'error');
    }
  };

  // Keyboard shortcut: 'r' to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'r' && !runningJob && activeCluster) {
        e.preventDefault();
        handleRunQuantum();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runningJob, activeCluster, handleRunQuantum]);

  // Handle Publish accepted cluster
  const handlePublish = async () => {
    if (!activeCluster || !currentDecision) return;
    const targetRun = runId || 'run_fixture_mini';

    try {
      const res = await api.publish(targetRun, [activeCluster.cluster_id]);
      setTimetable(res.timetable);
      addToast(
        `Timetable updated & published with 0 hard violations! CSV: ${res.export_url}`,
        'ok'
      );
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Publish failed';
      addToast(msg, 'error');
    }
  };

  // D3 Graph Simulation Nodes & Links
  const graphData = useMemo(() => {
    if (!activeCluster) return { nodes: [], links: [] };

    // Changes map for after view
    const changesMap: Record<string, string> = {};
    if (currentDecision?.source === 'quantum_repaired') {
      currentDecision.changes.forEach(([cid, , toSlot]) => {
        changesMap[cid] = toSlot;
      });
    }

    const nodes = activeCluster.courses.map((courseId) => {
      const initialSlot = activeCluster.candidates[courseId]?.[0] || 'D1S1';
      const updatedSlot = changesMap[courseId] || initialSlot;
      const effectiveSlot = viewMode === 'after' ? updatedSlot : initialSlot;
      const enrollment = activeCluster.sizes[courseId] || 15;

      return {
        id: courseId,
        slot: effectiveSlot,
        enrollment,
        radius: Math.max(16, Math.min(28, 12 + enrollment * 0.8)),
      };
    });

    const links = activeCluster.pair_weights
      .filter((pw) => activeCluster.courses.includes(pw.a) && activeCluster.courses.includes(pw.b))
      .map((pw) => ({
        source: pw.a,
        target: pw.b,
        shared_students: pw.shared_students,
        strokeWidth: Math.max(1, Math.min(5, pw.shared_students * 0.6)),
      }));

    return { nodes, links };
  }, [activeCluster, currentDecision, viewMode]);

  // D3 force simulation refs
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const width = 460;
  const height = 340;

  useEffect(() => {
    if (graphData.nodes.length === 0) return;

    const simNodes = graphData.nodes.map((n) => ({ ...n }));
    const simLinks = graphData.links.map((l) => ({ ...l }));

    const sim = d3
      .forceSimulation(simNodes as any)
      .force(
        'link',
        d3
          .forceLink(simLinks as any)
          .id((d: any) => d.id)
          .distance(70)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.radius + 6))
      .stop();

    // Run ticks synchronously for deterministic stable positioning
    for (let i = 0; i < 140; ++i) sim.tick();

    const posMap: Record<string, { x: number; y: number }> = {};
    simNodes.forEach((node: any) => {
      posMap[node.id] = {
        x: Math.max(30, Math.min(width - 30, node.x)),
        y: Math.max(30, Math.min(height - 30, node.y)),
      };
    });
    setPositions(posMap);
  }, [graphData.nodes.length, activeClusterId]);

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden">
      {/* LEFT COLUMN: Ranked Cluster List */}
      <div className="w-64 min-w-[250px] h-full flex flex-col border border-line bg-panel rounded-[2px] overflow-hidden">
        <div className="h-8 px-3 border-b border-line bg-panel-2 flex items-center justify-between text-xs font-semibold text-text uppercase">
          <span>Ranked Clusters</span>
          <span className="font-mono text-[10px] text-text-3">
            {clusters.length} FOUND
          </span>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-line">
          {loadingClusters ? (
            <div className="p-3 text-xs font-mono text-text-3 animate-pulse">
              Extracting bottleneck clusters...
            </div>
          ) : (
            clusters.map((cl, idx) => {
              const isSelected = cl.cluster_id === activeCluster?.cluster_id;
              return (
                <div
                  key={cl.cluster_id}
                  onClick={() => setActiveClusterId(cl.cluster_id)}
                  className={`p-2.5 transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-accent/15 border-l-2 border-l-accent'
                      : 'hover:bg-panel-2/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-text">
                      {cl.cluster_id}
                    </span>
                    <span className="text-[10px] font-mono text-text-3">
                      Rank #{idx + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-1 text-[11px] font-mono text-text-2">
                    <div>
                      <span className="text-text-3 text-[9px] block">COURSES</span>
                      <span>{cl.courses.length}</span>
                    </div>
                    <div>
                      <span className="text-text-3 text-[9px] block">AFFECTED</span>
                      <span>{cl.affected_students}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-text-3 text-[9px] block">PENALTY</span>
                      <span className="text-warn">{cl.baseline_cluster_cost}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CENTER COLUMN: SVG Conflict Subgraph & Results */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto space-y-3">
        {/* Graph Visualizer Panel */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase">
                {activeCluster ? activeCluster.cluster_id : 'Cluster'}
              </span>
              <span className="text-text-3">— Conflict Subgraph</span>
            </div>
          }
          headerRight={
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-3 font-mono">STATE:</span>
              <Segmented<'before' | 'after'>
                size="sm"
                options={[
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            </div>
          }
          bodyClassName="p-2 flex flex-col items-center bg-bg/50"
        >
          {/* SVG Canvas */}
          <div className="w-full flex justify-center">
            <svg
              width={width}
              height={height}
              className="border border-line/50 rounded-[2px] bg-panel select-none"
            >
              <defs>
                <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#4589FF" />
                </filter>
              </defs>

              {/* Conflict Links */}
              {graphData.links.map((link, idx) => {
                const sPos = positions[link.source as string];
                const tPos = positions[link.target as string];
                if (!sPos || !tPos) return null;

                return (
                  <line
                    key={idx}
                    x1={sPos.x}
                    y1={sPos.y}
                    x2={tPos.x}
                    y2={tPos.y}
                    stroke="var(--line)"
                    strokeWidth={link.strokeWidth}
                    strokeOpacity={0.8}
                  />
                );
              })}

              {/* Course Nodes */}
              {graphData.nodes.map((node) => {
                const pos = positions[node.id];
                if (!pos) return null;
                const fillColor = SLOT_PALETTE[node.slot] || DEFAULT_SLOT_COLOR;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                  >
                    {/* Circle with animated fill transition (150ms per DESIGN_SYSTEM.md) */}
                    <circle
                      r={node.radius}
                      fill={fillColor}
                      stroke="var(--panel-2)"
                      strokeWidth={1.5}
                      style={{ transition: 'fill 150ms ease-in-out' }}
                    />
                    <text
                      textAnchor="middle"
                      dy=".35em"
                      className="font-mono text-[11px] font-bold fill-white pointer-events-none select-none"
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend Strip with slot day/time */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[10px] font-mono text-text-2">
            {Object.entries(SLOT_PALETTE).map(([slotId, color]) => (
              <div key={slotId} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-[1px] flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{slotId}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Live Stepper & Energy Trace during Execution */}
        {runningJob && (
          <Panel title="QAOA PIPELINE EXECUTION ENGINE">
            <div className="space-y-3">
              <Stepper
                steps={PIPELINE_STEPS}
                currentStepId={runningJob.stage.toLowerCase()}
              />

              {runningJob.energy_trace.length > 0 && (
                <div className="h-36 w-full pt-2">
                  <span className="text-[11px] font-mono text-text-3 block mb-1">
                    QAOA EXPECTATION ENERGY TRACE E(γ, β)
                  </span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={runningJob.energy_trace.map((e, idx) => ({
                        iter: idx + 1,
                        energy: e,
                      }))}
                    >
                      <XAxis
                        dataKey="iter"
                        stroke="var(--line)"
                        tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <YAxis
                        stroke="var(--line)"
                        domain={['auto', 'auto']}
                        tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--panel)',
                          borderColor: 'var(--line)',
                          borderRadius: '2px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      />
                      {quantumResult?.ground_energy !== undefined && (
                        <ReferenceLine
                          y={quantumResult.ground_energy || 118}
                          stroke="var(--text-2)"
                          strokeDasharray="3 3"
                          label={{
                            value: 'Brute Force Ground',
                            fill: 'var(--text-2)',
                            fontSize: 10,
                            fontFamily: 'monospace',
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="energy"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* On Done: Decision Panel & Histogram & Diff Table */}
        {currentDecision && (
          <div className="space-y-3">
            {/* (a) Decision Panel with ok/warn left border */}
            <Panel
              title="GATE SAFETY EVALUATION & REPAIR DECISION"
              borderLeft={currentDecision.source === 'quantum_repaired' ? 'ok' : 'warn'}
              headerRight={
                currentDecision.source === 'quantum_repaired' ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    className="px-2.5 py-1 bg-ok text-white font-mono text-[11px] font-bold rounded-[2px] flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                  >
                    <Send className="w-3 h-3" /> Publish Resolution
                  </button>
                ) : null
              }
            >
              <div className="space-y-3">
                <p className="text-xs font-mono font-medium text-text bg-panel-2 p-2 rounded-[2px] border border-line">
                  {currentDecision.reason}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                  <Stat
                    label="BEFORE SCORE"
                    value={currentDecision.before_score}
                    variant="warn"
                  />
                  <Stat
                    label="AFTER SCORE"
                    value={currentDecision.after_score}
                    variant={
                      currentDecision.after_score < currentDecision.before_score
                        ? 'ok'
                        : 'default'
                    }
                  />
                  <Stat
                    label="RESOLVED STUDENTS"
                    value={currentDecision.resolved_students}
                    variant="accent"
                  />
                  <Stat
                    label="HARD VIOLATIONS"
                    value={currentDecision.hard_violations}
                    variant="ok"
                  />
                  <Stat
                    label="FEASIBLE FRACTION"
                    value={`${(currentDecision.feasible_fraction * 100).toFixed(0)}%`}
                    variant="default"
                  />
                </div>
              </div>
            </Panel>

            {/* (b) Top Bitstrings Histogram */}
            {quantumResult?.top_bitstrings && (
              <Panel title="TOP MEASURED BITSTRINGS HISTOGRAM">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={quantumResult.top_bitstrings.slice(0, 8).map((b, i) => ({
                        bits: b.bits,
                        count: b.count,
                        energy: b.energy,
                        isFeasible: i === 0 || b.energy <= (quantumResult.best_sampled_energy || 130),
                      }))}
                    >
                      <XAxis
                        dataKey="bits"
                        stroke="var(--line)"
                        tick={{
                          fill: 'var(--text-2)',
                          fontSize: 10,
                          fontFamily: 'monospace',
                        }}
                      />
                      <YAxis
                        stroke="var(--line)"
                        tick={{
                          fill: 'var(--text-3)',
                          fontSize: 10,
                          fontFamily: 'monospace',
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--panel)',
                          borderColor: 'var(--line)',
                          borderRadius: '2px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      />
                      <Bar dataKey="count">
                        {quantumResult.top_bitstrings.slice(0, 8).map((entry, index) => {
                          const isFeasible =
                            index === 0 ||
                            entry.energy <= (quantumResult.best_sampled_energy || 130);
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isFeasible ? 'var(--accent)' : 'var(--text-3)'}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* (c) Diff Table */}
            <Panel title="SCHEDULE MODIFICATION DIFF TABLE">
              {currentDecision.changes.length === 0 ? (
                <div className="text-xs font-mono text-text-3 p-2">
                  No slot reassignments applied. CP-SAT baseline preserved unchanged.
                </div>
              ) : (
                <div className="border border-line rounded-[2px] overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-panel-2 border-b border-line text-[10px] text-text-3 uppercase">
                      <tr>
                        <th className="p-2 text-left">Course</th>
                        <th className="p-2 text-left">From Slot</th>
                        <th className="p-2 text-left">To Slot</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {currentDecision.changes.map(([courseId, fromSlot, toSlot]) => (
                        <tr key={courseId} className="hover:bg-panel-2/50">
                          <td className="p-2 font-bold text-text">{courseId}</td>
                          <td className="p-2 text-text-2">{fromSlot}</td>
                          <td className="p-2 text-accent font-semibold">{toSlot}</td>
                          <td className="p-2 text-right text-ok font-semibold">
                            OPTIMIZED
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Quantum Configuration Panel */}
      <div className="w-80 min-w-[300px] h-full border border-line bg-panel rounded-[2px] flex flex-col overflow-hidden">
        <div className="h-8 px-3 border-b border-line bg-panel-2 flex items-center justify-between text-xs font-semibold text-text uppercase">
          <span>QAOA Optimization Config</span>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          {/* Backend Selector */}
          <div>
            <span className="text-[11px] font-mono text-text-3 block mb-1">
              QUANTUM BACKEND
            </span>
            <Segmented<'ideal' | 'noisy' | 'ibm'>
              options={[
                { value: 'ideal', label: 'Simulator' },
                {
                  value: 'noisy',
                  label: 'Noisy',
                  disabled: role !== 'researcher',
                  tooltip:
                    role !== 'researcher'
                      ? 'Requires researcher role authorization'
                      : undefined,
                },
                {
                  value: 'ibm',
                  label: 'IBM QPU',
                  disabled: role !== 'researcher',
                  tooltip:
                    role !== 'researcher'
                      ? 'Requires researcher role authorization'
                      : undefined,
                },
              ]}
              value={backendChoice}
              onChange={setBackendChoice}
            />
          </div>

          {/* Depth p */}
          <div>
            <span className="text-[11px] font-mono text-text-3 block mb-1">
              CIRCUIT LAYERS (p)
            </span>
            <Segmented<1 | 2>
              options={[
                { value: 1, label: 'p = 1' },
                { value: 2, label: 'p = 2' },
              ]}
              value={pChoice}
              onChange={setPChoice}
            />
          </div>

          {/* Classical Optimizer */}
          <div>
            <span className="text-[11px] font-mono text-text-3 block mb-1">
              CLASSICAL OPTIMIZER
            </span>
            <select
              value={optimizerChoice}
              onChange={(e) => setOptimizerChoice(e.target.value as any)}
              className="w-full h-7 px-2 border border-line bg-panel-2 rounded-[2px] font-mono text-xs text-text focus:outline-none"
            >
              <option value="COBYLA">COBYLA (Constrained Optimization)</option>
              <option value="SPSA">SPSA (Simultaneous Perturbation)</option>
            </select>
          </div>

          {/* Shots */}
          <div>
            <span className="text-[11px] font-mono text-text-3 block mb-1">
              MEASUREMENT SHOTS
            </span>
            <input
              type="number"
              value={shotsChoice}
              onChange={(e) => setShotsChoice(parseInt(e.target.value, 10) || 1024)}
              step={1024}
              min={1024}
              max={16384}
              className="w-full h-7 px-2 border border-line bg-panel-2 rounded-[2px] font-mono text-xs text-text focus:outline-none"
            />
          </div>

          {/* Penalty Sliders */}
          <div className="pt-2 border-t border-line space-y-3">
            <span className="text-[11px] font-semibold text-text uppercase tracking-wider block">
              QUBO Penalty Weights
            </span>

            <Slider
              label="Same Slot Penalty (Hard)"
              value={sameSlotPenalty}
              min={100}
              max={2000}
              step={100}
              defaultValue={1000}
              onChange={setSameSlotPenalty}
              onReset={() => setSameSlotPenalty(1000)}
            />

            <Slider
              label="Adjacent Same Day (Fatigue)"
              value={adjacentSameDayPenalty}
              min={1}
              max={50}
              step={1}
              defaultValue={10}
              onChange={setAdjacentSameDayPenalty}
              onReset={() => setAdjacentSameDayPenalty(10)}
            />

            <Slider
              label="Same Day Spread"
              value={sameDayPenalty}
              min={0}
              max={10}
              step={1}
              defaultValue={1}
              onChange={setSameDayPenalty}
              onReset={() => setSameDayPenalty(1)}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="p-3 border-t border-line bg-panel-2">
          <button
            type="button"
            disabled={!activeCluster || !!runningJob}
            onClick={handleRunQuantum}
            className={`w-full h-8 flex items-center justify-center gap-2 font-medium text-xs rounded-[2px] transition-colors select-none cursor-pointer ${
              !activeCluster || !!runningJob
                ? 'bg-line text-text-3 cursor-not-allowed opacity-50'
                : 'bg-accent text-bg hover:opacity-90 font-semibold'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {runningJob ? 'Optimizing Quantum Circuit...' : 'Run QAOA Pipeline (r)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
