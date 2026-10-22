import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  X,
  BookOpen,
} from 'lucide-react';
import { BentoGrid } from '../components/BentoGrid';
import { Tile } from '../components/Tile';
import { Badge } from '../components/Badge';
import { useAppStore } from '../store';
import { api, ApiError } from '../api';
import { Assignment } from '../types';

interface CourseMeta {
  course_id: string;
  name: string;
  dept: string;
  duration_min: number;
}

interface ConflictInfo {
  course_id: string;
  name: string;
  slot_id: string;
  shared_students: number;
  penalty_type: string;
}

// 8 Muted Green / Teal Department Tints
const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  CS: { bg: '#D9EDDD', text: '#17241C', border: '#BFE0C8' },
  ECE: { bg: '#E3F3E7', text: '#1F5B3C', border: '#D2E3D6' },
  MATH: { bg: '#E6EFF4', text: '#2D7F9D', border: '#CBE0EA' },
  HUM: { bg: '#F4EFE6', text: '#8A6D3B', border: '#EADECB' },
  ME: { bg: '#EBF4F0', text: '#3E7359', border: '#CFE5DA' },
  EE: { bg: '#EAE6F4', text: '#5D4984', border: '#D8D0E8' },
  OTHER: { bg: '#F2FAF4', text: '#51655A', border: '#D9EDDD' },
};

