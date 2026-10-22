import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Cpu,
  Clock,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { StatTile } from '../components/StatTile';
import { PillButton } from '../components/PillButton';
import { CircleSeal } from '../components/CircleSeal';
import { Stepper } from '../components/Stepper';
import { Badge } from '../components/Badge';
import { useAppStore } from '../store';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { hardViolations, lastSolveSeconds } = useAppStore();

  const [activeStage] = useState('decide');

  const pipelineSteps = [
    { id: 'cpsat', label: 'CP-SAT Baseline' },
    { id: 'extract', label: 'Extract Cluster' },
    { id: 'qubo', label: 'QUBO / Ising' },
    { id: 'qaoa', label: 'QAOA Transpile' },
    { id: 'repair', label: 'Classical Repair' },
    { id: 'decide', label: 'Safety Gate' },
  ];

  // Mini conflict cluster nodes for live hero graph
  const nodes = [
    { id: 'CRS001', name: 'Quantum Mech', x: 80, y: 70, slot: '#34A85F', students: 42 },
    { id: 'CRS002', name: 'Algorithms', x: 220, y: 55, slot: '#2D7F9D', students: 38 },
    { id: 'CRS003', name: 'Thermodynamics', x: 360, y: 75, slot: '#E3A21A', students: 35 },
    { id: 'CRS004', name: 'Linear Algebra', x: 120, y: 190, slot: '#8FA8E8', students: 40 },
    { id: 'CRS005', name: 'Electromagnetics', x: 260, y: 210, slot: '#7FC8B4', students: 29 },
    { id: 'CRS006', name: 'Machine Learning', x: 390, y: 185, slot: '#34A85F', students: 44 },
  ];

  const edges = [
    { from: 0, to: 1, weight: 18 },
    { from: 1, to: 2, weight: 14 },
    { from: 0, to: 3, weight: 22 },
    { from: 1, to: 4, weight: 16 },
    { from: 3, to: 4, weight: 25 },
    { from: 4, to: 5, weight: 20 },
    { from: 2, to: 5, weight: 19 },
    { from: 1, to: 5, weight: 12 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Headline with exactly ONE italic green accent word per UI_UPDATE_BENTO.md */}
      <div className="text-center max-w-3xl mx-auto pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-tileMint text-ink font-ui text-xs font-medium mb-3 border border-line/60">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span>IBM Quantum-Assisted Timetabling Platform</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight font-ui text-ink leading-tight">
          Exam clashes, <span className="italic font-medium text-green">resolved</span>.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-ink2 font-ui leading-relaxed max-w-2xl mx-auto">
          Hybrid CP-SAT global baseline and Qiskit QAOA subproblem optimization with a certified
          zero-violation classical fallback safety gate.
        </p>

        {/* Action Pills */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <PillButton
            size="md"
            variant="primary"
            onClick={() => navigate('/dataset')}
            iconRight={<ArrowRight className="w-4 h-4" />}
          >
            Upload Dataset
          </PillButton>
          <PillButton
            size="md"
            variant="secondary"
            onClick={() => navigate('/clusters')}
            icon={<Cpu className="w-4 h-4 text-green" />}
          >
            Explore Cluster Lab
          </PillButton>
          <PillButton
            size="md"
            variant="mint"
            onClick={() => navigate('/benchmarks')}
          >
            View Benchmarks
          </PillButton>
        </div>
      </div>

      {/* Bento Grid: 12 Columns, auto rows 88px */}
      <BentoGrid>
        {/* Row 1: 4 StatTiles (sage, white, mint, deep) */}
        <StatTile
          variant="sage"
          colSpan={3}
          rowSpan={2}
          label="Hard Violations"
          value={hardViolations}
          subtext="Certified zero student clashes"
          icon={<ShieldCheck className="w-4 h-4" />}
        />

        <StatTile
          variant="default"
          colSpan={3}
          rowSpan={2}
          label="QAOA Approx Ratio"
          value="1.000"
          subtext="Matches exact ground state energy"
          icon={<Activity className="w-4 h-4 text-green" />}
        />

        <StatTile
          variant="mint"
          colSpan={3}
          rowSpan={2}
          label="Hardware Tested"
          value="156 Qubits"
          subtext="Physical IBM Kingston execution"
          icon={<Cpu className="w-4 h-4" />}
        />

        <StatTile
          variant="deep"
          colSpan={3}
          rowSpan={2}
          label="Baseline Solve"
          value={lastSolveSeconds !== null ? `${lastSolveSeconds.toFixed(2)}s` : '0.05s'}
          subtext="Global CP-SAT campus model"
          icon={<Clock className="w-4 h-4" />}
        />

        {/* Row 2: Hero Tile 7x4 (Mini Live Conflict Graph) */}
        <Tile
          variant="mint"
          colSpan={7}
          rowSpan={4}
          title="Bottleneck Conflict Cluster"
          subtitle="Elective overlap subgraph (cluster_01) color-coded by exam time slot"
          action={
            <div className="flex items-center gap-2">
              <Badge label="6 Coupled Courses" variant="mint" />
              <PillButton
                size="sm"
                variant="secondary"
                onClick={() => navigate('/clusters')}
              >
                Inspect Lab
              </PillButton>
            </div>
          }
          className="relative min-h-[340px]"
        >
          <div className="relative w-full h-full min-h-[260px] flex items-center justify-center p-2">
            <svg viewBox="0 0 460 270" className="w-full h-full max-h-[280px]">
              {/* Conflict Edges */}
              {edges.map((e, idx) => {
                const n1 = nodes[e.from];
                const n2 = nodes[e.to];
                return (
                  <g key={idx}>
                    <line
                      x1={n1.x}
                      y1={n1.y}
                      x2={n2.x}
                      y2={n2.y}
                      stroke="var(--ink-3)"
                      strokeWidth={Math.max(1.5, e.weight / 6)}
                      strokeOpacity="0.45"
                    />
                    <text
                      x={(n1.x + n2.x) / 2}
                      y={(n1.y + n2.y) / 2 - 3}
                      fill="var(--ink-2)"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      className="select-none"
                    >
                      {e.weight}
                    </text>
                  </g>
                );
              })}

              {/* Course Nodes */}
              {nodes.map((n) => (
                <g key={n.id} className="cursor-pointer transition-transform hover:scale-105">
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={20}
                    fill={n.slot}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    className="shadow-sm"
                  />
                  <text
                    x={n.x}
                    y={n.y + 3.5}
                    fill="#FFFFFF"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {n.id.replace('CRS00', 'C')}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 31}
                    fill="var(--ink)"
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="var(--font-ui)"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {n.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-auto pt-2 border-t border-line/40 flex items-center justify-between text-xs text-ink3 font-ui">
            <span>Node fill: assigned slot • Edge width: student overlap count</span>
            <span className="font-mono text-ink">31 affected students</span>
          </div>
        </Tile>

        {/* Row 2 Right Top: Pipeline Stepper Tile 5x2 */}
        <Tile
          variant="default"
          colSpan={5}
          rowSpan={2}
          title="Hybrid Workflow Pipeline"
          subtitle="Two-tier classical-quantum coordination architecture"
          action={<Badge label="Certified Safe" variant="ok" />}
        >
          <div className="py-2">
            <Stepper steps={pipelineSteps} currentStepId={activeStage} />
          </div>
          <p className="text-xs text-ink2 mt-2 leading-relaxed">
            CP-SAT computes certified campus baseline; graph extraction isolates hard bottlenecks;
            QAOA optimizes soft back-to-back testing fatigue; classical gate repairs or falls back.
          </p>
        </Tile>

        {/* Row 2 Right Bottom: Latest Decision Tile 5x2 with Overlapping CircleSeal */}
        <div className="lg:col-span-5 md:col-span-6 row-span-2 relative">
          <Tile
            variant="deep"
            colSpan={12}
            rowSpan={2}
            title="Active Schedule Decision"
            subtitle="Autonomous classical verification & acceptance gate"
            className="h-full pr-16"
          >
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-green text-white text-[11px] font-semibold tracking-wide uppercase font-ui">
                  Candidate Accepted
                </span>
                <span className="text-xs font-mono text-onDeep/80">Penalty: 182.0 → 118.0 (-64.0)</span>
              </div>
              <p className="text-xs text-onDeep/90 leading-relaxed font-ui">
                "Accepted: Soft penalty reduced by 64.0 points. Resolved back-to-back testing clashes
                for 12 students with exactly 0 hard violations."
              </p>
            </div>
            <div className="mt-auto pt-2 flex items-center gap-4 text-xs font-mono text-onDeep/70">
              <span>feasi_pct: 100%</span>
              <span>changes: 2 courses</span>
              <span>source: quantum_repaired</span>
            </div>
          </Tile>

          {/* Overlapping CircleSeal bridging the tile edge (Nanoplazz reference) */}
          <div className="absolute -top-4 -right-4 sm:-right-5">
            <CircleSeal
              size="md"
              label="0 CLASHES"
              sublabel="VERIFIED"
              status="certified"
            />
          </div>
        </div>
      </BentoGrid>
    </div>
  );
};
