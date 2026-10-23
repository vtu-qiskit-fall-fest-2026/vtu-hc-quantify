import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  UploadCloud,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ArrowRight,
  Users,
  BookOpen,
  DoorOpen,
  CalendarDays,
  FileText,
} from 'lucide-react';
import { Tile } from '../components/Tile';
import { useAppStore } from '../store';
import { useCountUp } from '../hooks/useCountUp';
import { api, ApiError } from '../api';

interface ParsedFileInfo {
  name: string;
  rows: number;
  size: number;
  columns: string[];
  data: any[];
  missingColumns?: string[];
  error?: string;
}

interface ValidationRuleResult {
  id: number;
  label: string;
  status: 'pending' | 'pass' | 'warn' | 'error';
  count: number;
  offendingRows?: any[];
  description?: string;
}

const EXPECTED_FILES_SCHEMA: Record<string, { label: string; columns: string[] }> = {
  'courses.csv': {
    label: 'courses.csv',
    columns: ['course_id', 'name', 'dept', 'duration_min'],
  },
  'enrollments.csv': {
    label: 'enrollments.csv',
    columns: ['student_id', 'course_id'],
  },
  'rooms.csv': {
    label: 'rooms.csv',
    columns: ['room_id', 'capacity'],
  },
  'slots.csv': {
    label: 'slots.csv',
    columns: ['slot_id', 'day', 'start', 'order'],
  },
};

const REQUIRED_FILES = Object.keys(EXPECTED_FILES_SCHEMA);

