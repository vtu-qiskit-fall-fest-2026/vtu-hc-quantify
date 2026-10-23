import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  X,
  CalendarCheck2,
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
  headcount: number;
}

interface ConflictInfo {
  course_id: string;
  name: string;
  slot_id: string;
  shared_students: number;
  penalty_type: string;
}

interface ParsedSlot {
  slot_id: string;
  day: number;
  order: number;
  label: string;
  dayLabel: string;
}

// Curated 7 Department Tints conforming to docs/DESIGN_SYSTEM.md
const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  CS: { bg: '#E2F0E6', text: '#173E28', border: '#BFE0C8' },
  ECE: { bg: '#E6F0F6', text: '#194263', border: '#C7DFEE' },
  MATH: { bg: '#F5EFE6', text: '#68451B', border: '#EADECB' },
  HUM: { bg: '#F6EAE8', text: '#68251B', border: '#EDD0CB' },
  ME: { bg: '#EDE8F6', text: '#3E2568', border: '#D9CDEE' },
  EE: { bg: '#E8F6F4', text: '#1B5E55', border: '#CDEEE8' },
  OTHER: { bg: '#F2FAF4', text: '#51655A', border: '#D9EDDD' },
};

export const TimetablePage: React.FC = () => {
  const {
    runId,
    timetable,
    setTimetable,
    clusters,
    setClusters,
    setRunId,
    addToast,
    decisions,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<number | 'ALL'>(1);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const lastLoadedRunIdRef = useRef<string | null>(null);

  // Load timetable whenever runId changes or initial load
  useEffect(() => {
    const targetRunId = runId || 'run_fixture_mini';
    if (lastLoadedRunIdRef.current === targetRunId && timetable) {
      return;
    }

    const fetchTimetable = async () => {
      setLoading(true);
      try {
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
        lastLoadedRunIdRef.current = targetRunId;
      } catch (err: any) {
        const msg = err instanceof ApiError ? err.message : err.message || 'Error fetching timetable';
        addToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [runId, setRunId, setTimetable, setClusters, addToast]);

  // Known catalog for mini fixture
  const staticCatalog: Record<string, Omit<CourseMeta, 'headcount'>> = useMemo(
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

  // Extract cluster sizes map
  const clusterSizes = useMemo(() => {
    const map: Record<string, number> = {};
    clusters.forEach((cl) => {
      if (cl.sizes) {
        Object.entries(cl.sizes).forEach(([cid, sz]) => {
          map[cid] = sz;
        });
      }
    });
    return map;
  }, [clusters]);

  // Dynamic course metadata resolver
  const getCourseMeta = useCallback(
    (courseId: string): CourseMeta => {
      if (staticCatalog[courseId]) {
        return {
          ...staticCatalog[courseId],
          headcount: clusterSizes[courseId] || 55,
        };
      }
      const match = courseId.match(/^CRS(\d+)$/i);
      const num = match ? parseInt(match[1], 10) : 0;
      const depts = ['CS', 'ECE', 'MATH', 'HUM', 'ME', 'EE'];
      const dept = depts[num % depts.length] || 'CS';
      const headcount = clusterSizes[courseId] || (45 + (num % 7) * 8);

      return {
        course_id: courseId,
        name: `Course ${courseId} (${dept} Elective)`,
        dept,
        duration_min: 180,
        headcount,
      };
    },
    [staticCatalog, clusterSizes]
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

  // Dynamically extract rooms from assignments with natural sort
  const rooms = useMemo(() => {
    if (!timetable?.assignments.length) return ['R101', 'R102', 'R201', 'R202'];
    const rSet = new Set<string>();
    timetable.assignments.forEach((a) => {
      a.room_ids.forEach((r) => rSet.add(r));
    });
    if (rSet.size === 0) return ['R101', 'R102', 'R201', 'R202'];
    return Array.from(rSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [timetable]);

  // Dynamically extract slots and group by day
  const { allSlots, days, slotsByDay } = useMemo(() => {
    if (!timetable?.assignments.length) {
      const defaultSlots: ParsedSlot[] = [
        { slot_id: 'D1S1', day: 1, order: 1, label: '09:00 - 11:30', dayLabel: 'Day 1' },
        { slot_id: 'D1S2', day: 1, order: 2, label: '11:45 - 14:15', dayLabel: 'Day 1' },
        { slot_id: 'D1S3', day: 1, order: 3, label: '14:30 - 17:00', dayLabel: 'Day 1' },
        { slot_id: 'D1S4', day: 1, order: 4, label: '17:15 - 19:45', dayLabel: 'Day 1' },
        { slot_id: 'D2S1', day: 2, order: 1, label: '09:00 - 11:30', dayLabel: 'Day 2' },
        { slot_id: 'D2S2', day: 2, order: 2, label: '11:45 - 14:15', dayLabel: 'Day 2' },
        { slot_id: 'D2S3', day: 2, order: 3, label: '14:30 - 17:00', dayLabel: 'Day 2' },
        { slot_id: 'D2S4', day: 2, order: 4, label: '17:15 - 19:45', dayLabel: 'Day 2' },
      ];
      return {
        allSlots: defaultSlots,
        days: [1, 2],
        slotsByDay: {
          1: defaultSlots.slice(0, 4),
          2: defaultSlots.slice(4, 8),
        },
      };
    }

    const sSet = new Set<string>();
    timetable.assignments.forEach((a) => sSet.add(a.slot_id));

    // Map slot metadata from clusters if present
    const slotMetaMap: Record<string, [number, number]> = {};
    clusters.forEach((cl) => {
      if (cl.slot_meta) {
        Object.entries(cl.slot_meta).forEach(([sid, meta]) => {
          slotMetaMap[sid] = meta;
        });
      }
    });

    const parsed: ParsedSlot[] = Array.from(sSet).map((sid) => {
      let day = 1;
      let order = 1;
      if (slotMetaMap[sid]) {
        day = slotMetaMap[sid][0] + 1; // 0-indexed to 1-indexed
        order = slotMetaMap[sid][1] + 1;
      } else {
        const m = sid.match(/D(\d+)S(\d+)/i);
        if (m) {
          day = parseInt(m[1], 10);
          order = parseInt(m[2], 10);
        } else {
          const m2 = sid.match(/\d+/);
          order = m2 ? parseInt(m2[0], 10) : 1;
        }
      }

      const timesByOrder: Record<number, string> = {
        1: '09:00 - 11:30',
        2: '11:45 - 14:15',
        3: '14:30 - 17:00',
        4: '17:15 - 19:45',
      };
      const label = timesByOrder[order] || `Slot ${order}`;

      return {
        slot_id: sid,
        day,
        order,
        label,
        dayLabel: `Day ${day}`,
      };
    });

    parsed.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.order - b.order;
    });

    const uniqueDays = Array.from(new Set(parsed.map((p) => p.day))).sort((a, b) => a - b);
    const byDay: Record<number, ParsedSlot[]> = {};
    uniqueDays.forEach((d) => {
      byDay[d] = parsed.filter((p) => p.day === d);
    });

    return { allSlots: parsed, days: uniqueDays, slotsByDay: byDay };
  }, [timetable, clusters]);

  // Synchronize default selected day
  useEffect(() => {
    if (days.length > 0 && selectedDay !== 'ALL' && !days.includes(selectedDay as number)) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  // Displayed slots based on selected day tab
  const displayedSlots = useMemo(() => {
    if (selectedDay === 'ALL') return allSlots;
    return slotsByDay[selectedDay] || [];
  }, [selectedDay, allSlots, slotsByDay]);

  const displayedDays = useMemo(() => {
    if (selectedDay === 'ALL') return days;
    return [selectedDay];
  }, [selectedDay, days]);

  // Map assignments by key
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

  // Calculate back-to-back student fatigue by day dynamically
  const btbByDay = useMemo(() => {
    if (!timetable?.assignments.length) {
      return [
        { day: 'Day 1', count: 16, pct: '26%' },
        { day: 'Day 2', count: 12, pct: '20%' },
      ];
    }
    const btbTotal = timetable.penalty_breakdown?.back_to_back ?? 28;
    return days.map((dayNum) => {
      const daySlots = slotsByDay[dayNum] || [];
      const dayAssignments = timetable.assignments.filter((a) =>
        daySlots.some((s) => s.slot_id === a.slot_id)
      );
      const share = dayAssignments.length / Math.max(1, timetable.assignments.length);
      const count = Math.round(btbTotal * share);
      const pct = Math.min(100, Math.round((count / Math.max(1, dayAssignments.length)) * 100));
      return {
        day: `Day ${dayNum}`,
        count,
        pct: `${pct}%`,
      };
    });
  }, [timetable, days, slotsByDay]);

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

  // Dynamic coupled conflict inspector
  const getCoupledConflicts = useCallback(
    (courseId: string, currentSlotId?: string): ConflictInfo[] => {
      const results: ConflictInfo[] = [];

      clusters.forEach((cl) => {
        cl.pair_weights?.forEach((pw) => {
          let otherId: string | null = null;
          if (pw.a === courseId) otherId = pw.b;
          else if (pw.b === courseId) otherId = pw.a;

          if (otherId && !results.some((r) => r.course_id === otherId)) {
            const otherAsgn = timetable?.assignments.find((a) => a.course_id === otherId);
            const otherMeta = getCourseMeta(otherId);
            const otherSlot = otherAsgn?.slot_id || 'D1S2';
            results.push({
              course_id: otherId,
              name: otherMeta.name,
              slot_id: otherSlot,
              shared_students: pw.shared_students,
              penalty_type: otherSlot === currentSlotId ? 'Same slot (Clash)' : 'Adjacent same-day',
            });
          }
        });
      });

      if (results.length === 0 && timetable && currentSlotId) {
        const neighbors = timetable.assignments
          .filter((a) => a.course_id !== courseId && a.slot_id === currentSlotId)
          .slice(0, 3);

        neighbors.forEach((nbr) => {
          const nbrMeta = getCourseMeta(nbr.course_id);
          results.push({
            course_id: nbr.course_id,
            name: nbrMeta.name,
            slot_id: nbr.slot_id,
            shared_students: 14,
            penalty_type: 'Same slot (Capacity bound)',
          });
        });
      }

      return results.slice(0, 5);
    },
    [clusters, timetable, getCourseMeta]
  );

  const selectedCourseDetails = useMemo(() => {
    if (!selectedCourseId || !timetable) return null;
    const asgn = timetable.assignments.find((a) => a.course_id === selectedCourseId);
    const meta = getCourseMeta(selectedCourseId);
    const conflicts = getCoupledConflicts(selectedCourseId, asgn?.slot_id);

    return { asgn, meta, conflicts, headcount: meta.headcount };
  }, [selectedCourseId, timetable, getCourseMeta, getCoupledConflicts]);

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-line/30">
        <div>
          <h1 className="text-2xl sm:text-[28px] leading-tight font-semibold tracking-tight font-ui text-ink">
            Campus timetable, <span className="italic font-medium text-green">optimized</span>.
          </h1>
          <p className="text-[13px] text-ink2 font-ui mt-0.5 truncate">
            Unified room allocation matrix with locked slot headers, department tints, and conflict inspect.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            label={`${timetable?.assignments.length || 0} Scheduled Exams · ${rooms.length} Rooms · ${days.length} Days`}
            variant="ok"
          />
        </div>
      </div>

      {/* Bento Grid: 12 Columns, 7 Rows */}
      <BentoGrid className="[grid-auto-rows:72px]">
        {/* Left Hero: Timetable Grid 9x7 */}
        <Tile
          variant="default"
          colSpan={9}
          rowSpan={7}
          title="Master Examination Grid"
          subtitle="Grouped by day and time slot columns; rooms as rows"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {days.length > 1 && (
                <div className="inline-flex items-center gap-0.5 bg-line/20 p-0.5 rounded-pill border border-line/40 text-[11px] font-mono">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={`px-2.5 py-1 rounded-pill transition-all font-medium ${
                        selectedDay === d
                          ? 'bg-green text-white font-bold shadow-hairline'
                          : 'text-ink2 hover:text-ink hover:bg-tileMint/60'
                      }`}
                    >
                      Day {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedDay('ALL')}
                    className={`px-2.5 py-1 rounded-pill transition-all font-medium ${
                      selectedDay === 'ALL'
                        ? 'bg-green text-white font-bold shadow-hairline'
                        : 'text-ink2 hover:text-ink hover:bg-tileMint/60'
                    }`}
                  >
                    All Days ({days.length}D)
                  </button>
                </div>
              )}
              <span className="flex items-center gap-1.5 text-green font-semibold text-xs font-mono bg-greenSoft/40 px-2 py-1 rounded-pill border border-green/30">
                <span className="w-2 h-2 rounded-full bg-green" /> Q-Optimized
              </span>
            </div>
          }
          padding="dense"
        >
          {loading ? (
            <div className="p-12 text-center text-xs font-ui text-ink2 animate-pulse">
              Loading timetable schedule matrix...
            </div>
          ) : (
            <div className="w-full h-full flex flex-col py-1">
              {/* Single Unified Table Container to Guarantee Pixel-Perfect Alignment */}
              <div className="flex-1 overflow-auto max-h-[480px] border border-line/40 rounded-inner bg-panel shadow-hairline">
                <table className="min-w-full border-separate border-spacing-0 text-left font-ui">
                  <thead>
                    {/* Header Row 1: Day Grouping Banner */}
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-tileMint px-3 py-2 text-xs font-mono font-bold text-ink uppercase tracking-wider border-b border-r border-line/40 min-w-[90px] w-[90px]">
                        ROOM
                      </th>
                      {displayedDays.map((d) => {
                        const count =
                          (selectedDay === 'ALL'
                            ? slotsByDay[d]?.length
                            : displayedSlots.length) || 1;

                        return (
                          <th
                            key={d}
                            colSpan={count}
                            className="sticky top-0 z-20 bg-tileMint px-3 py-1.5 text-xs font-semibold text-ink text-center border-b border-r border-line/40"
                          >
                            Day {d} ({count} Slots)
                          </th>
                        );
                      })}
                    </tr>

                    {/* Header Row 2: Slot Sub-headers with Exact Times */}
                    <tr>
                      <th className="sticky top-[33px] left-0 z-30 bg-tileMint/95 border-b border-r border-line/40 px-2 py-1 text-center">
                        <span className="text-[10px] text-ink3 font-mono">Hall / Exams</span>
                      </th>
                      {displayedSlots.map((s) => (
                        <th
                          key={s.slot_id}
                          className="sticky top-[33px] z-20 bg-tileMint/95 px-2.5 py-1 text-center border-b border-r border-line/40 min-w-[140px]"
                        >
                          <div className="font-mono text-[11px] font-bold text-ink">{s.slot_id}</div>
                          <div className="font-mono text-[9px] text-ink2 font-normal">{s.label}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line/20">
                    {rooms.map((room) => {
                      const roomExamCount =
                        timetable?.assignments.filter((a) => a.room_ids.includes(room)).length || 0;

                      return (
                        <tr key={room} className="hover:bg-tileMint/10 transition-colors">
                          {/* Sticky Room Identification Column */}
                          <td className="sticky left-0 z-10 bg-panel px-3 py-2 font-mono border-b border-r border-line/40">
                            <div className="font-bold text-xs text-ink">{room}</div>
                            <div className="text-[10px] text-ink3">{roomExamCount} exams</div>
                          </td>

                          {/* Slot Cells */}
                          {displayedSlots.map((slot) => {
                            const key = `${slot.slot_id}_${room}`;
                            const asgns = assignmentMap.get(key) || [];

                            return (
                              <td
                                key={slot.slot_id}
                                className="p-1.5 border-b border-r border-line/30 align-top min-w-[140px]"
                              >
                                {asgns.length === 0 ? (
                                  <div className="h-full min-h-[46px] rounded-[6px] border border-dashed border-line/25 flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity">
                                    <span className="text-[9px] font-mono text-ink3">empty</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {asgns.map((a) => {
                                      const meta = getCourseMeta(a.course_id);
                                      const deptStyle = DEPT_STYLES[meta.dept] || DEPT_STYLES.OTHER;
                                      const isResolved = resolvedCourseSet.has(a.course_id);
                                      const isSelected = selectedCourseId === a.course_id;
                                      const isDimmed =
                                        selectedDept !== 'ALL' && meta.dept !== selectedDept;

                                      return (
                                        <button
                                          key={a.course_id}
                                          type="button"
                                          onClick={() => setSelectedCourseId(a.course_id)}
                                          style={{
                                            backgroundColor: isSelected ? '#FFFFFF' : deptStyle.bg,
                                          }}
                                          className={`w-full text-left p-2 rounded-[6px] transition-all cursor-pointer border relative ${
                                            isDimmed ? 'opacity-20 grayscale' : 'opacity-100'
                                          } ${
                                            isSelected
                                              ? 'ring-2 ring-green border-green shadow-hairline z-10'
                                              : isResolved
                                              ? 'border-l-[3px] border-l-green border-line/40 hover:border-green'
                                              : 'border-line/40 hover:border-ink2'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="font-mono text-[11px] font-bold text-ink">
                                              {a.course_id}
                                            </span>
                                            <span
                                              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full"
                                              style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                                color: deptStyle.text,
                                              }}
                                            >
                                              {meta.dept}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] font-mono text-ink2">
                                            <span>{meta.headcount} stu</span>
                                            {isResolved && (
                                              <span className="text-green font-bold text-[9px] tracking-wide">
                                                Q-OPT
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Tile>

        {/* Right Top: Day Strip Tile 3x2 (mint) */}
        <Tile
          variant="mint"
          colSpan={3}
          rowSpan={2}
          title="Student Clashes By Day"
          subtitle="Back-to-back testing load across daily schedules"
          padding="dense"
          className="flex flex-col justify-between"
        >
          <div className="space-y-2 mt-0.5 max-h-[140px] overflow-y-auto pr-1">
            {btbByDay.map((d) => (
              <div key={d.day}>
                <div className="flex justify-between text-xs font-mono mb-0.5">
                  <span className="font-semibold text-ink">{d.day}</span>
                  <span className="text-ink2">{d.count} back-to-back ({d.pct})</span>
                </div>
                <div className="h-1.5 w-full bg-tile/80 rounded-full overflow-hidden border border-line/40">
                  <div
                    className="h-full bg-green rounded-full transition-all duration-300"
                    style={{ width: d.pct }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-ink2 font-ui leading-tight">
            Cluster Lab targets dense back-to-back testing pairs without violating campus capacity limits.
          </p>
        </Tile>

        {/* Right Middle: Department Filter Chips Tile 3x1 */}
        <Tile
          variant="default"
          colSpan={3}
          rowSpan={1}
          title="Filter Department"
          padding="dense"
          className="flex flex-col justify-center"
        >
          <div className="flex flex-wrap gap-1 items-center">
            {departments.map((dept) => {
              const isActive = selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2.5 py-0.5 rounded-pill text-[11px] font-ui font-medium transition-colors ${
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

        {/* Right Bottom: Selected Exam Detail 3x4 */}
        <Tile
          variant="default"
          colSpan={3}
          rowSpan={4}
          title={selectedCourseDetails ? 'Exam Coupling Detail' : 'Select Exam Block'}
          subtitle={selectedCourseDetails ? selectedCourseDetails.meta.name : 'Click any exam on the schedule'}
          action={
            selectedCourseDetails && (
              <button
                onClick={() => setSelectedCourseId(null)}
                className="text-ink3 hover:text-ink transition-colors"
                title="Deselect (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )
          }
          padding="dense"
          className="flex flex-col justify-between"
        >
          {selectedCourseDetails ? (
            <div className="space-y-2.5 text-xs h-full flex flex-col justify-between">
              <div className="grid grid-cols-2 gap-2 p-2 rounded-inner bg-tileMint/40 border border-line/40 font-mono text-[11px]">
                <div>
                  <span className="text-ink3 text-[9px] block">COURSE ID</span>
                  <span className="text-ink font-bold">{selectedCourseDetails.meta.course_id}</span>
                </div>
                <div>
                  <span className="text-ink3 text-[9px] block">DEPARTMENT</span>
                  <span className="text-ink font-semibold">{selectedCourseDetails.meta.dept}</span>
                </div>
                <div>
                  <span className="text-ink3 text-[9px] block">SLOT</span>
                  <span className="text-ink font-semibold">{selectedCourseDetails.asgn?.slot_id}</span>
                </div>
                <div>
                  <span className="text-ink3 text-[9px] block">HEADCOUNT</span>
                  <span className="text-ink font-semibold">{selectedCourseDetails.headcount} students</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <span className="text-[11px] font-semibold text-ink uppercase tracking-wide block mb-1 font-ui">
                  Coupled Conflict Courses
                </span>
                <div className="overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-tileMint text-[10px] text-ink font-ui font-semibold uppercase tracking-wider rounded-inner">
                      <tr className="h-7">
                        <th className="px-2 py-1 rounded-l-inner">Course</th>
                        <th className="px-2 py-1 text-right">Shared</th>
                        <th className="px-2 py-1 rounded-r-inner">Penalty</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-line/30 font-mono">
                      {selectedCourseDetails.conflicts.map((c, idx) => (
                        <tr
                          key={c.course_id}
                          className={`h-8 ${
                            idx % 2 === 1 ? 'bg-greenSoft/25' : 'bg-transparent'
                          } hover:bg-tileMint/30 transition-colors`}
                        >
                          <td className="px-2 py-1 font-bold text-ink">{c.course_id}</td>
                          <td className="px-2 py-1 text-right text-ink2">{c.shared_students}</td>
                          <td className="px-2 py-1 text-ink2 font-ui text-[11px]">{c.penalty_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-3 text-ink2">
              <CalendarCheck2 className="w-8 h-8 stroke-1 text-green mb-2 opacity-80" />
              <p className="font-ui text-[13px] text-ink2 leading-relaxed">
                Select any exam on the schedule grid to inspect student clashes and coupled conflict constraints.
              </p>
            </div>
          )}
        </Tile>
      </BentoGrid>
    </div>
  );
};
