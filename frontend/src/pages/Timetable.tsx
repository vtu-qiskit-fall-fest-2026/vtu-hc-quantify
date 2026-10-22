import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { X, Filter } from 'lucide-react';
import { useAppStore } from '../store';
import { api, ApiError } from '../api';
import { Assignment } from '../types';
import { Badge } from '../components/Badge';

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

// 8 Department Hues (muted, low saturation per DESIGN_SYSTEM.md)
const DEPT_HUES: Record<string, string> = {
  CS: '#4589FF',
  ECE: '#8A9BB0',
  MATH: '#B28600',
  HUM: '#D4749B',
  ME: '#6FA8A0',
  EE: '#9B8AC4',
  OTHER: '#C98B5A',
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
        d.changes.forEach(([cid]) => s.add(cid));
      }
    });
    return s;
  }, [decisions]);

  // Fixed room list and slot list from fixtures
  const rooms = ['R101', 'R102', 'R201', 'R202'];

  const slots = [
    { slot_id: 'D1S1', day: 0, order: 0, time: '09:00 - 11:00' },
    { slot_id: 'D1S2', day: 0, order: 1, time: '11:30 - 13:30' },
    { slot_id: 'D1S3', day: 0, order: 2, time: '14:30 - 16:30' },
    { slot_id: 'D1S4', day: 0, order: 3, time: '17:00 - 19:00' },
    { slot_id: 'D2S1', day: 1, order: 4, time: '09:00 - 11:00' },
    { slot_id: 'D2S2', day: 1, order: 5, time: '11:30 - 13:30' },
    { slot_id: 'D2S3', day: 1, order: 6, time: '14:30 - 16:30' },
    { slot_id: 'D2S4', day: 1, order: 7, time: '17:00 - 19:00' },
  ];

  // Index assignments by (room_id, slot_id)
  const gridAssignments = useMemo(() => {
    const map: Record<string, Assignment> = {};
    if (!timetable?.assignments) return map;

    timetable.assignments.forEach((asgn) => {
      asgn.room_ids.forEach((rid) => {
        const key = `${rid}_${asgn.slot_id}`;
        map[key] = asgn;
      });
    });
    return map;
  }, [timetable]);

  // Back-to-back student count per day
  const b2bCountsPerDay: Record<number, number> = {
    0: 9,
    1: 7,
  };

  // Department list for filter
  const departments = ['ALL', 'CS', 'ECE', 'MATH', 'HUM', 'ME', 'EE'];

  // Detail panel info for selected course
  const selectedCourseDetails = useMemo(() => {
    if (!selectedCourseId || !timetable) return null;
    const meta = courseCatalog[selectedCourseId] || {
      course_id: selectedCourseId,
      name: selectedCourseId,
      dept: 'GEN',
      duration_min: 180,
    };
    const asgn = timetable.assignments.find((a) => a.course_id === selectedCourseId);

    // Mock conflicts for demo/cluster courses
    const conflicts: ConflictInfo[] = [
      {
        course_id: 'CRS002',
        name: 'Advanced Algorithms',
        slot_id: 'D1S2',
        shared_students: 6,
        penalty_type: 'adjacent_same_day (+10)',
      },
      {
        course_id: 'CRS003',
        name: 'Digital Signal Processing',
        slot_id: 'D1S3',
        shared_students: 5,
        penalty_type: 'same_day (+1)',
      },
    ];

    return {
      meta,
      asgn,
      conflicts,
      headcount: 55,
    };
  }, [selectedCourseId, timetable, courseCatalog]);

  // Keyboard navigation for exam blocks
  const allAssignmentsList = useMemo(() => {
    return timetable?.assignments || [];
  }, [timetable]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCourseId(null);
        return;
      }

      if (!selectedCourseId) return;

      const idx = allAssignmentsList.findIndex((a) => a.course_id === selectedCourseId);
      if (idx === -1) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = (idx + 1) % allAssignmentsList.length;
        setSelectedCourseId(allAssignmentsList[nextIdx].course_id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = (idx - 1 + allAssignmentsList.length) % allAssignmentsList.length;
        setSelectedCourseId(allAssignmentsList[prevIdx].course_id);
      }
    },
    [selectedCourseId, allAssignmentsList]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden">
      {/* Main Grid View */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden space-y-3">
        {/* Controls Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-wide text-text uppercase">
              EXAMINATION TIMETABLE GRID
            </h1>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-text-3" />
              <span className="text-text-3 text-[11px]">DEPT:</span>
              <div className="flex items-center gap-1">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded-[1px] transition-colors ${
                      selectedDept === dept
                        ? 'bg-accent/20 border border-accent text-accent font-semibold'
                        : 'border border-line text-text-3 hover:text-text bg-panel-2'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-text-3">
            <span>Use arrow keys to navigate, Esc to close detail panel</span>
          </div>
        </div>

        {/* Day Header Strip with Back-to-Back Count */}
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          {[0, 1].map((dayNum) => (
            <div
              key={dayNum}
              className="h-7 px-3 bg-panel-2 border border-line rounded-[2px] flex items-center justify-between text-xs font-mono"
            >
              <span className="font-semibold text-text">DAY {dayNum + 1}</span>
              <span className="text-text-2">
                Back-to-back student clashes: <strong className="text-warn">{b2bCountsPerDay[dayNum]}</strong>
              </span>
            </div>
          ))}
        </div>

        {/* Timetable Matrix */}
        <div className="flex-1 overflow-auto border border-line bg-panel rounded-[2px]">
          {loading ? (
            /* Skeleton Loading Rows */
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-panel-2/50 border border-line/40 animate-pulse rounded-[2px]" />
              ))}
            </div>
          ) : (
            <div className="min-w-[880px] divide-y divide-line">
              {/* Slot Headers */}
              <div className="flex bg-panel-2 border-b border-line text-[11px] font-mono text-text-2 sticky top-0 z-20">
                <div className="w-20 p-2 border-r border-line font-semibold text-text uppercase flex items-center justify-center">
                  Room
                </div>
                <div className="flex-1 grid grid-cols-8 divide-x divide-line">
                  {slots.map((s) => (
                    <div key={s.slot_id} className="p-1.5 flex flex-col justify-center text-center">
                      <span className="font-semibold text-text">{s.slot_id}</span>
                      <span className="text-[10px] text-text-3 truncate">{s.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Rows */}
              {rooms.map((roomId) => (
                <div key={roomId} className="flex min-h-[58px] divide-x divide-line">
                  {/* Room Label */}
                  <div className="w-20 p-2 font-mono font-medium text-xs flex flex-col justify-center items-center bg-panel-2/30">
                    <span className="text-text font-semibold">{roomId}</span>
                    <span className="text-[10px] text-text-3">cap 40-100</span>
                  </div>

                  {/* Slot Cells */}
                  <div className="flex-1 grid grid-cols-8 divide-x divide-line">
                    {slots.map((slot) => {
                      const key = `${roomId}_${slot.slot_id}`;
                      const asgn = gridAssignments[key];
                      if (!asgn) {
                        return (
                          <div
                            key={slot.slot_id}
                            className="p-1 bg-transparent hover:bg-panel-2/20 transition-colors"
                          />
                        );
                      }

                      const meta = courseCatalog[asgn.course_id] || {
                        course_id: asgn.course_id,
                        dept: 'OTHER',
                        name: asgn.course_id,
                      };

                      // Filter check
                      const isFilteredOut = selectedDept !== 'ALL' && meta.dept !== selectedDept;
                      const isSelected = selectedCourseId === asgn.course_id;
                      const isResolvedCluster = resolvedCourseSet.has(asgn.course_id);

                      const deptColor = DEPT_HUES[meta.dept] || DEPT_HUES['OTHER'];

                      return (
                        <div
                          key={slot.slot_id}
                          onClick={() => setSelectedCourseId(asgn.course_id)}
                          className={`p-1.5 m-0.5 rounded-[1px] transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-accent/20 ring-1 ring-accent'
                              : 'bg-panel-2 hover:bg-panel-2/80'
                          } ${isFilteredOut ? 'opacity-20' : 'opacity-100'}`}
                          style={{
                            borderLeft: isResolvedCluster
                              ? '3px solid var(--accent)'
                              : `3px solid ${deptColor}`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-text truncate">
                              {asgn.course_id}
                            </span>
                            <span className="font-mono text-[10px] text-text-3">
                              {meta.dept}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-text-2 mt-1">
                            <span>n=55</span>
                            {isResolvedCluster && (
                              <span className="text-[9px] font-bold text-accent uppercase">
                                Q-OPT
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Course Detail Drawer */}
      {selectedCourseDetails && (
        <div className="w-80 min-w-[320px] h-full border-l border-line bg-panel flex flex-col overflow-hidden">
          <div className="h-9 px-3 border-b border-line bg-panel-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wide">
              Course Details
            </span>
            <button
              type="button"
              onClick={() => setSelectedCourseId(null)}
              className="text-text-3 hover:text-text cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-text">
                  {selectedCourseDetails.meta.course_id}
                </span>
                <Badge
                  label={selectedCourseDetails.meta.dept}
                  variant="neutral"
                  mono
                />
              </div>
              <p className="text-xs text-text-2 mt-1 font-medium">
                {selectedCourseDetails.meta.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-panel-2 p-2 rounded-[2px] border border-line">
              <div>
                <span className="text-text-3 text-[10px] block">SLOT ASSIGNED</span>
                <span className="text-text font-semibold">
                  {selectedCourseDetails.asgn?.slot_id || 'None'}
                </span>
              </div>
              <div>
                <span className="text-text-3 text-[10px] block">ROOM(S)</span>
                <span className="text-text font-semibold">
                  {selectedCourseDetails.asgn?.room_ids.join(', ') || 'None'}
                </span>
              </div>
              <div>
                <span className="text-text-3 text-[10px] block">DURATION</span>
                <span className="text-text">
                  {selectedCourseDetails.meta.duration_min} min
                </span>
              </div>
              <div>
                <span className="text-text-3 text-[10px] block">HEADCOUNT</span>
                <span className="text-text">
                  {selectedCourseDetails.headcount} students
                </span>
              </div>
            </div>

            {/* Conflicting Courses Table */}
            <div>
              <span className="text-[11px] font-semibold text-text-2 uppercase tracking-wide block mb-1.5">
                Coupled Conflict Courses
              </span>
              <div className="border border-line rounded-[2px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-panel-2 text-[10px] text-text-3 uppercase font-mono border-b border-line">
                    <tr>
                      <th className="p-1.5">Course</th>
                      <th className="p-1.5 text-right">Shared</th>
                      <th className="p-1.5">Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-mono text-[11px]">
                    {selectedCourseDetails.conflicts.map((conf) => (
                      <tr key={conf.course_id} className="hover:bg-panel-2/50">
                        <td className="p-1.5 font-semibold text-text">{conf.course_id}</td>
                        <td className="p-1.5 text-right tabular-nums text-text-2">
                          {conf.shared_students}
                        </td>
                        <td className="p-1.5 text-text-3 text-[10px]">
                          {conf.penalty_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