export const DatasetPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const targetSingleFileRef = useRef<string | null>(null);

  const {
    setRunId,
    setDatasetName,
    setTimetable,
    setClusters,
    setDecisions,
    setSolveStatus,
    addToast,
  } = useAppStore();

  const [files, setFiles] = useState<Record<string, ParsedFileInfo>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeLimit, setTimeLimit] = useState<30 | 60 | 120>(60);
  const [seed, setSeed] = useState<number>(42);
  const [solving, setSolving] = useState(false);
  const [elapsedTimer, setElapsedTimer] = useState(0);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<number | null>(null);

  // File parsing logic
  const processRawFiles = useCallback((fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    setFiles((prev) => {
      const updated = { ...prev };
      rawFiles.forEach((file) => {
        const fileName = file.name.toLowerCase();
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const cols = results.meta.fields || [];
            const expectedCols = EXPECTED_FILES_SCHEMA[fileName]?.columns || [];
            const missing = expectedCols.filter((col) => !cols.includes(col));

            setFiles((current) => ({
              ...current,
              [fileName]: {
                name: file.name,
                rows: results.data.length,
                size: file.size,
                columns: cols,
                data: results.data,
                missingColumns: missing,
                error: missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
              },
            }));
          },
          error: (err) => {
            setFiles((current) => ({
              ...current,
              [fileName]: {
                name: file.name,
                rows: 0,
                size: file.size,
                columns: [],
                data: [],
                error: err.message,
              },
            }));
          },
        });
      });
      return updated;
    });
  }, []);

  const handleSingleFileSelect = (targetFileName: string) => {
    targetSingleFileRef.current = targetFileName;
    singleFileInputRef.current?.click();
  };

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && targetSingleFileRef.current) {
      const file = e.target.files[0];
      const targetName = targetSingleFileRef.current;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const cols = results.meta.fields || [];
          const expectedCols = EXPECTED_FILES_SCHEMA[targetName]?.columns || [];
          const missing = expectedCols.filter((col) => !cols.includes(col));

          setFiles((current) => ({
            ...current,
            [targetName]: {
              name: targetName,
              rows: results.data.length,
              size: file.size,
              columns: cols,
              data: results.data,
              missingColumns: missing,
              error: missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
            },
          }));
        },
      });
    }
  };

  // Demo fixture loader
  const loadDemoFixtures = useCallback((type: 'mini' | 'demo' | 'corrupted') => {
    setDropdownOpen(false);
    setSolveError(null);

    if (type === 'corrupted') {
      const filenames = ['courses.csv', 'enrollments.csv', 'rooms.csv', 'slots.csv'];
      const demoFiles: Record<string, ParsedFileInfo> = {};

      for (const name of filenames) {
        let csvContent = '';
        if (name === 'courses.csv') {
          csvContent = `course_id,name,dept,duration_min\nCRS001,Intro Quantum,CS,180\nCRS002,Algorithms,CS,180`;
        } else if (name === 'rooms.csv') {
          // Corrupted rooms.csv: missing required capacity column!
          csvContent = `room_id,building\nR101,Bld-Alpha\nR102,Bld-Beta`;
        } else if (name === 'slots.csv') {
          csvContent = `slot_id,day,start,order\nD1S1,0,09:00,0\nD1S2,0,11:30,1`;
        } else if (name === 'enrollments.csv') {
          csvContent = `student_id,course_id\nSTU001,CRS001\nSTU002,CRS002`;
        }

        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        const cols = parsed.meta.fields || [];
        const expectedCols = EXPECTED_FILES_SCHEMA[name]?.columns || [];
        const missing = expectedCols.filter((col) => !cols.includes(col));

        demoFiles[name] = {
          name,
          rows: parsed.data.length,
          size: csvContent.length,
          columns: cols,
          data: parsed.data,
          missingColumns: missing,
          error: missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
        };
      }

      setFiles(demoFiles);
      addToast('Loaded test fixture with missing capacity column', 'warn');
      return;
    }

    if (type === 'mini') {
      const filenames = ['courses.csv', 'enrollments.csv', 'rooms.csv', 'slots.csv'];
      const demoFiles: Record<string, ParsedFileInfo> = {};

      for (const name of filenames) {
        let csvContent = '';
        if (name === 'courses.csv') {
          csvContent = `course_id,name,dept,duration_min\nCRS001,Intro Quantum,CS,180\nCRS002,Algorithms,CS,180\nCRS003,Signal Processing,ECE,120\nCRS004,Linear Algebra,MATH,120\nCRS005,Engineering Ethics,HUM,120\nCRS006,Thermodynamics,ME,180\nCRS007,Operating Systems,CS,180\nCRS008,Solid State Devices,ECE,120\nCRS009,Numerical Methods,MATH,120\nCRS010,Control Systems,EE,180\nCRS011,Fluid Dynamics,ME,180\nCRS012,Machine Learning,CS,180`;
        } else if (name === 'rooms.csv') {
          csvContent = `room_id,building,capacity\nR101,Bld-Alpha,40\nR102,Bld-Alpha,60\nR201,Bld-Beta,80\nR202,Bld-Beta,100`;
        } else if (name === 'slots.csv') {
          csvContent = `slot_id,day,start,order\nD1S1,0,09:00,0\nD1S2,0,11:30,1\nD1S3,0,14:30,2\nD1S4,0,17:00,3\nD2S1,1,09:00,4\nD2S2,1,11:30,5\nD2S3,1,14:30,6\nD2S4,1,17:00,7`;
        } else if (name === 'enrollments.csv') {
          const rows = ['student_id,course_id'];
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
        const cols = parsed.meta.fields || [];
        demoFiles[name] = {
          name,
          rows: parsed.data.length,
          size: csvContent.length,
          columns: cols,
          data: parsed.data,
          missingColumns: [],
        };
      }

      setFiles(demoFiles);
      addToast('Loaded demo fixture dataset: Mini (12 courses)', 'ok');
    } else {
      // Demo (180 courses, 4,200 students)
      const filenames = ['courses.csv', 'enrollments.csv', 'rooms.csv', 'slots.csv'];
      const demoFiles: Record<string, ParsedFileInfo> = {};

      const coursesRows = ['course_id,name,dept,duration_min'];
      for (let i = 1; i <= 180; i++) {
        const cid = `CRS${String(i).padStart(3, '0')}`;
        const depts = ['CS', 'ECE', 'MATH', 'HUM', 'ME', 'EE'];
        coursesRows.push(`${cid},Advanced Module ${i},${depts[i % depts.length]},180`);
      }

      const roomsRows = ['room_id,building,capacity'];
      for (let r = 1; r <= 24; r++) {
        roomsRows.push(`R${100 + r},Hall-${String.fromCharCode(65 + (r % 6))},${50 + (r % 5) * 20}`);
      }

      const slotsRows = ['slot_id,day,start,order'];
      let order = 0;
      for (let d = 0; d < 5; d++) {
        for (let s = 1; s <= 4; s++) {
          slotsRows.push(`D${d + 1}S${s},${d},${8 + s * 2}:00,${order++}`);
        }
      }

      const enrollRows = ['student_id,course_id'];
      for (let stu = 1; stu <= 700; stu++) {
        const sid = `STU${String(stu).padStart(4, '0')}`;
        for (let c = 0; c < 6; c++) {
          const cid = `CRS${String(((stu * 7 + c) % 180) + 1).padStart(3, '0')}`;
          enrollRows.push(`${sid},${cid}`);
        }
      }

      const contents: Record<string, string> = {
        'courses.csv': coursesRows.join('\n'),
        'rooms.csv': roomsRows.join('\n'),
        'slots.csv': slotsRows.join('\n'),
        'enrollments.csv': enrollRows.join('\n'),
      };

      filenames.forEach((name) => {
        const text = contents[name];
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        demoFiles[name] = {
          name,
          rows: parsed.data.length,
          size: text.length,
          columns: parsed.meta.fields || [],
          data: parsed.data,
          missingColumns: [],
        };
      });

      setFiles(demoFiles);
      addToast('Loaded demo fixture dataset: Campus Demo (180 courses, 4,200 enrollments)', 'ok');
    }
  }, [addToast]);

  // Validation Engine: exactly 6 rules
  const validationRules: ValidationRuleResult[] = useMemo(() => {
    const hasAnyFiles = Object.keys(files).length > 0;
    const courses = files['courses.csv'];
    const enrollments = files['enrollments.csv'];
    const rooms = files['rooms.csv'];
    const slots = files['slots.csv'];

    // Rule 1: All four files present
    const missingFiles = REQUIRED_FILES.filter((rf) => !files[rf] || files[rf].rows === 0);
    const rule1: ValidationRuleResult = {
      id: 1,
      label: 'All four files present',
      status: !hasAnyFiles ? 'pending' : missingFiles.length === 0 ? 'pass' : 'error',
      count: missingFiles.length,
      description: missingFiles.length > 0 ? `Missing: ${missingFiles.join(', ')}` : 'All 4 required CSVs detected.',
      offendingRows: missingFiles.map((f) => ({ file: f, error: 'File missing or empty' })),
    };

    // Rule 2: Required columns present
    const missingColEntries: { file: string; missing: string[] }[] = [];
    REQUIRED_FILES.forEach((rf) => {
      if (files[rf] && files[rf].missingColumns && files[rf].missingColumns!.length > 0) {
        missingColEntries.push({ file: rf, missing: files[rf].missingColumns! });
      }
    });
    const rule2: ValidationRuleResult = {
      id: 2,
      label: 'Required columns present',
      status: !hasAnyFiles
        ? 'pending'
        : missingColEntries.length > 0
        ? 'error'
        : missingFiles.length === 0
        ? 'pass'
        : 'pending',
      count: missingColEntries.length,
      description:
        missingColEntries.length > 0
          ? `Missing columns: ${missingColEntries.map((m) => `${m.file} (${m.missing.join(', ')})`).join('; ')}`
          : 'All expected schema columns validated.',
      offendingRows: missingColEntries.map((m) => ({ file: m.file, missing_columns: m.missing.join(', ') })),
    };

    // Rule 3: No duplicate (student, course) pairs
    let duplicatePairs: { student_id: string; course_id: string }[] = [];
    if (enrollments?.data) {
      const seen = new Set<string>();
      enrollments.data.forEach((e: any) => {
        const key = `${e.student_id}_${e.course_id}`;
        if (seen.has(key)) duplicatePairs.push({ student_id: e.student_id, course_id: e.course_id });
        seen.add(key);
      });
    }
    const rule3: ValidationRuleResult = {
      id: 3,
      label: 'No duplicate (student, course) pairs',
      status: !enrollments ? 'pending' : duplicatePairs.length === 0 ? 'pass' : 'error',
      count: duplicatePairs.length,
      description: duplicatePairs.length > 0 ? `${duplicatePairs.length} duplicate enrollments found.` : 'Zero duplicate enrollment rows.',
      offendingRows: duplicatePairs,
    };

    // Rule 4: Every enrolled course exists in courses.csv
    let unknownCourses: { student_id: string; course_id: string }[] = [];
    if (courses?.data && enrollments?.data) {
      const validCids = new Set(courses.data.map((c: any) => c.course_id));
      enrollments.data.forEach((e: any) => {
        if (!validCids.has(e.course_id)) unknownCourses.push({ student_id: e.student_id, course_id: e.course_id });
      });
    }
    const rule4: ValidationRuleResult = {
      id: 4,
      label: 'Every enrolled course exists in courses.csv',
      status: !courses || !enrollments ? 'pending' : unknownCourses.length === 0 ? 'pass' : 'error',
      count: unknownCourses.length,
      description: unknownCourses.length > 0 ? `${unknownCourses.length} unreferenced course IDs found.` : 'All course foreign keys resolve.',
      offendingRows: unknownCourses,
    };

    // Rule 5: Rooms have capacity of at least 20
    let lowCapRooms: { room_id: string; capacity: any }[] = [];
    if (rooms?.data) {
      rooms.data.forEach((r: any) => {
        const cap = Number(r.capacity);
        if (isNaN(cap) || cap < 20) lowCapRooms.push({ room_id: r.room_id, capacity: r.capacity });
      });
    }
    const rule5: ValidationRuleResult = {
      id: 5,
      label: 'Rooms have capacity of at least 20',
      status: !rooms ? 'pending' : lowCapRooms.length === 0 ? 'pass' : 'warn',
      count: lowCapRooms.length,
      description: lowCapRooms.length > 0 ? `${lowCapRooms.length} rooms have capacity < 20.` : 'All examination rooms >= 20 seats.',
      offendingRows: lowCapRooms,
    };

    // Rule 6: Slot order is unique and increasing
    let orderViolations: { slot_id: string; order: any }[] = [];
    if (slots?.data) {
      const orders = slots.data.map((s: any) => ({ slot_id: s.slot_id, order: Number(s.order) }));
      orders.sort((a, b) => a.order - b.order);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i].order !== i) orderViolations.push(orders[i]);
      }
    }
    const rule6: ValidationRuleResult = {
      id: 6,
      label: 'Slot order is unique and increasing',
      status: !slots ? 'pending' : orderViolations.length === 0 ? 'pass' : 'warn',
      count: orderViolations.length,
      description: orderViolations.length > 0 ? 'Gap-filled slot ordering sequence.' : 'Continuous order indices [0..N-1].',
      offendingRows: orderViolations,
    };

    return [rule1, rule2, rule3, rule4, rule5, rule6];
  }, [files]);

  // Overall Validation State
  const errorCount = useMemo(() => validationRules.filter((r) => r.status === 'error').length, [validationRules]);
  const warnCount = useMemo(() => validationRules.filter((r) => r.status === 'warn').length, [validationRules]);
  const allFilesLoaded = REQUIRED_FILES.every((rf) => files[rf] && files[rf].rows > 0);
  const canSolve = allFilesLoaded && errorCount === 0;

  // Derived Stats computation from CSVs only
  const rawStudentCount = useMemo(() => {
    if (!files['enrollments.csv']?.data) return null;
    const unique = new Set(files['enrollments.csv'].data.map((e: any) => e.student_id));
    return unique.size;
  }, [files]);

  const rawCourseCount = useMemo(() => {
    return files['courses.csv']?.rows ?? null;
  }, [files]);

  const rawRoomCount = useMemo(() => {
    return files['rooms.csv']?.rows ?? null;
  }, [files]);

  const rawSlotCount = useMemo(() => {
    return files['slots.csv']?.rows ?? null;
  }, [files]);

  // Animated Count-ups for Stats
  const animStudents = useCountUp(rawStudentCount ?? 0, 600);
  const animCourses = useCountUp(rawCourseCount ?? 0, 600);
  const animRooms = useCountUp(rawRoomCount ?? 0, 600);
  const animSlots = useCountUp(rawSlotCount ?? 0, 600);

  // Derived Context lines
  const studentContext = useMemo(() => {
    if (!files['enrollments.csv']?.data || !rawStudentCount) return '—';
    const avg = (files['enrollments.csv'].data.length / rawStudentCount).toFixed(1);
    return `avg ${avg} courses each`;
  }, [files, rawStudentCount]);

  const courseContext = useMemo(() => {
    if (!files['enrollments.csv']?.data) return '—';
    const counts: Record<string, number> = {};
    files['enrollments.csv'].data.forEach((e: any) => {
      counts[e.course_id] = (counts[e.course_id] || 0) + 1;
    });
    const maxVal = Math.max(0, ...Object.values(counts));
    return `largest has ${maxVal} students`;
  }, [files]);

  const roomContext = useMemo(() => {
    if (!files['rooms.csv']?.data) return '—';
    const total = files['rooms.csv'].data.reduce((sum: number, r: any) => sum + (Number(r.capacity) || 0), 0);
    return `${total.toLocaleString()} total seats`;
  }, [files]);

  const slotContext = useMemo(() => {
    if (!files['slots.csv']?.data) return '—';
    const days = new Set(files['slots.csv'].data.map((s: any) => s.day)).size;
    const slotsPerDay = days > 0 ? Math.ceil(files['slots.csv'].data.length / days) : 0;
    return `${days} days x ${slotsPerDay} slots`;
  }, [files]);

  // Solve Baseline Execution
  const handleSolveBaseline = async () => {
    if (!canSolve || solving) return;
    setSolving(true);
    setSolveError(null);
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

      const runRes = await api.createRun(datasetId, seed);
      const activeRunId = runRes.run_id;
      setRunId(activeRunId);

      const job = await api.runBaseline(activeRunId, timeLimit);
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
            addToast(`Solved in ${runData.timetable.solve_seconds.toFixed(2)}s, 0 hard violations`, 'ok');
          }
          if (runData.clusters && runData.clusters.length > 0) {
            setClusters(runData.clusters);
          }
          if (runData.decisions) {
            setDecisions(runData.decisions);
          }
          clearInterval(timerInterval);
          setTimeout(() => {
            navigate('/timetable');
          }, 600);
          return;
        } else if (currentJob.status === 'error') {
          throw new Error(currentJob.error || 'Baseline solver job failed');
        }
      }
    } catch (err: any) {
      clearInterval(timerInterval);
      const msg = err instanceof ApiError ? err.message : err.message || 'Error executing baseline solver';
      setSolveError(msg);
      addToast(msg, 'error');
    } finally {
      clearInterval(timerInterval);
      setSolving(false);
    }
  };

  // Global Keyboard Shortcuts (u: upload, Enter: solve, Esc: close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (e.key === 'Enter') {
        if (canSolve && !solving) {
          e.preventDefault();
          handleSolveBaseline();
        }
      } else if (e.key === 'Escape') {
        setExpandedRuleId(null);
        setDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSolve, solving]);

  // Check URL param for automated test verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === '1') {
        loadDemoFixtures('corrupted');
      }
    }
  }, [loadDemoFixtures]);

  const loadedFilesCount = REQUIRED_FILES.filter((rf) => files[rf] && files[rf].rows > 0).length;

  return (
    <div className="space-y-3 font-ui text-ink select-none">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processRawFiles(e.target.files);
        }}
      />
      <input
        ref={singleFileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleSingleFileChange}
      />

      {/* Compressed Page Header (Title 32px, Subtitle one line, zero overlapping chips) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-line/40">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-ink leading-tight">
            Dataset ingestion, <span className="italic font-medium text-green">audited</span>.
          </h1>
          <p className="text-[13px] text-ink2 font-normal truncate mt-0.5">
            Client-side CSV integrity audit covering courses, enrollments, room capacities, and slot continuity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Load Demo Fixtures Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="pill-btn pill-btn--secondary h-9 px-3.5 text-xs font-semibold shadow-hairline flex items-center gap-1.5"
            >
              <span>Load demo fixtures</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-11 z-30 w-64 bg-tile border border-line rounded-inner shadow-hover p-1 text-xs">
                <button
                  onClick={() => loadDemoFixtures('mini')}
                  className="w-full text-left px-3 py-2 rounded-inner hover:bg-tileMint/60 transition-colors flex flex-col"
                >
                  <span className="font-semibold text-ink">Mini (12 courses)</span>
                  <span className="text-[11px] text-ink2 font-normal">Fast 12-course subproblem fixture</span>
                </button>
                <button
                  onClick={() => loadDemoFixtures('demo')}
                  className="w-full text-left px-3 py-2 rounded-inner hover:bg-tileMint/60 transition-colors flex flex-col mt-0.5"
                >
                  <span className="font-semibold text-ink">Demo (180 courses, 4,200 students)</span>
                  <span className="text-[11px] text-ink2 font-normal">Full campus examination timetable</span>
                </button>
                <button
                  onClick={() => loadDemoFixtures('corrupted')}
                  className="w-full text-left px-3 py-2 rounded-inner hover:bg-tileMint/60 transition-colors flex flex-col mt-0.5 border-t border-line/40"
                >
                  <span className="font-semibold text-warn">Forced error (missing capacity in rooms.csv)</span>
                  <span className="text-[11px] text-ink2 font-normal">Test schema validation error handling</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed 12-Column 7-Row Grid (72px auto-rows per spec) */}
      <div className="grid grid-cols-12 gap-3 [grid-auto-rows:72px]">
        {/* ========================================================================= */}
        {/* ROW A (Rows 1-4): DROP ZONE TILE (cols 1-7, row-span-4, mint) */}
        {/* ========================================================================= */}
        <Tile
          variant="mint"
          colSpan={7}
          rowSpan={4}
          title="Drop your four CSV files"
          action={
            <span className="text-xs text-ink2 font-normal">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white text-ink font-mono text-[11px] border border-line">u</kbd> to browse
            </span>
          }
          className={`flex flex-col justify-between transition-all duration-200 ${
            isDragOver ? 'ring-2 ring-green scale-[1.01] bg-tileSage' : ''
          }`}
          padding="normal"
        >
          <div
            tabIndex={0}
            role="button"
            aria-label="Upload CSV Dataset"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files) processRawFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex flex-col items-center justify-center border-[1.5px] border-dashed rounded-[20px] transition-all duration-150 p-4 text-center cursor-pointer select-none ${
              isDragOver
                ? 'border-green bg-tileSage/60'
                : 'border-green/50 hover:border-green hover:bg-tileSage/30'
            }`}
          >
            {/* Green Upload Circle */}
            <div className="w-9 h-9 rounded-full bg-green text-white flex items-center justify-center shadow-hairline mb-2">
              <UploadCloud className="w-5 h-5 stroke-[2.2]" />
            </div>

            {/* Fanned Card SVG Illustration of 4 CSV Documents */}
            <div className="flex items-center justify-center -space-x-3 mb-2.5">
              {[
                { name: 'courses', rot: '-rotate-6' },
                { name: 'enrollments', rot: '-rotate-2' },
                { name: 'rooms', rot: 'rotate-2' },
                { name: 'slots', rot: 'rotate-6' },
              ].map((card, i) => (
                <div
                  key={i}
                  className={`w-18 h-12 rounded-[10px] bg-white border border-line shadow-hairline flex flex-col justify-between p-1.5 transform transition-transform duration-200 hover:scale-105 hover:z-10 ${card.rot}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green" />
                    <span className="text-[9px] font-mono text-ink3 uppercase">CSV</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-ink truncate text-left">
                    {card.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Prompt text */}
            <p className="text-[13px] font-medium text-ink">
              {isDragOver ? (
                <span className="text-green font-bold">Release to ingest files</span>
              ) : (
                <>
                  Drop files here or <span className="text-green underline underline-offset-2">browse</span>
                </>
              )}
            </p>
            <p className="text-xs text-ink3 font-normal mt-0.5">
              Files are parsed in your browser. Nothing is uploaded until you solve.
            </p>
          </div>
        </Tile>

        {/* ========================================================================= */}
        {/* ROW A (Rows 1-4): REQUIRED FILES TILE (cols 8-12, row-span-4, white) */}
        {/* ========================================================================= */}
        <Tile
          variant="default"
          colSpan={5}
          rowSpan={4}
          title="Required files"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-pill bg-greenSoft text-green text-[11px] font-mono font-semibold">
                {loadedFilesCount} of 4 files
              </span>
              {/* 4-segment progress bar */}
              <div className="w-16 h-1.5 flex gap-1 rounded-full overflow-hidden bg-line/40">
                {REQUIRED_FILES.map((rf, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-full rounded-full transition-colors ${
                      files[rf] && files[rf].rows > 0 ? 'bg-green' : 'bg-line'
                    }`}
                  />
                ))}
              </div>
            </div>
          }
          className="flex flex-col justify-between"
          padding="normal"
        >
          <div className="space-y-2 flex-1 flex flex-col justify-between">
            {REQUIRED_FILES.map((filename) => {
              const fileInfo = files[filename];
              const schema = EXPECTED_FILES_SCHEMA[filename];
              const isLoaded = fileInfo && fileInfo.rows > 0 && !fileInfo.error;
              const isProblem = fileInfo && !!fileInfo.error;

              return (
                <div
                  key={filename}
                  onClick={() => handleSingleFileSelect(filename)}
                  className="h-14 rounded-inner bg-tileMint/60 border border-line/50 px-3 flex items-center justify-between cursor-pointer hover:bg-tileMint hover:border-green/40 transition-all select-none"
                  title={`Click to upload ${filename}`}
                >
                  {/* Left: icon + filename + column pill chips */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-green flex-shrink-0 shadow-hairline">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink truncate">
                          {filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                        {schema.columns.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.2 rounded-pill bg-white text-ink2 border border-line/60 text-[10px] font-mono whitespace-nowrap"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: status indicator */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {isLoaded ? (
                      <div className="flex items-center gap-1.5 text-xs text-ink font-mono font-medium">
                        <div className="w-4 h-4 rounded-full bg-green text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="tabular-nums">
                          {fileInfo.rows} rows · {(fileInfo.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ) : isProblem ? (
                      <div className="flex items-center gap-1.5 text-xs text-bad font-mono font-medium">
                        <span className="w-2 h-2 rounded-full bg-bad animate-pulse" />
                        <span className="truncate max-w-[130px]">{fileInfo.error}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-ink3 font-ui font-normal">
                        <div className="w-4 h-4 rounded-full border-2 border-line/80" />
                        <span>Waiting</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Tile>

        {/* ========================================================================= */}
        {/* ROW B (Rows 5-7): VALIDATION TILE (cols 1-5, row-span-3, white) */}
        {/* ========================================================================= */}
        <Tile
          variant="default"
          colSpan={5}
          rowSpan={3}
          title="Integrity Validation"
          action={
            <span
              className={`px-2.5 py-0.5 rounded-pill text-[11px] font-semibold ${
                canSolve
                  ? 'bg-greenSoft text-green'
                  : errorCount > 0
                  ? 'bg-bad/15 text-bad'
                  : warnCount > 0
                  ? 'bg-warn/15 text-warn'
                  : 'bg-tileMint text-ink3 font-medium'
              }`}
            >
              {canSolve
                ? 'Ready to solve'
                : errorCount > 0
                ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
                : warnCount > 0
                ? `${warnCount} warning${warnCount > 1 ? 's' : ''}`
                : 'Awaiting files'}
            </span>
          }
          className="flex flex-col justify-between overflow-y-auto"
          padding="dense"
        >
          <div aria-live="polite" className="divide-y divide-line/30 text-[13px] font-ui">
            {validationRules.map((rule) => {
              const isExpanded = expandedRuleId === rule.id;
              const hasOffenders = (rule.status === 'error' || rule.status === 'warn') && rule.offendingRows && rule.offendingRows.length > 0;

              return (
                <div key={rule.id} className="py-1.5">
                  <div
                    onClick={() => hasOffenders && setExpandedRuleId(isExpanded ? null : rule.id)}
                    className={`flex items-center justify-between gap-2 px-1 rounded transition-colors ${
                      hasOffenders ? 'cursor-pointer hover:bg-tileMint/40' : ''
                    }`}
                  >
                    {/* Status icon + rule label in Poppins 400 13px */}
                    <div className="flex items-center gap-2 min-w-0">
                      {rule.status === 'pass' ? (
                        <CheckCircle2 className="w-4 h-4 text-green flex-shrink-0" />
                      ) : rule.status === 'error' ? (
                        <XCircle className="w-4 h-4 text-bad flex-shrink-0" />
                      ) : rule.status === 'warn' ? (
                        <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-line flex-shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          rule.status === 'pass'
                            ? 'text-ink font-medium'
                            : rule.status === 'error'
                            ? 'text-bad font-medium'
                            : rule.status === 'warn'
                            ? 'text-warn font-medium'
                            : 'text-ink2'
                        }`}
                      >
                        {rule.label}
                      </span>
                    </div>

                    {/* Occurrence count in mono */}
                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums flex-shrink-0">
                      <span
                        className={
                          rule.status === 'error'
                            ? 'text-bad font-bold'
                            : rule.status === 'warn'
                            ? 'text-warn font-bold'
                            : rule.status === 'pass'
                            ? 'text-green font-semibold'
                            : 'text-ink3'
                        }
                      >
                        {rule.status === 'pending' ? '—' : rule.count}
                      </span>
                      {hasOffenders && (
                        <ChevronDown className={`w-3.5 h-3.5 text-ink3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </div>

                  {/* Inline Expanded Offending Detail */}
                  {isExpanded && hasOffenders && (
                    <div className="mt-1.5 mx-1 p-2 rounded bg-tileMint/60 border border-line/60 font-mono text-[11px] text-ink2 space-y-1 animate-fadeIn">
                      <div className="text-[10px] text-ink3 font-ui font-semibold uppercase">
                        Sample Offending Rows:
                      </div>
                      {rule.offendingRows!.slice(0, 3).map((offender, idx) => (
                        <div key={idx} className="truncate text-ink">
                          {JSON.stringify(offender).replace(/["{}]/g, ' ')}
                        </div>
                      ))}
                      {rule.offendingRows!.length > 3 && (
                        <div className="text-[10px] text-green font-ui font-semibold pt-0.5">
                          + {rule.offendingRows!.length - 3} more offending instances
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Tile>

        {/* ========================================================================= */}
        {/* ROW B (Rows 5-7): STATS CLUSTER (cols 6-9, row-span-3, 2x2 grid) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-4 row-span-3 grid grid-cols-2 gap-2">
          {/* Mini Tile 1: Students (sage) */}
          <Tile variant="sage" className="flex flex-col justify-between p-3.5" padding="dense">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink2">
                Students
              </span>
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-green shadow-hairline">
                <Users className="w-3.5 h-3.5 stroke-[2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-ui text-ink tracking-tight leading-none">
                {rawStudentCount === null ? '—' : animStudents}
              </div>
              <p className="text-[11px] text-ink2 font-ui truncate mt-1">
                {studentContext}
              </p>
            </div>
          </Tile>

          {/* Mini Tile 2: Courses (mint) */}
          <Tile variant="mint" className="flex flex-col justify-between p-3.5" padding="dense">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink2">
                Courses
              </span>
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-green shadow-hairline">
                <BookOpen className="w-3.5 h-3.5 stroke-[2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-ui text-ink tracking-tight leading-none">
                {rawCourseCount === null ? '—' : animCourses}
              </div>
              <p className="text-[11px] text-ink2 font-ui truncate mt-1">
                {courseContext}
              </p>
            </div>
          </Tile>

          {/* Mini Tile 3: Rooms (white) */}
          <Tile variant="default" className="flex flex-col justify-between p-3.5" padding="dense">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink2">
                Rooms
              </span>
              <div className="w-7 h-7 rounded-full bg-greenSoft flex items-center justify-center text-green shadow-hairline">
                <DoorOpen className="w-3.5 h-3.5 stroke-[2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-ui text-ink tracking-tight leading-none">
                {rawRoomCount === null ? '—' : animRooms}
              </div>
              <p className="text-[11px] text-ink2 font-ui truncate mt-1">
                {roomContext}
              </p>
            </div>
          </Tile>

          {/* Mini Tile 4: Exam slots (white with green-soft ring icon) */}
          <Tile variant="default" className="flex flex-col justify-between p-3.5" padding="dense">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink2">
                Exam Slots
              </span>
              <div className="w-7 h-7 rounded-full bg-white ring-2 ring-greenSoft flex items-center justify-center text-green shadow-hairline">
                <CalendarDays className="w-3.5 h-3.5 stroke-[2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-ui text-ink tracking-tight leading-none">
                {rawSlotCount === null ? '—' : animSlots}
              </div>
              <p className="text-[11px] text-ink2 font-ui truncate mt-1">
                {slotContext}
              </p>
            </div>
          </Tile>
        </div>

        {/* ========================================================================= */}
        {/* ROW B (Rows 5-7): SOLVE TILE (cols 10-12, row-span-3, deep forest) */}
        {/* ========================================================================= */}
        <Tile
          variant="deep"
          colSpan={3}
          rowSpan={3}
          className="flex flex-col justify-between text-white relative overflow-hidden"
          padding="normal"
        >
          {/* Top Header & State Text */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-onDeep/70 font-semibold">
              Baseline Solver
            </span>
            <span className="text-xs font-mono font-medium text-teal-200">
              {solving
                ? 'Solving...'
                : canSolve
                ? 'Ready'
                : 'Waiting for 4 files'}
            </span>
          </div>

          {/* Solver Controls: Time limit & Seed translucent pills */}
          <div className="flex items-center gap-2 my-1 text-xs">
            {/* Time limit pill */}
            <button
              onClick={() => setTimeLimit(timeLimit === 30 ? 60 : timeLimit === 60 ? 120 : 30)}
              className="px-2.5 py-1 rounded-pill bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-[11px] transition-colors"
              title="Click to toggle time limit (30s / 60s / 120s)"
            >
              Time: {timeLimit}s
            </button>

            {/* Seed Stepper pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-white/10 border border-white/20 text-white font-mono text-[11px]">
              <span className="text-white/60">Seed:</span>
              <span className="font-bold">{seed}</span>
              <button
                onClick={() => setSeed((s) => (s > 0 ? s - 1 : 0))}
                className="hover:text-teal-200 px-0.5"
                title="Decrease seed"
              >
                -
              </button>
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="hover:text-teal-200 px-0.5"
                title="Increase seed"
              >
                +
              </button>
            </div>
          </div>

          {/* Center: Live Solving Progress or Error Message */}
          {solving ? (
            <div className="my-1 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-white/80">CP-SAT search</span>
                <span className="text-teal-200 font-bold tabular-nums">
                  {elapsedTimer.toFixed(1)}s
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-green rounded-full animate-pulse w-full" />
              </div>
            </div>
          ) : solveError ? (
            <div className="my-1 p-2 rounded bg-bad/20 border border-bad/40 text-xs text-white">
              <p className="truncate font-mono text-[11px]">{solveError}</p>
            </div>
          ) : (
            <p className="text-[11px] text-onDeep/80 font-ui leading-tight my-1">
              {canSolve
                ? 'Integer programming model ready. Press Enter or click below.'
                : 'Upload all 4 CSVs with zero integrity errors to enable.'}
            </p>
          )}

          {/* Bottom Action Button */}
          <div>
            {canSolve && !solving ? (
              <button
                onClick={handleSolveBaseline}
                className="w-full h-10 rounded-pill bg-white hover:bg-white/90 text-green font-bold text-xs shadow-hairline flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
                title="Execute Google OR-Tools CP-SAT integer programming solver (Enter)"
              >
                <span>Solve baseline</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            ) : solving ? (
              <button
                onClick={() => setSolving(false)}
                className="w-full h-10 rounded-pill bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Cancel solver</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full h-10 rounded-pill border border-white/30 text-white/50 bg-transparent font-medium text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                title={
                  errorCount > 0
                    ? `Resolve ${errorCount} schema errors above`
                    : 'Awaiting all 4 CSV files'
                }
              >
                <span>Solve baseline</span>
                <ArrowRight className="w-4 h-4 opacity-40" />
              </button>
            )}
          </div>
        </Tile>
      </div>
    </div>
  );
};
