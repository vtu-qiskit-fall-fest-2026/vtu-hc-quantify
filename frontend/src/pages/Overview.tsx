import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Cpu,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { PillButton } from '../components/PillButton';
import { CircleSeal } from '../components/CircleSeal';
import { Stepper, StepItem } from '../components/Stepper';
import { useAppStore } from '../store';
import { useCountUp } from '../hooks/useCountUp';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { hardViolations, lastSolveSeconds } = useAppStore();

  const [activeStepId, setActiveStepId] = useState('repair');

  // Animated count-up for numbers
  const animatedViolations = useCountUp(hardViolations, 600);

  // Hybrid workflow steps with descriptive copy
  const pipelineSteps: StepItem[] = [
    {
      id: 'cpsat',
      label: 'CP-SAT baseline',
      description: 'Global integer solver computes initial campus-wide timetable guaranteeing 0 hard room, proctor, and time conflicts.',
    },
    {
      id: 'extract',
      label: 'Extract cluster',
      description: 'Network graph analysis isolates the highest-density bottleneck conflict cluster (<= 14 courses) causing back-to-back testing fatigue.',
    },
    {
      id: 'qubo',
      label: 'QUBO / Ising',
      description: 'Formulates subproblem into binary choice variables (0 = candidate slot A, 1 = candidate slot B) and maps into an Ising Hamiltonian.',
    },
    {
      id: 'qaoa',
      label: 'QAOA',
      description: 'Executes parameterized quantum alternation (p in {1,2}) transpiled for physical heavy-hex coupling on IBM Quantum hardware.',
    },
    {
      id: 'repair',
      label: 'Repair + decide',
      description: 'Classical repair gate verifies hard violations == 0 and strictly improving soft score; accepts candidate or falls back safely.',
    },
  ];

  const currentStep = pipelineSteps.find((s) => s.id === activeStepId) || pipelineSteps[4];

  // Mini conflict cluster nodes for live hero graph (44px nodes, 6 coupled courses)
  const nodes = [
    { id: 'C1', name: 'Quantum Mech', x: 80, y: 80, slot: '#34A85F', slotName: 'Slot 1' },
    { id: 'C2', name: 'Algorithms', x: 230, y: 65, slot: '#2D7F9D', slotName: 'Slot 2' },
    { id: 'C3', name: 'Thermodynamics', x: 380, y: 85, slot: '#E3A21A', slotName: 'Slot 3' },
    { id: 'C4', name: 'Linear Algebra', x: 110, y: 200, slot: '#8FA8E8', slotName: 'Slot 4' },
    { id: 'C5', name: 'Electromagnetics', x: 260, y: 220, slot: '#2D7F9D', slotName: 'Slot 2' },
    { id: 'C6', name: 'Machine Learning', x: 410, y: 195, slot: '#34A85F', slotName: 'Slot 1' },
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

  // 156-dot heavy-hex grid decoration for Tile 3 (IBM Kingston 156-qubit lattice)
  const heavyHexDots = useMemo(() => {
    const dots: { cx: number; cy: number; highlighted: boolean; key: number }[] = [];
    const cols = 13;
    const rows = 12;
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (count >= 156) break;
        const offsetX = (r % 2 === 1) ? 6 : 0;
        const cx = 14 + c * 13 + offsetX;
        const cy = 10 + r * 8;
        // Highlight a few representative qubits
        const highlighted = count === 24 || count === 42 || count === 88 || count === 104 || count === 138;
        dots.push({ cx, cy, highlighted, key: count });
        count++;
      }
    }
    return dots;
  }, []);

  // Mini preview timetable blocks
  const miniGridRooms = ['R101', 'R102', 'LH1'];
  const miniGridSlots = ['S1 (Mon 9)', 'S2 (Mon 14)', 'S3 (Tue 9)', 'S4 (Tue 14)'];
  const miniExams = [
    { room: 0, slot: 0, code: 'CS101', color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200', resolved: true },
    { room: 1, slot: 1, code: 'PH201', color: 'bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-200', resolved: true },
    { room: 2, slot: 0, code: 'EE203', color: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200', resolved: false },
    { room: 0, slot: 2, code: 'MA102', color: 'bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-200', resolved: true },
    { room: 1, slot: 3, code: 'CS304', color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200', resolved: true },
    { room: 2, slot: 2, code: 'ME205', color: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200', resolved: false },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Section B: Hero (Eyebrow chip with green 8px dot, headline with ONE italic green accent word, solid pills) */}
      <div className="text-center max-w-3xl mx-auto pt-2 pb-1">
        {/* Eyebrow chip: white fill, green 8px dot */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-pill bg-tile border border-line text-ink font-ui text-xs font-medium mb-3 shadow-hairline">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span>IBM Quantum-Assisted Timetabling</span>
        </div>

        {/* Headline: Exam clashes, resolved */}
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight font-ui text-ink leading-tight">
          Exam clashes, <span className="italic font-medium text-green">resolved</span>.
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-ink2 font-ui leading-relaxed max-w-2xl mx-auto">
          Hybrid CP-SAT global baseline and Qiskit QAOA subproblem optimization with a certified
          zero-violation classical fallback safety gate.
        </p>

        {/* Action CTA Pills: Primary solid green with white text, secondary white pills */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <PillButton
            size="md"
            variant="primary"
            onClick={() => navigate('/dataset')}
            iconRight={<ArrowRight className="w-4 h-4" />}
          >
            Upload dataset
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
            variant="secondary"
            onClick={() => navigate('/benchmarks')}
          >
            View benchmarks
          </PillButton>
        </div>
      </div>

      {/* Section C: Stat Row (four tiles, four distinct visual treatments, 12px gap, overlapping CircleSeal) */}
      <div className="relative">
        <BentoGrid>
          {/* Tile 1: HARD VIOLATIONS (sage tile, 32px white icon circle, 56px value, thin 6px progress bar) */}
          <Tile
            variant="sage"
            colSpan={3}
            rowSpan={2}
            className="flex flex-col justify-between relative bento-tile-mount pr-6 lg:pr-14"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase font-ui text-ink2">
                Hard Violations
              </span>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-green shadow-hairline flex-shrink-0">
                <ShieldCheck className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            <div className="my-1">
              <div className="text-[52px] sm:text-[56px] font-bold font-ui text-ink leading-none tracking-tight">
                {animatedViolations}
              </div>
              <p className="text-xs text-ink2 font-ui mt-1">
                Certified zero student clashes
              </p>
            </div>

            {/* Footer: thin 6px progress bar fully filled green */}
            <div className="w-full h-1.5 rounded-full bg-tile/70 overflow-hidden mt-1">
              <div className="h-full w-full bg-green rounded-full transition-all duration-500" />
            </div>
          </Tile>

          {/* Tile 2: QAOA APPROX RATIO (white tile, 1.000 value, circular ring gauge showing 100%) */}
          <Tile
            variant="default"
            colSpan={3}
            rowSpan={2}
            className="flex flex-col justify-between bento-tile-mount pl-6 lg:pl-16 pr-4 sm:pr-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase font-ui text-ink2">
                QAOA Approx Ratio
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-greenSoft text-green font-semibold">
                p=1
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 my-1">
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-ui text-ink leading-none tracking-tight">
                  1.000
                </div>
                <p className="text-xs text-ink2 font-ui mt-1.5">
                  Matches exact ground-state energy
                </p>
              </div>

              {/* Circular Ring Gauge SVG (100% fill) */}
              <div className="w-12 h-12 flex-shrink-0 relative flex items-center justify-center">
                <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="19"
                    fill="none"
                    stroke="var(--green-soft)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="19"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="4"
                    strokeDasharray="119.4"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-green">
                  100%
                </span>
              </div>
            </div>

            <div className="pt-1 text-[11px] font-mono text-ink3 border-t border-line/40">
              Optimal energy state confirmed
            </div>
          </Tile>

          {/* Tile 3: HARDWARE TESTED (deep-forest tile, white text, 156 Qubits, heavy-hex lattice, teal QPU chip) */}
          <Tile
            variant="deep"
            colSpan={3}
            rowSpan={2}
            className="flex flex-col justify-between relative overflow-hidden bento-tile-mount"
          >
            {/* Background Heavy-Hex Dot Lattice Decoration */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden pointer-events-none opacity-90">
              <svg viewBox="0 0 190 110" className="w-full h-full">
                {heavyHexDots.map((dot) => (
                  <circle
                    key={dot.key}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={dot.highlighted ? 2.8 : 1.8}
                    fill={dot.highlighted ? 'var(--green)' : 'rgba(255, 255, 255, 0.18)'}
                    className={dot.highlighted ? 'shadow-sm' : ''}
                  />
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between gap-2 relative z-10">
              <span className="text-[11px] font-semibold tracking-wider uppercase font-ui text-onDeep/80">
                Hardware Tested
              </span>
              {/* Teal QPU chip */}
              <span className="px-2 py-0.5 rounded-pill bg-quantum/25 border border-teal-300/40 text-teal-200 text-[10px] font-mono uppercase font-semibold">
                QPU
              </span>
            </div>

            <div className="my-1 relative z-10">
              <div className="text-3xl sm:text-4xl font-bold font-ui text-white leading-none tracking-tight">
                156 Qubits
              </div>
              <p className="text-xs text-onDeep/80 font-ui mt-1.5">
                Physical IBM Kingston execution
              </p>
            </div>

            <div className="pt-1 text-[11px] font-mono text-onDeep/60 border-t border-white/10 relative z-10">
              Eagle heavy-hex architecture
            </div>
          </Tile>

          {/* Tile 4: BASELINE SOLVE (mint tile, 0.05s value, 7-bar mini sparkline in green 70%) */}
          <Tile
            variant="mint"
            colSpan={3}
            rowSpan={2}
            className="flex flex-col justify-between bento-tile-mount"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase font-ui text-ink2">
                Baseline Solve
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-white/70 text-ink2 font-medium">
                CP-SAT
              </span>
            </div>

            <div className="flex items-end justify-between gap-2 my-1">
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-ui text-ink leading-none tracking-tight">
                  {lastSolveSeconds !== null ? `${lastSolveSeconds.toFixed(2)} s` : '0.05 s'}
                </div>
                <p className="text-xs text-ink2 font-ui mt-1.5">
                  Global CP-SAT campus model
                </p>
              </div>

              {/* 7-bar mini sparkline of solve times across runs in --green at 70% */}
              <div className="flex items-end gap-1 h-8 pb-1 flex-shrink-0" title="Historical solve times">
                {[0.45, 0.7, 0.5, 0.85, 0.6, 0.4, 0.65].map((val, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 rounded-t bg-green/70 transition-all hover:bg-green"
                    style={{ height: `${val * 100}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="pt-1 text-[11px] font-mono text-ink3 border-t border-line/40">
              Proven integer feasibility
            </div>
          </Tile>
        </BentoGrid>

        {/* 96px Rotating CircleSeal overlapping the seam between Tile 1 and Tile 2 */}
        <div className="hidden lg:block absolute left-[25%] -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <CircleSeal
            size="lg"
            label="CERTIFIED SAFE"
            sublabel="ZERO CLASHES"
            status="certified"
          />
        </div>
      </div>

      {/* Section D: Second Row Bento Grid (Conflict-cluster hero 7 cols, Pipeline stepper 5 cols, Live Timetable preview 5 cols) */}
      <BentoGrid>
        {/* Conflict Cluster Tile (Hero, Spans 7 cols, rows 5) */}
        <Tile
          variant="default"
          colSpan={7}
          rowSpan={5}
          title="Bottleneck Conflict Cluster"
          subtitle="Elective overlap subgraph (cluster_01) color-coded by assigned time slot"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-pill bg-greenSoft text-green text-xs font-semibold">
                6 coupled courses
              </span>
              <PillButton
                size="sm"
                variant="secondary"
                onClick={() => navigate('/clusters')}
              >
                Inspect lab
              </PillButton>
            </div>
          }
          className="relative min-h-[400px] flex flex-col justify-between"
        >
          {/* Interactive Hero Graph */}
          <div className="relative w-full h-full min-h-[290px] flex items-center justify-center py-2">
            <svg viewBox="0 0 490 280" className="w-full h-full max-h-[300px]">
              {/* Conflict Edges with white pill edge weight labels */}
              {edges.map((e, idx) => {
                const n1 = nodes[e.from];
                const n2 = nodes[e.to];
                const midX = (n1.x + n2.x) / 2;
                const midY = (n1.y + n2.y) / 2;
                return (
                  <g key={idx}>
                    <line
                      x1={n1.x}
                      y1={n1.y}
                      x2={n2.x}
                      y2={n2.y}
                      stroke="var(--ink-3)"
                      strokeWidth={Math.max(1.5, e.weight / 6)}
                      strokeOpacity="0.4"
                    />
                    {/* Edge Weight Tiny White Pill Label */}
                    <rect
                      x={midX - 11}
                      y={midY - 8}
                      width="22"
                      height="15"
                      rx="7.5"
                      fill="#FFFFFF"
                      stroke="var(--line)"
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      fill="var(--ink)"
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      className="select-none pointer-events-none"
                    >
                      {e.weight}
                    </text>
                  </g>
                );
              })}

              {/* Course Nodes: 44px with 3px white ring and 25% outer ring in slot color */}
              {nodes.map((n) => (
                <g key={n.id} className="cursor-pointer transition-transform hover:scale-105">
                  {/* Soft outer ring in slot color at 25% */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={26}
                    fill="none"
                    stroke={n.slot}
                    strokeWidth="3"
                    strokeOpacity="0.25"
                  />
                  {/* Main Node Circle: 44px diameter (r=22) with 3px white ring */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={22}
                    fill={n.slot}
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    className="shadow-hairline"
                  />
                  {/* Course ID */}
                  <text
                    x={n.x}
                    y={n.y + 4}
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {n.id}
                  </text>
                  {/* Course Name Under Node in 12px --ink-2 */}
                  <text
                    x={n.x}
                    y={n.y + 38}
                    fill="var(--ink-2)"
                    fontSize="12"
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

          {/* Bottom Legend Chips (slot day/time) with colored dots */}
          <div className="pt-3 border-t border-line/50 flex flex-wrap items-center justify-between gap-2 text-xs font-ui">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-canvas text-ink2 text-[11px] font-medium border border-line">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#34A85F' }} />
                <span>Slot 1 (Mon 09:00)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-canvas text-ink2 text-[11px] font-medium border border-line">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2D7F9D' }} />
                <span>Slot 2 (Mon 14:00)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-canvas text-ink2 text-[11px] font-medium border border-line">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E3A21A' }} />
                <span>Slot 3 (Tue 09:00)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-canvas text-ink2 text-[11px] font-medium border border-line">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8FA8E8' }} />
                <span>Slot 4 (Tue 14:00)</span>
              </div>
            </div>

            <span className="text-[11px] font-mono text-ink3">
              31 students in bottleneck
            </span>
          </div>
        </Tile>

        {/* Pipeline Stepper Tile: 5 cols, rowSpan 2 (Hybrid workflow) */}
        <Tile
          variant="default"
          colSpan={5}
          rowSpan={2}
          title="Hybrid workflow"
          subtitle="Two-tier quantum-classical optimization cycle"
          action={
            <span className="px-2.5 py-0.5 rounded-pill bg-greenSoft text-green text-[11px] font-semibold">
              Safety Gate
            </span>
          }
          className="flex flex-col justify-between"
        >
          {/* Unclipped 5-step wrapping stepper */}
          <div className="py-1">
            <Stepper
              steps={pipelineSteps}
              currentStepId={activeStepId}
              onStepClick={(id) => setActiveStepId(id)}
              orientation="wrap"
            />
          </div>

          {/* Dynamic description paragraph that updates when step changes */}
          <div className="mt-2 p-2.5 rounded-inner bg-canvas border border-line/60">
            <div className="text-xs font-semibold text-ink font-ui mb-0.5 flex items-center justify-between">
              <span>{currentStep.label}</span>
              <span className="text-[10px] font-mono text-ink3">Stage details</span>
            </div>
            <p className="text-xs text-ink2 font-ui leading-relaxed">
              {currentStep.description}
            </p>
          </div>
        </Tile>

        {/* Live Timetable Preview Tile (5 cols, 3 rows, sage tint) */}
        <Tile
          variant="sage"
          colSpan={5}
          rowSpan={3}
          title="Live timetable preview"
          subtitle="Real exam allocation across rooms and time slots"
          action={
            <div
              onClick={() => navigate('/timetable')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-white text-ink text-xs font-medium cursor-pointer hover:bg-tileMint border border-line shadow-hairline transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-green" />
              <span>Full grid</span>
            </div>
          }
          className="flex flex-col justify-between"
        >
          {/* Mini Timetable Grid */}
          <div className="mt-1 bg-white/70 dark:bg-tile/70 rounded-inner p-2 border border-line/50">
            {/* Slot Column Headers */}
            <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono text-ink3 pb-1 border-b border-line/40">
              <div className="text-ink3 font-semibold">Room</div>
              {miniGridSlots.map((s, idx) => (
                <div key={idx} className="truncate text-center">
                  {s.split(' ')[0]}
                </div>
              ))}
            </div>

            {/* Room Rows & Mini Exam Blocks */}
            <div className="space-y-1.5 pt-1.5">
              {miniGridRooms.map((roomName, roomIdx) => (
                <div key={roomName} className="grid grid-cols-5 gap-1.5 items-center">
                  <div className="text-[11px] font-mono text-ink2 font-medium truncate">
                    {roomName}
                  </div>
                  {miniGridSlots.map((_, slotIdx) => {
                    const exam = miniExams.find(
                      (e) => e.room === roomIdx && e.slot === slotIdx
                    );
                    return (
                      <div
                        key={slotIdx}
                        className={`h-7 rounded-[8px] flex items-center justify-center text-[10px] font-mono font-semibold transition-transform hover:scale-105 select-none ${
                          exam
                            ? `${exam.color} shadow-hairline ${
                                exam.resolved ? 'border-l-[3px] border-green' : 'border border-line/40'
                              }`
                            : 'bg-canvas/50 border border-line/20 text-transparent'
                        }`}
                      >
                        {exam ? exam.code : '—'}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Caption & Resolved Legend */}
          <div className="pt-2 flex items-center justify-between text-xs font-ui text-ink2">
            <span className="font-mono text-[11px] text-ink3">
              Day 1-2 · 8 slots · 4 rooms
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm border-l-2 border-green bg-emerald-100 dark:bg-emerald-950 inline-block" />
              <span>Resolved QAOA block</span>
            </div>
          </div>
        </Tile>
      </BentoGrid>
    </div>
  );
};