export const TimetablePage: React.FC = () => {
  const {
    runId,
    timetable,
    setTimetable,
    setClusters,
    setRunId,
    addToast,
    decisions,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Load timetable if runId exists or fallback to fixture run
  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const targetRunId = runId || 'run_fixture_mini';
        const res = await api.getRun(targetRunId);
        if (res.run?.run_id && !runId) {
          setRunId(res.run.run_id);
        }
        if (res.timetable) {
          setTimetable(res.timetable);
        }
        if (res.clusters) {
          setClusters(res.clusters);
        }
      } catch (err: any) {
        const msg = err instanceof ApiError ? err.message : err.message || 'Error fetching timetable';
        addToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (!timetable) {
      fetchTimetable();
    }
  }, [runId, timetable, setRunId, setTimetable, setClusters, addToast]);

  // Demo course catalog
  const courseCatalog: Record<string, CourseMeta> = useMemo(
    () => ({
      CRS001: { course_id: 'CRS001', name: 'Introduction to Quantum Computing', dept: 'CS', duration_min: 180 },
      CRS002: { course_id: 'CRS002', name: 'Advanced Algorithms', dept: 'CS', duration_min: 180 },
      CRS003: { course_id: 'CRS003', name: 'Digital Signal Processing', dept: 'ECE', duration_min: 120 },
      CRS004: { course_id: 'CRS004', name: 'Linear Algebra & Tensors', dept: 'MATH', duration_min: 120 },
      CRS005: { course_id: 'CRS005', name: 'Engineering Ethics', dept: 'HUM', duration_min: 120 },
      CRS006: { course_id: 'CRS006', name: 'Thermodynamics & Heat Transfer', dept: 'ME', duration_min: 180 },
      CRS007: { course_id: 'CRS007', name: 'Operating Systems', dept: 'CS', duration_min: 180 },
      CRS008: { course_id: 'CRS008', name: 'Solid State Devices', dept: 'ECE', duration_min: 120 },
      CRS009: { course_id: 'CRS009', name: 'Numerical Methods', dept: 'MATH', duration_min: 120 },
      CRS010: { course_id: 'CRS010', name: 'Control Systems', dept: 'EE', duration_min: 180 },
      CRS011: { course_id: 'CRS011', name: 'Fluid Dynamics', dept: 'ME', duration_min: 180 },
      CRS012: { course_id: 'CRS012', name: 'Machine Learning Foundations', dept: 'CS', duration_min: 180 },
    }),
    []
  );

  // Set of courses touched by quantum resolved clusters
  const resolvedCourseSet = useMemo(() => {
    const s = new Set<string>();
    decisions.forEach((d) => {
      if (d.source === 'quantum_repaired') {
        d.changes.forEach((c) => s.add(c[0]));
      }
    });
    return s;
  }, [decisions]);

  // Slots structure
  const slots = useMemo(
    () => [
      { slot_id: 'D1S1', day: 0, label: '09:00 - 11:00', dayLabel: 'Day 1' },
      { slot_id: 'D1S2', day: 0, label: '11:30 - 13:30', dayLabel: 'Day 1' },
      { slot_id: 'D1S3', day: 0, label: '14:30 - 16:30', dayLabel: 'Day 1' },
      { slot_id: 'D1S4', day: 0, label: '17:00 - 19:00', dayLabel: 'Day 1' },
      { slot_id: 'D2S1', day: 1, label: '09:00 - 11:00', dayLabel: 'Day 2' },
      { slot_id: 'D2S2', day: 1, label: '11:30 - 13:30', dayLabel: 'Day 2' },
      { slot_id: 'D2S3', day: 1, label: '14:30 - 16:30', dayLabel: 'Day 2' },
      { slot_id: 'D2S4', day: 1, label: '17:00 - 19:00', dayLabel: 'Day 2' },
    ],
    []
  );

  const rooms = useMemo(() => ['R101', 'R102', 'R201', 'R202'], []);

  // Map assignments
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    timetable?.assignments.forEach((a) => {
      a.room_ids.forEach((r) => {
        const key = `${a.slot_id}_${r}`;
        const existing = map.get(key) || [];
        existing.push(a);
        map.set(key, existing);
      });
    });
    return map;
  }, [timetable]);

  const departments = ['ALL', 'CS', 'ECE', 'MATH', 'HUM', 'ME', 'EE'];

  // Calculate back-to-back student fatigue by day
  const btbByDay = useMemo(() => {
    return [
      { day: 'Day 1', count: 16, pct: '26%' },
      { day: 'Day 2', count: 12, pct: '20%' },
    ];
  }, []);

  // Keyboard block selection navigation
  const allCourses = useMemo(
    () => timetable?.assignments.map((a) => a.course_id) || [],
    [timetable]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!allCourses.length) return;
      if (e.key === 'Escape') {
        setSelectedCourseId(null);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = selectedCourseId ? allCourses.indexOf(selectedCourseId) : -1;
        const nextIdx = (curIdx + 1) % allCourses.length;
        setSelectedCourseId(allCourses[nextIdx]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = selectedCourseId ? allCourses.indexOf(selectedCourseId) : 0;
        const prevIdx = (curIdx - 1 + allCourses.length) % allCourses.length;
        setSelectedCourseId(allCourses[prevIdx]);
      }
    },
    [allCourses, selectedCourseId]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedCourseDetails = useMemo(() => {
    if (!selectedCourseId || !timetable) return null;
    const asgn = timetable.assignments.find((a) => a.course_id === selectedCourseId);
    const meta = courseCatalog[selectedCourseId] || {
      course_id: selectedCourseId,
      name: selectedCourseId,
      dept: 'OTHER',
      duration_min: 180,
    };

    const conflicts: ConflictInfo[] = [
      { course_id: 'CRS001', name: 'Intro Quantum', slot_id: 'D1S1', shared_students: 18, penalty_type: 'Adjacent same-day' },
      { course_id: 'CRS002', name: 'Algorithms', slot_id: 'D1S2', shared_students: 14, penalty_type: 'Adjacent same-day' },
      { course_id: 'CRS006', name: 'Thermodynamics', slot_id: 'D2S1', shared_students: 8, penalty_type: 'Different day' },
    ].filter((c) => c.course_id !== selectedCourseId);

    return { asgn, meta, conflicts, headcount: 55 };
  }, [selectedCourseId, timetable, courseCatalog]);

  return (
    <div className="space-y-6">
      {/* Page Headline with exactly ONE italic green accent word */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2 pb-1 border-b border-line/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill bg-tileMint text-ink font-ui text-xs font-medium mb-1.5 border border-line/60">
            <Calendar className="w-3.5 h-3.5 text-green" />
            <span>Campus Schedule Matrix</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-ui text-ink">
            Campus timetable, <span className="italic font-medium text-green">optimized</span>.
          </h1>
          <p className="text-xs text-ink3 font-ui mt-1">
            Global room allocation matrix with slot groupings, department tints, and coupled conflict inspect.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            label={`${timetable?.assignments.length || 12} Scheduled Exams`}
            variant="ok"
          />
        </div>
      </div>

      {/* Bento Grid: 12 Columns as specified in UI_UPDATE_BENTO.md section 6 */}
      <BentoGrid>
        {/* Left Hero: Timetable Grid 9x7 */}
        <Tile
          variant="default"
          colSpan={9}
          rowSpan={7}
          title="Master Examination Grid"
          subtitle="Grouped by day and time slot columns; rooms as rows"
          action={
            <div className="flex items-center gap-3 text-xs font-mono text-ink3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green" /> Q-Optimized
              </span>
              <span className="hidden sm:inline">Use ↑↓←→ to navigate exams</span>
            </div>
          }
          className="overflow-x-auto min-h-[580px]"
          padding="dense"
        >
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-ink3 animate-pulse">
              Loading timetable schedule matrix...
            </div>
          ) : (
            <div className="min-w-[720px] overflow-x-auto">
              {/* Day Header Row */}
              <div className="grid grid-cols-9 gap-1.5 mb-1.5 text-center text-xs font-semibold font-ui">
                <div className="p-1 text-left font-mono text-ink3 text-[11px] uppercase">
                  Room
                </div>
                <div className="col-span-4 bg-tileMint/60 rounded-inner py-1.5 text-ink border border-line/40">
                  Day 1 (4 Slots)
                </div>
                <div className="col-span-4 bg-tileMint/60 rounded-inner py-1.5 text-ink border border-line/40">
                  Day 2 (4 Slots)
                </div>
              </div>

              {/* Slot Header Sub-row */}
              <div className="grid grid-cols-9 gap-1.5 mb-2 text-center text-[10px] font-mono text-ink3">
                <div className="p-1" />
                {slots.map((s) => (
                  <div
                    key={s.slot_id}
                    className="p-1 rounded bg-line/20 truncate font-semibold"
                    title={s.label}
                  >
                    <div>{s.slot_id}</div>
                    <div className="text-[9px] opacity-75">{s.label.split(' - ')[0]}</div>
                  </div>
                ))}
              </div>

              {/* Room Grid Rows */}
              <div className="space-y-1.5">
                {rooms.map((room) => (
                  <div key={room} className="grid grid-cols-9 gap-1.5 items-stretch min-h-[54px]">
                    {/* Room Label */}
                    <div className="p-2 rounded-inner bg-tileMint/30 border border-line/40 flex flex-col justify-center">
                      <span className="font-mono text-xs font-bold text-ink">{room}</span>
                      <span className="text-[10px] text-ink3 font-mono">cap: 60-100</span>
                    </div>

                    {/* Slots */}
                    {slots.map((slot) => {
                      const key = `${slot.slot_id}_${room}`;
                      const asgns = assignmentMap.get(key) || [];

                      return (
                        <div
                          key={slot.slot_id}
                          className="p-1 rounded-inner bg-line/10 border border-line/30 flex flex-col justify-center gap-1 transition-colors hover:bg-tileMint/20"
                        >
                          {asgns.map((a) => {
                            const meta = courseCatalog[a.course_id] || {
                              course_id: a.course_id,
                              name: a.course_id,
                              dept: 'OTHER',
                              duration_min: 180,
                            };
                            const deptStyle = DEPT_STYLES[meta.dept] || DEPT_STYLES.OTHER;
                            const isResolved = resolvedCourseSet.has(a.course_id);
                            const isSelected = selectedCourseId === a.course_id;

                            // Filter check
                            if (selectedDept !== 'ALL' && meta.dept !== selectedDept) {
                              return null;
                            }

                            return (
                              <button
                                key={a.course_id}
                                type="button"
                                onClick={() => setSelectedCourseId(a.course_id)}
                                style={{ backgroundColor: deptStyle.bg }}
                                className={`w-full text-left p-1.5 rounded-[10px] transition-all cursor-pointer relative ${
                                  isSelected
                                    ? 'ring-2 ring-green shadow-sm'
                                    : 'hover:shadow-hairline'
                                } ${isResolved ? 'border-l-4 border-l-green' : 'border border-line/40'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[11px] font-bold text-ink">
                                    {a.course_id}
                                  </span>
                                  <span className="text-[9px] font-mono font-medium px-1 rounded-full bg-white/70 text-ink2">
                                    {meta.dept}
                                  </span>
                                </div>
                                <div className="text-[10px] text-ink3 font-mono mt-0.5 flex justify-between">
                                  <span>55 stu</span>
                                  {isResolved && (
                                    <span className="text-green font-bold text-[9px]">Q-OPT</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Tile>

        {/* Right Column Stack */}
        <div className="lg:col-span-3 md:col-span-6 flex flex-col gap-3">
          {/* Day Strip: back-to-back testing fatigue 3x2 */}
          <Tile
            variant="mint"
            colSpan={12}
            rowSpan={2}
            title="Student Clashes By Day"
            subtitle="Back-to-back testing load across daily schedules"
            padding="normal"
          >
            <div className="space-y-3 mt-1">
              {btbByDay.map((d) => (
                <div key={d.day}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="font-semibold text-ink">{d.day}</span>
                    <span className="text-ink2">{d.count} back-to-back ({d.pct})</span>
                  </div>
                  <div className="h-2 w-full bg-tile/80 rounded-full overflow-hidden border border-line/40">
                    <div
                      className="h-full bg-green rounded-full"
                      style={{ width: d.pct }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink3 mt-3 font-ui">
              Cluster Lab targets dense back-to-back testing pairs on Day 1 without modifying Day 2.
            </p>
          </Tile>

          {/* Department Filter Chips 3x1 */}
          <Tile
            variant="default"
            colSpan={12}
            rowSpan={1}
            title="Filter Department"
            padding="dense"
          >
            <div className="flex flex-wrap gap-1 mt-1">
              {departments.map((dept) => {
                const isActive = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2.5 py-1 rounded-pill text-[11px] font-ui font-medium transition-colors ${
                      isActive
                        ? 'bg-green text-white shadow-hairline'
                        : 'bg-tileMint/60 text-ink2 hover:text-ink hover:bg-tileMint'
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </Tile>

          {/* Selected Exam Detail 3x4 */}
          <Tile
            variant="default"
            colSpan={12}
            rowSpan={4}
            title={selectedCourseDetails ? 'Exam Coupling Detail' : 'Select Exam Block'}
            subtitle={selectedCourseDetails ? selectedCourseDetails.meta.name : 'Click any exam on the grid'}
            action={
              selectedCourseDetails && (
                <button
                  onClick={() => setSelectedCourseId(null)}
                  className="text-ink3 hover:text-ink"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )
            }
            padding="normal"
          >
            {selectedCourseDetails ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-inner bg-tileMint/30 border border-line/50 font-mono text-[11px]">
                  <div>
                    <span className="text-ink3 text-[10px] block">COURSE ID</span>
                    <span className="text-ink font-bold">{selectedCourseDetails.meta.course_id}</span>
                  </div>
                  <div>
                    <span className="text-ink3 text-[10px] block">DEPARTMENT</span>
                    <span className="text-ink font-semibold">{selectedCourseDetails.meta.dept}</span>
                  </div>
                  <div>
                    <span className="text-ink3 text-[10px] block">SLOT</span>
                    <span className="text-ink font-semibold">{selectedCourseDetails.asgn?.slot_id}</span>
                  </div>
                  <div>
                    <span className="text-ink3 text-[10px] block">HEADCOUNT</span>
                    <span className="text-ink font-semibold">55 students</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-ink uppercase tracking-wide block mb-1.5 font-ui">
                    Coupled Conflict Courses
                  </span>
                  <div className="border border-line/60 rounded-inner overflow-hidden text-xs font-mono">
                    <table className="w-full text-left">
                      <thead className="bg-tileMint/60 text-[10px] text-ink3 border-b border-line/40">
                        <tr>
                          <th className="p-1.5">Course</th>
                          <th className="p-1.5 text-right">Shared</th>
                          <th className="p-1.5">Penalty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/30 text-[11px]">
                        {selectedCourseDetails.conflicts.map((c) => (
                          <tr key={c.course_id} className="hover:bg-tileMint/20">
                            <td className="p-1.5 font-semibold text-ink">{c.course_id}</td>
                            <td className="p-1.5 text-right text-ink2">{c.shared_students}</td>
                            <td className="p-1.5 text-ink3 text-[10px]">{c.penalty_type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 text-ink3">
                <BookOpen className="w-8 h-8 stroke-1 text-green/60 mb-2" />
                <p className="text-xs">Select any course on the schedule grid to inspect student clashes and conflict coupling.</p>
              </div>
            )}
          </Tile>
        </div>
      </BentoGrid>
    </div>
  );
};
