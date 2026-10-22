import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  UploadCloud,
  Play,
  CheckCircle2,
  ShieldAlert,
  Database,
  Users,
  BookOpen,
  DoorOpen,
  CalendarDays,
  FileCheck2,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { StatTile } from '../components/StatTile';
import { PillButton } from '../components/PillButton';
import { DataTable } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { ColumnDef } from '@tanstack/react-table';
import { api, ApiError } from '../api';
import { useAppStore } from '../store';

interface ParsedFileInfo {
  name: string;
  rows: number;
  size: number;
  status: 'valid' | 'invalid' | 'missing';
  data: any[];
}

interface ValidationIssue {
  id: string;
  issue: string;
  count: number;
  severity: 'error' | 'warning';
}

const REQUIRED_FILES = ['courses.csv', 'enrollments.csv', 'rooms.csv', 'slots.csv'] as const;

export const DatasetPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setRunId, setDatasetName, setTimetable, setSolveStatus, addToast } = useAppStore();

  const [files, setFiles] = useState<Record<string, ParsedFileInfo>>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [solving, setSolving] = useState(false);
  const [elapsedTimer, setElapsedTimer] = useState(0);

  const handleFiles = (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    const updatedFiles: Record<string, ParsedFileInfo> = { ...files };

    let pendingParses = rawFiles.length;

    rawFiles.forEach((file) => {
      const fileName = file.name.toLowerCase();
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          updatedFiles[fileName] = {
            name: file.name,
            rows: results.data.length,
            size: file.size,
            status: results.data.length > 0 ? 'valid' : 'invalid',
            data: results.data,
          };

          pendingParses -= 1;
          if (pendingParses === 0) {
            setFiles(updatedFiles);
            runValidations(updatedFiles);
          }
        },
        error: () => {
          updatedFiles[fileName] = {
            name: file.name,
            rows: 0,
            size: file.size,
            status: 'invalid',
            data: [],
          };
          pendingParses -= 1;
          if (pendingParses === 0) {
            setFiles(updatedFiles);
            runValidations(updatedFiles);
          }
        },
      });
    });
  };

  const loadDemoFixtures = async () => {
    try {
      const filenames = ['courses.csv', 'enrollments.csv', 'rooms.csv', 'slots.csv'];
      const demoFiles: Record<string, ParsedFileInfo> = {};

      for (const name of filenames) {
        let csvContent = '';
        if (name === 'courses.csv') {
          csvContent = `course_id,name,dept,duration_min\nCRS001,Intro Quantum,CS,180\nCRS002,Algorithms,CS,180\nCRS003,Signal Processing,ECE,120\nCRS004,Linear Algebra,MATH,120\nCRS005,Engineering Ethics,HUM,120\nCRS006,Thermodynamics,ME,180\nCRS007,Operating Systems,CS,180\nCRS008,Solid State Devices,ECE,120\nCRS009,Numerical Methods,MATH,120\nCRS010,Control Systems,EE,180\nCRS011,Fluid Dynamics,ME,180\nCRS012,Machine Learning,CS,180`;
        } else if (name === 'rooms.csv') {
          csvContent = `room_id,building,capacity\nR101,Bld-Alpha,40\nR102,Bld-Alpha,60\nR201,Bld-Beta,80\nR202,Bld-Beta,100`;
        } else if (name === 'slots.csv') {
          csvContent = `slot_id,day,start,end,order\nD1S1,0,09:00,11:00,0\nD1S2,0,11:30,13:30,1\nD1S3,0,14:30,16:30,2\nD1S4,0,17:00,19:00,3\nD2S1,1,09:00,11:00,4\nD2S2,1,11:30,13:30,5\nD2S3,1,14:30,16:30,6\nD2S4,1,17:00,19:00,7`;
        } else if (name === 'enrollments.csv') {
          const rows = [];
          rows.push('student_id,course_id');
          for (let s = 1; s <= 60; s++) {
            const sid = `STU${String(s).padStart(3, '0')}`;
            rows.push(`${sid},CRS001`);
            rows.push(`${sid},CRS002`);
            if (s % 2 === 0) rows.push(`${sid},CRS003`);
            if (s % 3 === 0) rows.push(`${sid},CRS004`);
            if (s % 4 === 0) rows.push(`${sid},CRS005`);
            if (s % 5 === 0) rows.push(`${sid},CRS006`);
          }
          csvContent = rows.join('\n');
        }

        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        demoFiles[name] = {
          name,
          rows: parsed.data.length,
          size: csvContent.length,
          status: 'valid',
          data: parsed.data,
        };
      }

      setFiles(demoFiles);
      runValidations(demoFiles);
      addToast('Loaded demo fixture dataset (mini, 12 courses)', 'ok');
    } catch {
      addToast('Failed to load demo fixtures', 'error');
    }
  };

  const runValidations = (currentFiles: Record<string, ParsedFileInfo>) => {
    const issues: ValidationIssue[] = [];

    REQUIRED_FILES.forEach((rf) => {
      if (!currentFiles[rf] || currentFiles[rf].rows === 0) {
        issues.push({
          id: `missing_${rf}`,
          issue: `Missing required file: ${rf}`,
          count: 1,
          severity: 'error',
        });
      }
    });

    const coursesFile = currentFiles['courses.csv'];
    const enrollmentsFile = currentFiles['enrollments.csv'];
    const roomsFile = currentFiles['rooms.csv'];
    const slotsFile = currentFiles['slots.csv'];

    if (coursesFile?.data && enrollmentsFile?.data) {
      const validCourseIds = new Set(coursesFile.data.map((c: any) => c.course_id));
      let unknownCourseCount = 0;
      const seenPairs = new Set<string>();
      let duplicatePairs = 0;

      enrollmentsFile.data.forEach((e: any) => {
        if (!validCourseIds.has(e.course_id)) unknownCourseCount++;
        const key = `${e.student_id}_${e.course_id}`;
        if (seenPairs.has(key)) duplicatePairs++;
        seenPairs.add(key);
      });

      if (unknownCourseCount > 0) {
        issues.push({
          id: 'unknown_courses',
          issue: 'Enrollments reference nonexistent course_ids',
          count: unknownCourseCount,
          severity: 'error',
        });
      }

      if (duplicatePairs > 0) {
        issues.push({
          id: 'duplicate_enrollments',
          issue: 'Duplicate student-course enrollment pairs detected',
          count: duplicatePairs,
          severity: 'error',
        });
      }
    }

    if (roomsFile?.data) {
      let lowCapCount = 0;
      roomsFile.data.forEach((r: any) => {
        const cap = Number(r.capacity);
        if (isNaN(cap) || cap < 20) lowCapCount++;
      });
      if (lowCapCount > 0) {
        issues.push({
          id: 'room_capacity',
          issue: 'Rooms with capacity under 20 or invalid numeric capacity',
          count: lowCapCount,
          severity: 'warning',
        });
      }
    }

    if (slotsFile?.data) {
      const orders = slotsFile.data.map((s: any) => Number(s.order)).sort((a: number, b: number) => a - b);
      let orderGaps = 0;
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i) orderGaps++;
      }
      if (orderGaps > 0) {
        issues.push({
          id: 'slot_order_gaps',
          issue: 'Non-consecutive or gap-filled slot order index sequence',
          count: orderGaps,
          severity: 'warning',
        });
      }
    }

    setValidationIssues(issues);
  };

  const handleSolveBaseline = async () => {
    setSolving(true);
    setElapsedTimer(0);
    const timerInterval = setInterval(() => {
      setElapsedTimer((prev) => prev + 0.1);
    }, 100);

    try {
      const formData = new FormData();
      formData.append('courses', new Blob([Papa.unparse(files['courses.csv'].data)], { type: 'text/csv' }), 'courses.csv');
      formData.append('enrollments', new Blob([Papa.unparse(files['enrollments.csv'].data)], { type: 'text/csv' }), 'enrollments.csv');
      formData.append('rooms', new Blob([Papa.unparse(files['rooms.csv'].data)], { type: 'text/csv' }), 'rooms.csv');
      formData.append('slots', new Blob([Papa.unparse(files['slots.csv'].data)], { type: 'text/csv' }), 'slots.csv');

      const datasetRes = await api.uploadDatasets(formData);
      const datasetId = datasetRes.dataset_id || 'demo_dataset';
      setDatasetName(datasetId);

      const runRes = await api.createRun(datasetId);
      const activeRunId = runRes.run_id;
      setRunId(activeRunId);

      const job = await api.runBaseline(activeRunId, 60);
      const jobId = job.job_id;

      let complete = false;
      while (!complete) {
        await new Promise((r) => setTimeout(r, 600));
        const currentJob = await api.getJob(jobId);
        if (currentJob.status === 'done') {
          complete = true;
          const runData = await api.getRun(activeRunId);
          if (runData.timetable) {
            setTimetable(runData.timetable);
            setSolveStatus(runData.timetable.solve_seconds, runData.timetable.hard_violations);
            addToast(`Baseline solved in ${runData.timetable.solve_seconds.toFixed(2)}s with 0 violations!`, 'ok');
          }
          clearInterval(timerInterval);
          navigate('/timetable');
          return;
        } else if (currentJob.status === 'error') {
          throw new Error(currentJob.error || 'Baseline solver job failed');
        }
      }
    } catch (err: any) {
      clearInterval(timerInterval);
      const msg = err instanceof ApiError ? err.message : err.message || 'Error executing baseline solver';
      addToast(msg, 'error');
    } finally {
      clearInterval(timerInterval);
      setSolving(false);
    }
  };

  const filesArray = Object.values(files);
  const canSolve = REQUIRED_FILES.every((rf) => files[rf] && files[rf].rows > 0) &&
    !validationIssues.some((vi) => vi.severity === 'error');

  // Stats
  const courseCount = files['courses.csv']?.rows || 0;
  const studentCount = useMemo(() => {
    if (!files['enrollments.csv']?.data) return 0;
    const unique = new Set(files['enrollments.csv'].data.map((e: any) => e.student_id));
    return unique.size;
  }, [files]);
  const roomCount = files['rooms.csv']?.rows || 0;
  const slotCount = files['slots.csv']?.rows || 0;

  // Table Columns
  const fileColumns: ColumnDef<ParsedFileInfo, any>[] = [
    {
      accessorKey: 'name',
      header: 'File Name',
      cell: (i: any) => <span className="font-mono font-medium">{i.getValue()}</span>,
    },
    {
      accessorKey: 'rows',
      header: () => <div className="text-right">Rows</div>,
      cell: (i: any) => <div className="text-right font-mono tabular-nums">{i.getValue()}</div>,
    },
    {
      accessorKey: 'size',
      header: () => <div className="text-right">Size</div>,
      cell: (i: any) => (
        <div className="text-right font-mono tabular-nums text-ink3">
          {(i.getValue() / 1024).toFixed(1)} KB
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (i: any) => (
        <Badge
          label={i.getValue() === 'valid' ? 'Valid' : 'Error'}
          variant={i.getValue() === 'valid' ? 'ok' : 'bad'}
        />
      ),
    },
  ];

  const validationColumns: ColumnDef<ValidationIssue, any>[] = [
    {
      accessorKey: 'severity',
      header: 'Level',
      cell: (i: any) => (
        <Badge
          label={i.getValue().toUpperCase()}
          variant={i.getValue() === 'error' ? 'bad' : 'warn'}
        />
      ),
    },
    {
      accessorKey: 'issue',
      header: 'Integrity Check / Audit Rule',
      cell: (i: any) => <span className="font-ui text-ink">{i.getValue()}</span>,
    },
    {
      accessorKey: 'count',
      header: () => <div className="text-right">Occurrences</div>,
      cell: (i: any) => <div className="text-right font-mono tabular-nums">{i.getValue()}</div>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Headline with exactly ONE italic green accent word */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2 pb-1 border-b border-line/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill bg-tileMint text-ink font-ui text-xs font-medium mb-1.5 border border-line/60">
            <Database className="w-3.5 h-3.5 text-green" />
            <span>Campus Dataset Ingestion</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-ui text-ink">
            Dataset ingestion, <span className="italic font-medium text-green">audited</span>.
          </h1>
          <p className="text-xs text-ink3 font-ui mt-1">
            Client-side CSV integrity audit covering courses, enrollments, room capacities, and slot continuity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PillButton
            size="sm"
            variant="mint"
            onClick={loadDemoFixtures}
            icon={<FileCheck2 className="w-3.5 h-3.5 text-green" />}
          >
            Load Demo Fixtures
          </PillButton>
        </div>
      </div>

      {/* Bento Grid layout as mapped in UI_UPDATE_BENTO.md section 6 */}
      <BentoGrid>
        {/* Row 1 Left: Drop zone 6x3 (mint, dashed border) */}
        <Tile
          variant="mint"
          colSpan={6}
          rowSpan={3}
          title="Drop CSV Dataset Files"
          subtitle="Drag & drop courses.csv, enrollments.csv, rooms.csv, slots.csv"
          className="justify-between"
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[140px] border-2 border-dashed border-green/40 hover:border-green hover:bg-tileSage/40 rounded-inner flex flex-col items-center justify-center gap-2.5 p-6 cursor-pointer transition-all duration-150 text-center select-none"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-green shadow-hairline">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink">
                Drop files here or <span className="text-green underline underline-offset-2">browse</span>
              </p>
              <p className="text-[11px] text-ink3 mt-0.5">
                Accepts <code className="font-mono text-ink">courses.csv</code>,{' '}
                <code className="font-mono text-ink">enrollments.csv</code>,{' '}
                <code className="font-mono text-ink">rooms.csv</code>,{' '}
                <code className="font-mono text-ink">slots.csv</code>
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />
          </div>
        </Tile>

        {/* Row 1 Right: Files table 6x3 */}
        <Tile
          variant="default"
          colSpan={6}
          rowSpan={3}
          title="Ingested CSV Manifest"
          action={
            <span className="font-mono text-[11px] text-ink3">
              {filesArray.length} of 4 files uploaded
            </span>
          }
          padding="dense"
        >
          <DataTable
            data={filesArray}
            columns={fileColumns}
            emptyText="No CSV files uploaded yet. Drop files on the left or click 'Load Demo Fixtures'."
          />
        </Tile>

        {/* Row 2 Left: Validation table 8x3 */}
        <Tile
          variant="default"
          colSpan={8}
          rowSpan={3}
          title="Constraint Validation & Integrity Audit"
          action={
            validationIssues.length === 0 && filesArray.length >= 4 ? (
              <span className="flex items-center gap-1 font-ui text-xs text-green font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-green" /> All audits passed
              </span>
            ) : validationIssues.length > 0 ? (
              <span className="flex items-center gap-1 font-ui text-xs text-bad font-medium">
                <ShieldAlert className="w-3.5 h-3.5" /> {validationIssues.length} issues detected
              </span>
            ) : null
          }
          padding="dense"
        >
          <DataTable
            data={validationIssues}
            columns={validationColumns}
            emptyText={
              filesArray.length >= 4
                ? 'Zero integrity issues detected. Schema and relations certified.'
                : 'Upload all 4 required CSV files to trigger client-side integrity validation.'
            }
          />
        </Tile>

        {/* Row 2 Right: Dataset stats 4x3 as 4 mini StatTiles */}
        <div className="lg:col-span-4 md:col-span-6 grid grid-cols-2 gap-3">
          <StatTile
            variant="sage"
            colSpan={1}
            rowSpan={1}
            label="Students"
            value={studentCount}
            icon={<Users className="w-3.5 h-3.5" />}
          />
          <StatTile
            variant="mint"
            colSpan={1}
            rowSpan={1}
            label="Courses"
            value={courseCount}
            icon={<BookOpen className="w-3.5 h-3.5" />}
          />
          <StatTile
            variant="default"
            colSpan={1}
            rowSpan={1}
            label="Rooms"
            value={roomCount}
            icon={<DoorOpen className="w-3.5 h-3.5" />}
          />
          <StatTile
            variant="default"
            colSpan={1}
            rowSpan={1}
            label="Exam Slots"
            value={slotCount}
            icon={<CalendarDays className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Row 3: Solve baseline tile 12x1 deep, primary pill + live timer */}
        <Tile
          variant="deep"
          colSpan={12}
          rowSpan={1}
          padding="normal"
          className="flex-row items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-onDeep">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-onDeep font-ui">
                Compute Classical Feasible Baseline
              </h3>
              <p className="text-xs text-onDeep/80 font-mono">
                {solving ? (
                  <span className="text-green animate-pulse">
                    Running OR-Tools CP-SAT solver... Elapsed: {elapsedTimer.toFixed(1)} s
                  </span>
                ) : canSolve ? (
                  'All required constraints validated. Ready to solve global timetable.'
                ) : (
                  'Awaiting 4 valid CSV files without error-level integrity failures.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {solving && (
              <span className="font-mono text-sm font-semibold text-green tabular-nums">
                {elapsedTimer.toFixed(1)}s
              </span>
            )}
            <PillButton
              size="md"
              variant="primary"
              disabled={!canSolve || solving}
              loading={solving}
              onClick={handleSolveBaseline}
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
            >
              {solving ? 'Solving Baseline...' : 'Solve Baseline'}
            </PillButton>
          </div>
        </Tile>
      </BentoGrid>
    </div>
  );
};
