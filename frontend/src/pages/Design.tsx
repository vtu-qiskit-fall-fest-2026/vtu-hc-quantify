import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Sparkles,
  ShieldCheck,
  Cpu,
  Zap,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { StatTile } from '../components/StatTile';
import { PillButton } from '../components/PillButton';
import { PillSegmented } from '../components/PillSegmented';
import { CircleSeal } from '../components/CircleSeal';
import { Stepper } from '../components/Stepper';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { CodeTile } from '../components/CodeTile';
import { useAppStore } from '../store';

interface SampleRow {
  course_id: string;
  name: string;
  enrollment: number;
  assigned_slot: string;
  penalty: number;
}

const sampleData: SampleRow[] = [
  { course_id: 'CS101', name: 'Intro to Algorithms', enrollment: 120, assigned_slot: 'D1S1', penalty: 0 },
  { course_id: 'CS204', name: 'Operating Systems', enrollment: 85, assigned_slot: 'D1S3', penalty: 10 },
  { course_id: 'MATH210', name: 'Discrete Mathematics', enrollment: 95, assigned_slot: 'D1S2', penalty: 1 },
  { course_id: 'EE102', name: 'Digital Logic Circuits', enrollment: 60, assigned_slot: 'D2S1', penalty: 0 },
];

const sampleColumns: ColumnDef<SampleRow, any>[] = [
  {
    accessorKey: 'course_id',
    header: 'Course ID',
    cell: (info: any) => <span className="font-mono font-bold text-ink">{info.getValue() as string}</span>,
  },
  { accessorKey: 'name', header: 'Course Title' },
  {
    accessorKey: 'enrollment',
    header: () => <div className="text-right">Enrollment</div>,
    cell: (info: any) => <div className="text-right font-mono tabular-nums">{info.getValue() as number}</div>,
  },
  {
    accessorKey: 'assigned_slot',
    header: 'Slot',
    cell: (info: any) => <Badge label={info.getValue() as string} variant="mint" mono />,
  },
  {
    accessorKey: 'penalty',
    header: () => <div className="text-right">Penalty</div>,
    cell: (info: any) => (
      <div className="text-right font-mono tabular-nums">
        {(info.getValue() as number) === 0 ? (
          <span className="text-green font-semibold">0</span>
        ) : (
          <span className="text-warn font-semibold">{info.getValue() as number}</span>
        )}
      </div>
    ),
  },
];

export const DesignPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [segmentedVal, setSegmentedVal] = useState<'A' | 'B' | 'C'>('A');

  const stepperItems = [
    { id: 'extract', label: 'Extract' },
    { id: 'qubo', label: 'QUBO' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'sample', label: 'Sample' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="pt-2 pb-1 border-b border-line/40">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-ui text-ink">
          Design system, <span className="italic font-medium text-green">unified</span>.
        </h1>
        <p className="text-xs text-ink3 font-ui mt-1">
          Bento UI components, muted green tints, pill buttons, and soft typography tokens.
        </p>
      </div>

      <BentoGrid>
        {/* StatTiles Showcase */}
        <StatTile
          variant="sage"
          colSpan={3}
          rowSpan={2}
          label="Sage StatTile"
          value="0"
          subtext="Certified zero student clashes"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatTile
          variant="default"
          colSpan={3}
          rowSpan={2}
          label="White StatTile"
          value="1.000"
          subtext="Approximation ratio to optimum"
          icon={<Sparkles className="w-4 h-4 text-green" />}
        />
        <StatTile
          variant="mint"
          colSpan={3}
          rowSpan={2}
          label="Mint StatTile"
          value="156 Q"
          subtext="IBM Kingston physical hardware"
          icon={<Cpu className="w-4 h-4" />}
        />
        <StatTile
          variant="deep"
          colSpan={3}
          rowSpan={2}
          label="Deep StatTile"
          value="0.05s"
          subtext="Global CP-SAT solve time"
          icon={<Zap className="w-4 h-4" />}
        />

        {/* Buttons and Badges 6x3 */}
        <Tile
          variant="default"
          colSpan={6}
          rowSpan={3}
          title="Pill Controls & Buttons"
          subtitle="999px border radius with semantic green tints"
          padding="normal"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PillButton variant="primary">Primary Green</PillButton>
              <PillButton variant="secondary">Secondary White</PillButton>
              <PillButton variant="mint">Mint Tile</PillButton>
              <PillButton variant="deep">Deep Forest</PillButton>
              <PillButton variant="quantum">Quantum Teal</PillButton>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/40">
              <Badge label="OK Active" variant="ok" />
              <Badge label="Warning" variant="warn" />
              <Badge label="Error Bad" variant="bad" />
              <Badge label="Quantum QPU" variant="quantum" />
              <Badge label="Mint Badge" variant="mint" />
              <Badge label="Neutral" variant="neutral" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PillSegmented
                size="md"
                variant="light"
                value={segmentedVal}
                onChange={setSegmentedVal}
                options={[
                  { value: 'A', label: 'Option A' },
                  { value: 'B', label: 'Option B' },
                  { value: 'C', label: 'Option C' },
                ]}
              />
              <PillButton
                size="sm"
                variant="primary"
                onClick={() => addToast('Sample toast triggered', 'ok')}
              >
                Trigger Toast
              </PillButton>
            </div>
          </div>
        </Tile>

        {/* Overlapping CircleSeal & Stepper 6x3 */}
        <div className="lg:col-span-6 md:col-span-6 row-span-3 relative">
          <Tile
            variant="mint"
            colSpan={12}
            rowSpan={3}
            title="Overlap CircleSeal & Stepper"
            subtitle="Straddling certification badge and pill stepper"
            padding="normal"
            className="h-full pr-14"
          >
            <div className="space-y-4">
              <Stepper steps={stepperItems} currentStepId="optimize" />
              <p className="text-xs text-ink2 leading-relaxed">
                The CircleSeal straddles tile boundaries providing a tactile, high-contrast certification anchor
                reinforcing the hard-constraint guarantee.
              </p>
            </div>
          </Tile>

          <div className="absolute -top-3 -right-3">
            <CircleSeal size="md" label="0 HARD" sublabel="VERIFIED" status="certified" />
          </div>
        </div>

        {/* Data Table Tile 8x3 */}
        <Tile
          variant="default"
          colSpan={8}
          rowSpan={3}
          title="Dense Data Table"
          subtitle="Sticky mint header with 36px rows and rounded inner corners"
          padding="dense"
        >
          <DataTable data={sampleData} columns={sampleColumns} />
        </Tile>

        {/* Code Tile 4x3 */}
        <CodeTile
          title="CodeTile & Raw Telemetry"
          code={{
            backend: 'ibm_kingston',
            qubits: 156,
            depth: 65,
            approx_ratio: 1.0,
            status: 'certified_feasible',
          }}
          colSpan={4}
          rowSpan={3}
          maxHeight="160px"
        />
      </BentoGrid>
    </div>
  );
};
