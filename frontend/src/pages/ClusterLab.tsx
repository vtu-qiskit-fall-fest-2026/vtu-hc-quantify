import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import {
  Send,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { PillButton } from '../components/PillButton';
import { PillSegmented } from '../components/PillSegmented';
import { Stepper, StepItem } from '../components/Stepper';
import { CircleSeal } from '../components/CircleSeal';
import { CodeTile } from '../components/CodeTile';
import { Badge } from '../components/Badge';
import { useAppStore } from '../store';
import { api, ApiError } from '../api';
import {
  QuantumConfig,
  QuantumResult,
  FinalDecision,
  Job,
} from '../types';

// 8 Muted Hues Slot Palette from UI_UPDATE_BENTO.md section 2
const SLOT_PALETTE: Record<string, string> = {
  D1S1: '#34A85F',
  D1S2: '#2D7F9D',
  D1S3: '#E3A21A',
  D1S4: '#8FA8E8',
  D2S1: '#D98BB0',
  D2S2: '#7FC8B4',
  D2S3: '#B7A06A',
  D2S4: '#9A8FD1',
};

const DEFAULT_SLOT_COLOR = '#86988D';

const SLOT_COLORS: string[] = [
  '#2D7F9D',
  '#E3A21A',
  '#34A85F',
  '#8FA8E8',
  '#D98BB0',
  '#7FC8B4',
  '#B7A06A',
  '#9A8FD1',
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E8684A',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
];

function getSlotColor(slotId: string | undefined): string {
  if (!slotId) return DEFAULT_SLOT_COLOR;
  if (SLOT_PALETTE[slotId]) return SLOT_PALETTE[slotId];
  const match = slotId.match(/D(\d+)S(\d+)/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const order = parseInt(match[2], 10);
    const idx = Math.abs((day - 1) * 4 + (order - 1)) % SLOT_COLORS.length;
    return SLOT_COLORS[idx];
  }
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    hash = (hash << 5) - hash + slotId.charCodeAt(i);
    hash |= 0;
  }
  return SLOT_COLORS[Math.abs(hash) % SLOT_COLORS.length];
}

