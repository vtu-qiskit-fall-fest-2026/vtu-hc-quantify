import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Stat } from '../components/Stat';
import { Badge } from '../components/Badge';
import { Segmented } from '../components/Segmented';
import { Slider } from '../components/Slider';
import { Panel } from '../components/Panel';
import { CodeBlock } from '../components/CodeBlock';
import { Stepper } from '../components/Stepper';
import { EmptyState } from '../components/EmptyState';
import { DataTable } from '../components/DataTable';
import { useAppStore } from '../store';

interface SampleRow {
  course_id: string;
  name: string;
  enrollment: number;
  assigned_slot: string;
  penalty: number;
}

const sampleData: SampleRow[] = [
  { course_id: 'CS101', name: 'Intro to Algorithms', enrollment: 120, assigned_slot: 'S01', penalty: 0 },
  { course_id: 'CS204', name: 'Operating Systems', enrollment: 85, assigned_slot: 'S03', penalty: 10 },
  { course_id: 'MATH210', name: 'Discrete Mathematics', enrollment: 95, assigned_slot: 'S02', penalty: 1 },
  { course_id: 'EE102', name: 'Digital Logic Circuits', enrollment: 60, assigned_slot: 'S04', penalty: 0 },
];

const sampleColumns: ColumnDef<SampleRow, any>[] = [
  { accessorKey: 'course_id', header: 'Course ID', cell: (info: any) => <span className="font-mono">{info.getValue() as string}</span> },
  { accessorKey: 'name', header: 'Course Title' },
  {
    accessorKey: 'enrollment',
    header: () => <div className="text-right">Enrollment</div>,
    cell: (info: any) => <div className="text-right font-mono tabular-nums">{info.getValue() as number}</div>,
  },
  {
    accessorKey: 'assigned_slot',
    header: 'Slot',
    cell: (info: any) => <Badge label={info.getValue() as string} variant="accent" mono />,
  },
  {
    accessorKey: 'penalty',
    header: () => <div className="text-right">Penalty</div>,
    cell: (info: any) => (
      <div className="text-right font-mono tabular-nums">
        {(info.getValue() as number) === 0 ? (
          <span className="text-ok">0</span>
        ) : (
          <span className="text-warn">{info.getValue() as number}</span>
        )}
      </div>
    ),
  },
];