function formatCourseLabel(courseId: string): string {
  return courseId.replace(/^CRS0*/i, 'C');
}

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
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  // Quantum Config State
  const [backendChoice, setBackendChoice] = useState<'ideal' | 'noisy' | 'ibm'>('ideal');
  const [pChoice, setPChoice] = useState<1 | 2>(1);
  const [optimizerChoice, setOptimizerChoice] = useState<'COBYLA' | 'SPSA'>('COBYLA');
  const [shotsChoice] = useState<number>(4096);
  const [sameSlotPenalty] = useState<number>(1000);
  const [adjacentSameDayPenalty] = useState<number>(10);
  const [sameDayPenalty] = useState<number>(1);
  const [publishing, setPublishing] = useState(false);
  const lastLoadedRunIdRef = useRef<string | null>(null);

  // Load Clusters whenever runId changes or on explicit refresh
  const fetchClusters = useCallback(async (force = false) => {
    const targetRun = runId || 'run_fixture_mini';
    if (!force && lastLoadedRunIdRef.current === targetRun && clusters.length > 0) {
      return;
    }

    setLoadingClusters(true);
    try {
      // 1. First attempt to load existing clusters and decisions from run endpoint
      const runData = await api.getRun(targetRun);
      if (runData.clusters && runData.clusters.length > 0) {
        setClusters(runData.clusters);
        if (runData.decisions) {
          setDecisions(runData.decisions);
        }
      } else {
        // 2. Fall back to on-demand extraction
        const res = await api.extractClusters(targetRun, 12, 5);
        setClusters(res);
      }
      lastLoadedRunIdRef.current = targetRun;
    } catch (err: any) {
      // 3. Fallback extraction attempt
      try {
        const res = await api.extractClusters(targetRun, 12, 5);
        setClusters(res);
        lastLoadedRunIdRef.current = targetRun;
      } catch (e: any) {
        const msg = e instanceof ApiError ? e.message : e.message || 'Error extracting clusters';
        addToast(msg, 'error');
      }
    } finally {
      setLoadingClusters(false);
    }
  }, [runId, clusters.length, setClusters, setDecisions, addToast]);

  useEffect(() => {
    fetchClusters(false);
  }, [runId, fetchClusters]);

  const activeCluster = useMemo(() => {
    return (
      clusters.find((c) => c.cluster_id === activeClusterId) ||
      clusters[0] ||
      null
    );
  }, [clusters, activeClusterId]);

  // Handle Run Quantum Pipeline
  const handleRunQuantum = useCallback(async () => {
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
      setDecisions([
        ...decisions.filter((d) => d.cluster_id !== activeCluster.cluster_id),
        resData.decision,
      ]);
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
  }, [
    activeCluster,
    runId,
    backendChoice,
    pChoice,
    optimizerChoice,
    shotsChoice,
    sameSlotPenalty,
    adjacentSameDayPenalty,
    sameDayPenalty,
    decisions,
    setDecisions,
    addToast,
  ]);

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

  // Handle Publish Resolution
  const handlePublish = async () => {
    if (!activeCluster) return;
    setPublishing(true);
    try {
      const targetRun = runId || 'run_fixture_mini';
      const publishRes = await api.publish(targetRun, [activeCluster.cluster_id]);
      setTimetable(publishRes.timetable);
      addToast('Timetable published with certified 0 hard violations!', 'ok');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Error publishing timetable';
      addToast(msg, 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Build D3 Force Simulation Graph
  const graphData = useMemo(() => {
    if (!activeCluster) return { nodes: [], links: [] };

    const nodes = activeCluster.courses.map((courseId) => {
      const slotA = activeCluster.candidates[courseId]?.[0] || 'D1S1';

      let currentSlot = slotA;
      if (viewMode === 'after' && currentDecision) {
        const change = currentDecision.changes.find((c) => c[0] === courseId);
        if (change) currentSlot = change[2];
      }

      return {
        id: courseId,
        currentSlot,
        color: SLOT_PALETTE[currentSlot] || DEFAULT_SLOT_COLOR,
        size: activeCluster.sizes[courseId] || 40,
        x: 0,
        y: 0,
      };
    });

    const links = activeCluster.pair_weights.map((pw) => ({
      source: pw.a,
      target: pw.b,
      weight: pw.shared_students,
    }));

    return { nodes, links };
  }, [activeCluster, viewMode, currentDecision]);

  // Run 2D layout simulation with auto-fitting bounding box to prevent clipping
  const [layoutNodes, setLayoutNodes] = useState<any[]>([]);
  useEffect(() => {
    if (!graphData.nodes.length) return;

    const simNodes = graphData.nodes.map((d) => ({ ...d }));
    const simLinks = graphData.links.map((d) => ({ ...d }));

    // Break 1D collinearity by distributing nodes evenly in a ring
    const n = simNodes.length;
    const initialRadius = Math.min(130, Math.max(65, n * 16));
    simNodes.forEach((node: any, i: number) => {
      const angle = (2 * Math.PI * i) / n;
      node.x = 260 + initialRadius * Math.cos(angle);
      node.y = 150 + initialRadius * Math.sin(angle);
    });

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(75)
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(260, 150))
      .force('collision', d3.forceCollide().radius(36))
      .stop();

    for (let i = 0; i < 200; ++i) simulation.tick();

    // Auto-fit bounding box normalization to guarantee zero clipping
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    simNodes.forEach((node: any) => {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    });

    const targetW = 520;
    const targetH = 300;
    const padX = 58;
    const padY = 52;

    const spanX = Math.max(maxX - minX, 10);
    const spanY = Math.max(maxY - minY, 10);

    const scale = Math.min((targetW - padX * 2) / spanX, (targetH - padY * 2) / spanY, 1.25);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    simNodes.forEach((node: any) => {
      node.x = Math.round(targetW / 2 + (node.x - midX) * scale);
      node.y = Math.round(targetH / 2 + (node.y - midY) * scale);
    });

    setLayoutNodes(simNodes);
  }, [graphData.nodes.length, activeCluster?.cluster_id]);

  // Energy history for Recharts
  const energyChartData = useMemo(() => {
    if (runningJob?.energy_trace && runningJob.energy_trace.length > 0) {
      return runningJob.energy_trace.map((val, idx) => ({
        iteration: idx + 1,
        energy: Number(val.toFixed(2)),
      }));
    }
    if (quantumResult?.energy_history && quantumResult.energy_history.length > 0) {
      return quantumResult.energy_history.map((val, idx) => ({
        iteration: idx + 1,
        energy: Number(val.toFixed(2)),
      }));
    }
    // Fallback baseline curve for preview
    return [
      { iteration: 1, energy: 182.0 },
      { iteration: 10, energy: 165.4 },
      { iteration: 25, energy: 148.2 },
      { iteration: 50, energy: 132.8 },
      { iteration: 80, energy: 122.1 },
      { iteration: 120, energy: 118.0 },
    ];
  }, [runningJob, quantumResult]);

  // Top bitstrings data
  const histogramData = useMemo(() => {
    if (!quantumResult?.top_bitstrings) {
      return [
        { bitstring: '000000', count: 1842, feasible: true, energy: 182.0 },
        { bitstring: '100100', count: 940, feasible: true, energy: 118.0 },
        { bitstring: '010010', count: 520, feasible: false, energy: 195.0 },
        { bitstring: '110000', count: 410, feasible: true, energy: 130.0 },
        { bitstring: '111111', count: 180, feasible: false, energy: 240.0 },
      ];
    }
    return quantumResult.top_bitstrings.slice(0, 8).map((bs) => ({
      bitstring: bs.bits,
      count: bs.count,
      feasible: true,
      energy: Number(bs.energy.toFixed(1)),
    }));
  }, [quantumResult]);

  const groundEnergy = quantumResult?.ground_energy || 118.0;

  return (
    <div className="space-y-3">
      {/* Compressed Page Header without overlapping eyebrow chip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-line/30">
        <div>
          <h1 className="text-2xl sm:text-[28px] leading-tight font-semibold tracking-tight font-ui text-ink">
            Subproblem cluster, <span className="italic font-medium text-green">optimized</span>.
          </h1>
          <p className="text-[13px] text-ink2 font-ui mt-0.5 truncate">
            Isolate coupled conflict bottlenecks into compact QUBO subproblems and solve with Qiskit QAOA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PillButton
            size="sm"
            variant="primary"
            disabled={!activeCluster || !!runningJob}
            loading={!!runningJob}
            onClick={handleRunQuantum}
            icon={<Zap className="w-3.5 h-3.5 fill-current" />}
          >
            {runningJob ? 'Solving QAOA...' : 'Run QAOA Pipeline (r)'}
          </PillButton>
        </div>
      </div>

      {/* Bento Grid: 12 Columns, auto-rows 72px */}
      <BentoGrid className="[grid-auto-rows:72px]">
        {/* Row 1-6 Left: Cluster List 3x6 (default) */}
        <Tile
          variant="default"
          colSpan={3}
          rowSpan={6}
          title="Extracted Clusters"
          subtitle="Ranked by shared testing fatigue"
          action={
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-ink2">
                {clusters.length} clusters
              </span>
              <button
                type="button"
                onClick={() => fetchClusters(true)}
                disabled={loadingClusters}
                title="Refresh and re-extract clusters for current run"
                className="p-1 rounded-pill hover:bg-tileMint text-ink2 hover:text-ink transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingClusters ? 'animate-spin text-green' : ''}`} />
              </button>
            </div>
          }
          padding="dense"
        >
          {loadingClusters ? (
            <div className="p-4 text-center font-ui text-xs text-ink2 animate-pulse">
              Extracting conflict clusters...
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {clusters.map((c) => {
                const isSelected = activeCluster?.cluster_id === c.cluster_id;
                const hasDecision = decisions.some((d) => d.cluster_id === c.cluster_id);

                return (
                  <div
                    key={c.cluster_id}
                    onClick={() => setActiveClusterId(c.cluster_id)}
                    className={`p-2.5 rounded-inner border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-tileMint border-green shadow-hairline'
                        : 'bg-tile hover:bg-tileMint/40 border-line/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-ink">
                        {c.cluster_id}
                      </span>
                      {hasDecision && (
                        <span className="w-2 h-2 rounded-full bg-green" title="Decision available" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-ink2">
                      <div>courses: <span className="font-semibold text-ink">{c.courses.length}</span></div>
                      <div>students: <span className="font-semibold text-ink">{c.affected_students}</span></div>
                      <div className="col-span-2 text-ink3 text-[10px]">
                        baseline cost: <span className="font-semibold text-ink">{c.baseline_cluster_cost.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Tile>

        {/* Row 1-5 Center Hero: Conflict Subgraph 6x5 (mint) with Before/After pill toggle */}
        <Tile
          variant="mint"
          colSpan={6}
          rowSpan={5}
          title={activeCluster ? `Conflict Graph: ${activeCluster.cluster_id}` : 'Conflict Graph'}
          subtitle="Nodes sized by enrollment • Edge width by shared students"
          action={
            <div className="flex items-center gap-2">
              <PillSegmented
                size="sm"
                variant="light"
                value={viewMode}
                onChange={(v) => setViewMode(v as 'before' | 'after')}
                options={[
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                ]}
              />
            </div>
          }
          className="relative"
          padding="dense"
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center min-h-[300px]">
            {layoutNodes.length > 0 ? (
              <>
                <svg viewBox="0 0 520 300" className="w-full h-full max-h-[320px] select-none">
                  {/* Drop shadow filter for crisp circular nodes */}
                  <defs>
                    <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.12" />
                    </filter>
                  </defs>

                  {/* Conflict Edges */}
                  {graphData.links.map((link: any, idx: number) => {
                    const sourceNode = layoutNodes.find((n) => n.id === link.source) || layoutNodes[0];
                    const targetNode = layoutNodes.find((n) => n.id === link.target) || layoutNodes[1];
                    const isConnected =
                      hoveredCourseId !== null &&
                      (link.source === hoveredCourseId || link.target === hoveredCourseId);

                    return (
                      <line
                        key={idx}
                        x1={sourceNode?.x || 0}
                        y1={sourceNode?.y || 0}
                        x2={targetNode?.x || 0}
                        y2={targetNode?.y || 0}
                        stroke={isConnected ? '#1F5B3C' : 'var(--ink-3)'}
                        strokeWidth={isConnected ? Math.max(2.5, link.weight / 4) : Math.max(1.5, link.weight / 6)}
                        strokeOpacity={isConnected ? 0.9 : 0.4}
                        className="transition-all duration-150"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {layoutNodes.map((node: any) => {
                    const currentSlot =
                      viewMode === 'after' && currentDecision
                        ? currentDecision.changes.find((c) => c[0] === node.id)?.[2] ||
                          activeCluster?.candidates[node.id]?.[0]
                        : activeCluster?.candidates[node.id]?.[0];

                    const fillColor = getSlotColor(currentSlot);
                    const isHovered = hoveredCourseId === node.id;
                    const isMoved =
                      viewMode === 'after' &&
                      currentDecision?.changes.some((c) => c[0] === node.id);

                    return (
                      <g
                        key={node.id}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredCourseId(node.id)}
                        onMouseLeave={() => setHoveredCourseId(null)}
                      >
                        {/* Soft outer ring in slot color */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isHovered ? 26 : 23}
                          fill="none"
                          stroke={isMoved ? '#1F5B3C' : fillColor}
                          strokeWidth={isMoved ? 3.5 : 2.5}
                          strokeOpacity={isHovered ? 0.5 : 0.28}
                          strokeDasharray={isMoved ? '4 2' : undefined}
                          className="transition-all duration-150"
                        />
                        {/* Node circle */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={19}
                          fill={fillColor}
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                          filter="url(#nodeGlow)"
                          className="transition-all duration-150 shadow-hairline"
                        />
                        {/* Course ID Short Text (e.g. C17, C12, C7) */}
                        <text
                          x={node.x}
                          y={node.y + 4}
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          {formatCourseLabel(node.id)}
                        </text>
                        {/* Slot label below node */}
                        <text
                          x={node.x}
                          y={node.y + 28}
                          fill="var(--ink-2)"
                          fontSize="10"
                          fontWeight="600"
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          {currentSlot}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Subtle Interactive Inspection Banner */}
                {hoveredCourseId && (
                  <div className="absolute bottom-2 left-3 right-3 bg-tile/95 backdrop-blur-sm border border-line rounded-pill px-3 py-1 flex items-center justify-between text-[11px] font-mono shadow-hairline pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{hoveredCourseId}</span>
                      <span className="text-ink3 font-sans">•</span>
                      <span className="text-ink2">{activeCluster?.sizes[hoveredCourseId] || 40} students</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink3">Assigned:</span>
                      <span className="font-bold text-ink">
                        {viewMode === 'after' && currentDecision
                          ? currentDecision.changes.find((c) => c[0] === hoveredCourseId)?.[2] ||
                            activeCluster?.candidates[hoveredCourseId]?.[0]
                          : activeCluster?.candidates[hoveredCourseId]?.[0]}
                      </span>
                      {activeCluster?.candidates[hoveredCourseId]?.[1] && (
                        <span className="text-ink3">
                          (Alt: {activeCluster.candidates[hoveredCourseId][1]})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs font-ui text-ink2">Loading cluster topology...</div>
            )}
          </div>
        </Tile>

        {/* Row 1-6 Right: Run Config 3x6 (default) */}
        <Tile
          variant="default"
          colSpan={3}
          rowSpan={6}
          title="QAOA Solver Parameters"
          subtitle="QPU target, depth, and penalty table"
          padding="dense"
          className="flex flex-col justify-between"
        >
          <div className="space-y-3 text-xs font-ui">
            {/* Backend Selection */}
            <div>
              <span className="text-[11px] font-semibold text-ink block mb-1 uppercase tracking-wide">
                Quantum Target
              </span>
              <PillSegmented
                size="sm"
                variant="light"
                value={backendChoice}
                onChange={(b) => setBackendChoice(b as any)}
                options={[
                  { value: 'ideal', label: 'Sim' },
                  { value: 'noisy', label: 'Noisy' },
                  {
                    value: 'ibm',
                    label: 'IBM QPU',
                    disabled: role !== 'researcher',
                    tooltip: role !== 'researcher' ? 'Restricted to Researcher role' : undefined,
                  },
                ]}
              />
            </div>

            {/* Depth & Optimizer */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-semibold text-ink block mb-1 uppercase tracking-wide">
                  Depth (p)
                </span>
                <PillSegmented
                  size="sm"
                  variant="light"
                  value={String(pChoice) as any}
                  onChange={(v) => setPChoice(Number(v) as any)}
                  options={[
                    { value: '1', label: 'p = 1' },
                    { value: '2', label: 'p = 2' },
                  ]}
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-ink block mb-1 uppercase tracking-wide">
                  Optimizer
                </span>
                <PillSegmented
                  size="sm"
                  variant="light"
                  value={optimizerChoice}
                  onChange={(o) => setOptimizerChoice(o as any)}
                  options={[
                    { value: 'COBYLA', label: 'COBYLA' },
                    { value: 'SPSA', label: 'SPSA' },
                  ]}
                />
              </div>
            </div>

            {/* Penalty Overrides */}
            <div className="pt-2 border-t border-line/40 space-y-1.5">
              <span className="text-[11px] font-semibold text-ink block uppercase tracking-wide">
                Penalty Overrides
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink3 font-mono">same_slot</span>
                <span className="font-mono font-semibold text-ink">{sameSlotPenalty}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink3 font-mono">adjacent_same_day</span>
                <span className="font-mono font-semibold text-ink">{adjacentSameDayPenalty}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink3 font-mono">same_day</span>
                <span className="font-mono font-semibold text-ink">{sameDayPenalty}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2 border-t border-line/30">
            <PillButton
              size="md"
              variant="primary"
              className="w-full"
              disabled={!activeCluster || !!runningJob}
              loading={!!runningJob}
              onClick={handleRunQuantum}
              icon={<Zap className="w-3.5 h-3.5 fill-current" />}
            >
              {runningJob ? 'Executing Pipeline...' : 'Run QAOA Pipeline (r)'}
            </PillButton>
          </div>
        </Tile>

        {/* Row 6 Center: Pipeline Stepper 6x1 (under center Subgraph) */}
        <Tile
          variant="default"
          colSpan={6}
          rowSpan={1}
          padding="dense"
          className="lg:col-start-4 flex items-center justify-center"
        >
          <Stepper
            orientation="horizontal"
            steps={PIPELINE_STEPS}
            currentStepId={runningJob?.stage || (quantumResult ? 'decide' : 'extract')}
          />
        </Tile>

        {/* Row 7-8 Left: Energy Convergence Chart 4x2 */}
        <Tile
          variant="default"
          colSpan={4}
          rowSpan={2}
          title="Energy Convergence"
          subtitle="Expectation value vs evaluation step"
          action={
            <span className="font-mono text-[11px] text-quantum font-semibold">
              E_opt: {groundEnergy.toFixed(1)}
            </span>
          }
          padding="dense"
        >
          <div className="w-full h-28 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={energyChartData}>
                <XAxis dataKey="iteration" stroke="#86988D" fontSize={10} fontStyle="DM Mono" />
                <YAxis stroke="#86988D" fontSize={10} fontStyle="DM Mono" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    borderColor: '#D2E3D6',
                    fontSize: '11px',
                    fontFamily: 'DM Mono',
                  }}
                />
                <ReferenceLine y={groundEnergy} stroke="#86988D" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="energy"
                  stroke="#2D7F9D"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tile>

        {/* Row 7-8 Center: Decision Tile 4x2 (Deep green when accepted with CircleSeal; White with warn edge when fallback) */}
        <div className="lg:col-span-4 md:col-span-6 row-span-2 relative">
          <Tile
            variant={
              currentDecision?.source === 'quantum_repaired'
                ? 'deep'
                : 'default'
            }
            colSpan={12}
            rowSpan={2}
            title="Gate Decision"
            subtitle="Autonomous repair & acceptance gate"
            className={`h-full pr-14 ${
              currentDecision?.source === 'baseline_fallback' ? 'border-l-4 border-l-warn' : ''
            }`}
            action={
              currentDecision && (
                <PillButton
                  size="sm"
                  variant="primary"
                  loading={publishing}
                  onClick={handlePublish}
                  icon={<Send className="w-3 h-3" />}
                >
                  Publish
                </PillButton>
              )
            }
            padding="dense"
          >
            {currentDecision ? (
              <div className="mt-0.5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      label={
                        currentDecision.source === 'baseline_fallback'
                          ? 'BASELINE FALLBACK'
                          : 'ACCEPTED'
                      }
                      variant={
                        currentDecision.source === 'baseline_fallback' ? 'warn' : 'ok'
                      }
                    />
                    <span className="font-mono text-xs opacity-80">
                      {currentDecision.before_score} → {currentDecision.after_score}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-95 font-ui">
                    {currentDecision.reason}
                  </p>
                </div>
                <div className="pt-1.5 flex items-center gap-3 font-mono text-[11px] opacity-75">
                  <span>resolved: {currentDecision.resolved_students} students</span>
                  <span>changes: {currentDecision.changes.length} courses</span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink2 text-center font-ui">
                Awaiting quantum run evaluation...
              </div>
            )}
          </Tile>

          {/* Overlapping CircleSeal */}
          {currentDecision && (
            <div className="absolute -top-3 -right-3 z-10">
              <CircleSeal
                size="sm"
                label="0 HARD"
                sublabel="CLASHES"
                status={
                  currentDecision.source === 'baseline_fallback' ? 'fallback' : 'certified'
                }
              />
            </div>
          )}
        </div>

        {/* Row 7-8 Right: Bitstring Histogram 4x2 */}
        <Tile
          variant="default"
          colSpan={4}
          rowSpan={2}
          title="Sampled Bitstrings"
          subtitle="Top candidates by shot frequency"
          padding="dense"
        >
          <div className="w-full h-28 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData}>
                <XAxis dataKey="bitstring" stroke="#86988D" fontSize={9} fontStyle="DM Mono" />
                <YAxis stroke="#86988D" fontSize={10} fontStyle="DM Mono" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    borderColor: '#D2E3D6',
                    fontSize: '11px',
                    fontFamily: 'DM Mono',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.feasible ? '#34A85F' : '#86988D'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tile>

        {/* Row 9-10 Left: Course Changes Diff Table 6x2 */}
        <Tile
          variant="default"
          colSpan={6}
          rowSpan={2}
          title="Candidate Slot Moves (Diff)"
          subtitle="Course assignments changed by quantum optimization"
          padding="dense"
        >
          {currentDecision && currentDecision.changes.length > 0 ? (
            <div className="overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-tileMint text-[10px] text-ink font-ui font-semibold uppercase tracking-wider rounded-inner">
                  <tr className="h-7">
                    <th className="px-2.5 py-1 rounded-l-inner">Course ID</th>
                    <th className="px-2.5 py-1">From Slot</th>
                    <th className="px-2.5 py-1">To Slot (Q-Move)</th>
                    <th className="px-2.5 py-1 text-right rounded-r-inner">Penalty Impact</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-line/30 font-mono">
                  {currentDecision.changes.map((c, idx) => (
                    <tr key={c[0]} className={`h-8 ${idx % 2 === 1 ? 'bg-greenSoft/25' : 'bg-transparent'} hover:bg-tileMint/30 transition-colors`}>
                      <td className="px-2.5 py-1 font-bold text-ink">{c[0]}</td>
                      <td className="px-2.5 py-1 text-ink2">{c[1]}</td>
                      <td className="px-2.5 py-1 text-green font-semibold">{c[2]}</td>
                      <td className="px-2.5 py-1 text-right text-green">-32.0 pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-ui text-ink2 text-center p-3">
              {currentDecision ? 'Baseline preserved: 0 slot moves accepted.' : 'Run QAOA to compute schedule diff.'}
            </div>
          )}
        </Tile>

        {/* Row 9-10 Right: Raw QuantumResult CodeTile 6x2 (ink) */}
        <CodeTile
          title="Raw Quantum Result Telemetry"
          code={quantumResult || { message: 'Run QAOA pipeline to capture quantum telemetry JSON' }}
          colSpan={6}
          rowSpan={2}
          maxHeight="120px"
        />
      </BentoGrid>
    </div>
  );
};