export const DesignPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [segmentedVal, setSegmentedVal] = useState<'A' | 'B' | 'C'>('A');
  const [sliderVal, setSliderVal] = useState(42);
  const [stepStage, setStepStage] = useState('optimize');

  const steps = [
    { id: 'extract', label: 'Extract' },
    { id: 'qubo', label: 'QUBO' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'sample', label: 'Sample' },
    { id: 'repair', label: 'Repair' },
    { id: 'decide', label: 'Decide' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="border-b border-line pb-3">
        <h1 className="text-base font-semibold text-text tracking-wide">
          DESIGN SYSTEM VERIFICATION & COMPONENT TOKENS
        </h1>
        <p className="text-xs text-text-2 mt-1">
          Strict conformance to docs/DESIGN_SYSTEM.md. Engineering console aesthetic: 2px radius, no shadows, no gradients, 100% data-dense.
        </p>
      </div>

      {/* Color Tokens */}
      <Panel title="COLOR TOKENS & SWATCHES">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {[
            { name: '--bg', hex: '#0E1116', bgClass: 'bg-bg text-text' },
            { name: '--panel', hex: '#151A21', bgClass: 'bg-panel text-text' },
            { name: '--panel-2', hex: '#1B222B', bgClass: 'bg-panel-2 text-text' },
            { name: '--line', hex: '#262D38', bgClass: 'bg-line text-text' },
            { name: '--text', hex: '#E6E8EB', bgClass: 'bg-text text-bg' },
            { name: '--text-2', hex: '#8B95A3', bgClass: 'bg-text2 text-bg' },
            { name: '--text-3', hex: '#5C6674', bgClass: 'bg-text3 text-bg' },
            { name: '--accent', hex: '#4589FF', bgClass: 'bg-accent text-bg' },
            { name: '--ok', hex: '#42BE65', bgClass: 'bg-ok text-bg' },
            { name: '--warn', hex: '#F1C21B', bgClass: 'bg-warn text-bg' },
            { name: '--bad', hex: '#FA4D56', bgClass: 'bg-bad text-bg' },
          ].map((c) => (
            <div key={c.name} className="border border-line rounded-[2px] p-2 bg-panel-2">
              <div className={`h-8 rounded-[1px] border border-line/40 flex items-center justify-center font-mono text-[10px] font-semibold ${c.bgClass}`}>
                {c.hex}
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-text-2 truncate">{c.name}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Stats and Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="STAT COMPONENTS">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="Total Exams" value="184" unit="courses" />
            <Stat label="Baseline Soft Penalty" value="1,420" variant="warn" />
            <Stat label="Hard Violations" value="0" variant="ok" subtext="Feasibility verified" />
            <Stat label="QAOA Approx Ratio" value="0.942" variant="accent" unit="ratio" />
            <Stat label="QPU Transpiled Depth" value="48" unit="cycles" />
            <Stat label="Two-Qubit Gates" value="26" variant="bad" subtext="Exceeds ideal limit" />
          </div>
        </Panel>

        <Panel title="BADGES & LABELS">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge label="Feasible (0 clashes)" variant="ok" />
              <Badge label="Suboptimal (penalty +24)" variant="warn" />
              <Badge label="Infeasible (hard violation)" variant="bad" />
              <Badge label="IBM Fez (156q)" variant="accent" />
              <Badge label="Fixed Neighbor" variant="neutral" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge label="00101100" variant="accent" mono />
              <Badge label="01101011" variant="neutral" mono />
              <Badge label="E = -14.2" variant="ok" mono />
            </div>
          </div>
        </Panel>
      </div>

      {/* Controls: Segmented, Sliders, Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="SEGMENTED CONTROLS & SLIDERS">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-text-3 font-mono block mb-1">STANDARD SEGMENTED</span>
              <Segmented<'A' | 'B' | 'C'>
                options={[
                  { value: 'A', label: 'Option A' },
                  { value: 'B', label: 'Option B' },
                  { value: 'C', label: 'Option C', disabled: true, tooltip: 'Disabled in current tier' },
                ]}
                value={segmentedVal}
                onChange={setSegmentedVal}
              />
            </div>
            <Slider
              label="QAOA Circuit Depth (p)"
              value={sliderVal}
              min={1}
              max={100}
              step={1}
              defaultValue={42}
              onChange={setSliderVal}
              onReset={() => setSliderVal(42)}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => addToast('Standard informational alert dispatched', 'info')}
                className="px-2.5 py-1 bg-panel-2 border border-line hover:bg-panel text-xs rounded-[2px]"
              >
                Trigger Info Toast
              </button>
              <button
                type="button"
                onClick={() => addToast('Accepted: Soft score improved by 18 points', 'ok')}
                className="px-2.5 py-1 bg-panel-2 border border-line hover:bg-panel text-xs text-ok rounded-[2px]"
              >
                Trigger OK Toast
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="PIPELINE STEPPER">
          <div className="space-y-4">
            <Stepper steps={steps} currentStepId={stepStage} />
            <div className="flex flex-wrap gap-1.5 pt-2">
              {steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepStage(s.id)}
                  className={`px-2 py-0.5 font-mono text-[11px] border rounded-[1px] ${
                    stepStage === s.id
                      ? 'border-accent bg-accent/10 text-accent font-semibold'
                      : 'border-line text-text-3 hover:text-text'
                  }`}
                >
                  {s.id}
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Panels with semantic left border */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="DECISION: ACCEPTED (OK BORDER)" borderLeft="ok">
          <p className="text-xs text-text font-mono">
            Accepted: Soft penalty reduced from 142.0 to 118.0 (-24.0). 0 hard violations verified by CP-SAT validator.
          </p>
        </Panel>

        <Panel title="DECISION: FALLBACK (WARN BORDER)" borderLeft="warn">
          <p className="text-xs text-text font-mono">
            Fallback: Candidate bitstring 011010 produced 2 student clashes after repair. Kept CP-SAT baseline unchanged.
          </p>
        </Panel>
      </div>

      {/* DataTable */}
      <Panel title="DATA TABLE (TANSTACK, 28PX ROWS, RIGHT-ALIGNED NUMBERS)">
        <DataTable data={sampleData} columns={sampleColumns} />
      </Panel>

      {/* Code Block & Empty State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="CODE BLOCK (JSON PREVIEW)">
          <CodeBlock
            language="json"
            code={JSON.stringify(
              {
                cluster_id: 'cluster_01',
                method: 'qaoa_ideal_p1',
                hard_violations: 0,
                best_sampled_energy: -12.5,
                approx_ratio: 0.941,
              },
              null,
              2
            )}
          />
        </Panel>

        <Panel title="EMPTY STATE">
          <EmptyState
            message="No benchmark telemetry records found for run_172959821."
            actionLabel="Execute Benchmark Suite"
            onAction={() => addToast('Executing benchmark harness across 10 seeds...', 'info')}
          />
        </Panel>
      </div>
    </div>
  );
};
