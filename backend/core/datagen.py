"""Synthetic campus dataset generator with realistic Zipfian elective overlaps.

Task: A1 (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md Section 1 and tasks/A_backend.md
"""
from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np

from backend.schemas import Course, Dataset, Enrollment, Room, Slot

DEPARTMENTS = ["CS", "ECE", "ME", "EE", "CV", "MATH", "PHY", "HUM"]

POPULAR_ELECTIVE_NAMES = [
    "Intro to Artificial Intelligence",
    "Financial Mathematics & Modeling",
    "Bio-ethics & Technology",
    "Quantum Information & Computing",
    "Applied Machine Learning & Robotics",
    "Cybersecurity & Cryptography",
    "Environmental Science & Climate",
    "Economics & Game Theory for Engineers",
    "Cognitive Science & HCI",
    "Operations Research & Optimization",
    "Cloud Distributed Systems",
    "Data Science & Statistical Inference",
    "Renewable Energy Systems",
    "Computational Genomics",
    "Design Thinking & Innovation",
    "VLSI Design & Architecture",
]


def generate_dataset(
    n_students: int = 4200,
    n_courses: int = 180,
    n_rooms: int = 22,
    n_days: int = 5,
    slots_per_day: int = 3,
    seed: int = 42,
    name: str | None = None,
    output_dir: str | Path | None = None,
) -> Dataset:
    """Generates synthetic university examination instances with realistic conflict topology.

    Realism constraints:
    - 8 departments.
    - Each student enrolls in 5-6 courses: ~4 from their home department core pool
      and 1-2 cross-faculty electives drawn from a Zipf-like distribution.
    - Exam durations 120 or 180 minutes.
    - Room capacities between 40 and 400 with total capacity per slot at least 1.3x
      the expected peak slot load.
    - Slots numbered with a global 'order' and 'day'.
    """
    rng = np.random.default_rng(seed)

    # 1. Generate Courses (split into Departmental Cores and Cross-Faculty Electives)
    courses: list[Course] = []

    if n_courses >= 48:
        n_cohorts = 4  # 4 academic years (Freshman, Sophomore, Junior, Senior)
        active_depts = DEPARTMENTS
        core_per_student = 4
        elec_choices = [1, 2]
        elec_p = [0.4, 0.6]
        target_total_courses = (5, 6)
    elif n_courses >= 24:
        n_cohorts = 2
        active_depts = DEPARTMENTS[:6]
        core_per_student = 3
        elec_choices = [1, 2]
        elec_p = [0.5, 0.5]
        target_total_courses = (4, 5)
    else:  # Mini preset (e.g., 12 courses, 8 slots)
        n_cohorts = 1
        active_depts = DEPARTMENTS[:3]
        core_per_student = 2
        elec_choices = [1]
        elec_p = [1.0]
        target_total_courses = (3, 3)

    # Distribute courses evenly across cohorts
    courses_per_cohort = n_courses // n_cohorts
    cohort_courses: dict[int, list[str]] = {ch: [] for ch in range(n_cohorts)}
    cohort_dept_cores: dict[tuple[int, str], list[str]] = defaultdict(list)
    cohort_electives: dict[int, list[str]] = defaultdict(list)

    course_idx = 0
    for ch in range(n_cohorts):
        # In each cohort, reserve ~25% courses for electives
        ch_total = courses_per_cohort + (1 if ch < (n_courses % n_cohorts) else 0)
        ch_elec_count = max(2, int(ch_total * 0.25)) if ch_total >= 8 else max(1, ch_total // 3)
        ch_core_count = ch_total - ch_elec_count

        # Cores
        for c_i in range(ch_core_count):
            dept = active_depts[c_i % len(active_depts)]
            course_id = f"CRS{course_idx + 1:03d}"
            duration = 180 if course_idx % 4 == 0 else 120
            courses.append(
                Course(
                    course_id=course_id,
                    name=f"{dept} Core Y{ch + 1}-{c_i // len(active_depts) + 1}",
                    dept=dept,
                    duration_min=duration,
                )
            )
            cohort_courses[ch].append(course_id)
            cohort_dept_cores[(ch, dept)].append(course_id)
            course_idx += 1

        # Electives
        for e_i in range(ch_elec_count):
            course_id = f"CRS{course_idx + 1:03d}"
            name_idx = (ch * 4 + e_i) % len(POPULAR_ELECTIVE_NAMES)
            elective_name = POPULAR_ELECTIVE_NAMES[name_idx]
            dept = active_depts[e_i % len(active_depts)]
            duration = 180 if course_idx % 4 == 0 else 120
            courses.append(
                Course(
                    course_id=course_id,
                    name=elective_name,
                    dept=dept,
                    duration_min=duration,
                )
            )
            cohort_courses[ch].append(course_id)
            cohort_electives[ch].append(course_id)
            course_idx += 1

    # 2. Generate Student Enrollments
    enrollments: list[Enrollment] = []
    student_enrollment_counts: dict[str, int] = {}

    for s_idx in range(n_students):
        student_id = f"STU{s_idx + 1:05d}"
        ch = s_idx % n_cohorts
        home_dept = active_depts[(s_idx // n_cohorts) % len(active_depts)]
        student_courses: set[str] = set()

        # Department core courses within cohort
        avail_cores = cohort_dept_cores.get((ch, home_dept), [])
        if avail_cores:
            take_k = min(core_per_student, len(avail_cores))
            chosen_cores = rng.choice(avail_cores, size=take_k, replace=False)
            student_courses.update(chosen_cores)

        # Cross-faculty electives within cohort (Zipf-distributed)
        avail_elecs = cohort_electives.get(ch, [])
        if avail_elecs:
            ranks = np.arange(1, len(avail_elecs) + 1)
            probs = 1.0 / (ranks**1.1)
            probs /= probs.sum()

            target_total = (
                target_total_courses[0]
                if target_total_courses[0] == target_total_courses[1]
                else int(rng.choice([target_total_courses[0], target_total_courses[1]]))
            )
            needed_elecs = max(1, target_total - len(student_courses))
            needed_elecs = min(needed_elecs, len(avail_elecs))
            chosen_electives = rng.choice(avail_elecs, size=needed_elecs, replace=False, p=probs)
            student_courses.update(chosen_electives)

        for c_id in sorted(student_courses):
            enrollments.append(Enrollment(student_id=student_id, course_id=c_id))
        student_enrollment_counts[student_id] = len(student_courses)

    # 3. Generate Slots
    total_slots = n_days * slots_per_day
    slots: list[Slot] = []
    slot_order = 0
    standard_starts = ["09:00", "13:00", "16:30", "19:00"]
    standard_ends = ["12:00", "16:00", "19:30", "22:00"]

    for day in range(n_days):
        for s_idx in range(slots_per_day):
            slot_id = f"D{day + 1}S{s_idx + 1}"
            start_t = standard_starts[s_idx % len(standard_starts)]
            end_t = standard_ends[s_idx % len(standard_ends)]
            slots.append(
                Slot(
                    slot_id=slot_id,
                    day=day,
                    start=start_t,
                    end=end_t,
                    order=slot_order,
                )
            )
            slot_order += 1

    # 4. Generate Examination Rooms with strict capacity headroom (>= 1.3x max slot load)
    # Average student load per slot = total enrollments / total slots
    total_enrollment_count = len(enrollments)
    avg_slot_load = total_enrollment_count / max(1, total_slots)
    # Estimate peak slot load ~ 1.25 * avg_slot_load
    est_max_slot_load = avg_slot_load * 1.25
    target_slot_capacity = est_max_slot_load * 1.35  # >= 1.3x headroom

    rooms: list[Room] = []
    standard_caps = [50, 75, 100, 150, 200, 250, 300, 400]

    # Generate initial room pool with capacities between 40 and 400
    for r_idx in range(n_rooms):
        cap = int(rng.choice(standard_caps))
        room_id = f"R{r_idx + 1:02d}"
        building = f"Bld-{r_idx % 4 + 1}"
        rooms.append(Room(room_id=room_id, building=building, capacity=cap))

    # Scale room capacities if needed to guarantee >= 1.3x capacity constraint
    current_capacity = sum(r.capacity for r in rooms)
    if current_capacity < target_slot_capacity:
        scale = target_slot_capacity / current_capacity
        for r in rooms:
            new_cap = int(min(400, max(40, round(r.capacity * scale))))
            r.capacity = new_cap
        # Final pass: if still under due to 400 cap, boost smaller rooms
        while sum(r.capacity for r in rooms) < target_slot_capacity:
            for r in rooms:
                if r.capacity < 400:
                    r.capacity = min(400, r.capacity + 25)
                    if sum(r.capacity for r in rooms) >= target_slot_capacity:
                        break

    dataset = Dataset(courses=courses, enrollments=enrollments, rooms=rooms, slots=slots)

    # 5. Persist to Disk if output directory or preset name specified
    final_output_path: Path | None = None
    if output_dir:
        final_output_path = Path(output_dir)
    elif name:
        final_output_path = Path("data") / "synthetic" / name

    if final_output_path:
        final_output_path.mkdir(parents=True, exist_ok=True)
        # Write 4 CSVs strictly following CONTRACTS.md Section 1
        with open(final_output_path / "courses.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["course_id", "name", "dept", "duration_min"])
            for c in courses:
                writer.writerow([c.course_id, c.name, c.dept, c.duration_min])

        with open(final_output_path / "enrollments.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["student_id", "course_id"])
            for e in enrollments:
                writer.writerow([e.student_id, e.course_id])

        with open(final_output_path / "rooms.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["room_id", "building", "capacity"])
            for r in rooms:
                writer.writerow([r.room_id, r.building, r.capacity])

        with open(final_output_path / "slots.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["slot_id", "day", "start", "end", "order"])
            for s in slots:
                writer.writerow([s.slot_id, s.day, s.start, s.end, s.order])

    return dataset


def compute_dataset_stats(ds: Dataset) -> dict[str, Any]:
    """Computes conflict graph density, max overlap, and elective connectivity metrics."""
    student_courses: dict[str, list[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, []).append(e.course_id)

    pair_overlaps: dict[tuple[str, str], int] = {}
    for courses in student_courses.values():
        c_sorted = sorted(courses)
        for i in range(len(c_sorted)):
            for j in range(i + 1, len(c_sorted)):
                pair = (c_sorted[i], c_sorted[j])
                pair_overlaps[pair] = pair_overlaps.get(pair, 0) + 1

    num_courses = len(ds.courses)
    total_possible_edges = (num_courses * (num_courses - 1)) / 2 if num_courses > 1 else 1
    num_conflict_edges = len(pair_overlaps)
    density = num_conflict_edges / total_possible_edges

    max_overlap = max(pair_overlaps.values()) if pair_overlaps else 0

    total_slot_capacity = sum(r.capacity for r in ds.rooms)
    total_enrollments = len(ds.enrollments)
    total_slots = len(ds.slots)
    avg_slot_demand = total_enrollments / max(1, total_slots)
    capacity_margin = total_slot_capacity / max(1.0, avg_slot_demand)

    return {
        "courses": num_courses,
        "students": len(student_courses),
        "enrollments": total_enrollments,
        "rooms": len(ds.rooms),
        "slots": total_slots,
        "total_slot_capacity": total_slot_capacity,
        "avg_slot_demand": avg_slot_demand,
        "capacity_margin": capacity_margin,
        "conflict_edges": num_conflict_edges,
        "graph_density": density,
        "max_pairwise_overlap": max_overlap,
    }


def main():
    parser = argparse.ArgumentParser(description="QUANTA Synthetic Campus Timetabling Generator")
    parser.add_argument(
        "--preset",
        choices=["demo", "mini"],
        default="demo",
        help="Predefined dataset configuration preset",
    )
    parser.add_argument("--students", type=int, default=None, help="Custom student count")
    parser.add_argument("--courses", type=int, default=None, help="Custom course count")
    parser.add_argument("--rooms", type=int, default=None, help="Custom room count")
    parser.add_argument("--days", type=int, default=None, help="Custom examination days")
    parser.add_argument("--slots-per-day", type=int, default=None, help="Slots per day")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed")
    parser.add_argument("--output-dir", type=str, default=None, help="Custom output directory")

    args = parser.parse_args()

    if args.preset == "demo":
        students = args.students or 4200
        courses = args.courses or 180
        rooms = args.rooms or 22
        days = args.days or 5
        slots_per_day = args.slots_per_day or 3
        preset_name = "demo"
    else:  # mini
        students = args.students or 60
        courses = args.courses or 12
        rooms = args.rooms or 4
        days = args.days or 2
        slots_per_day = args.slots_per_day or 4
        preset_name = "mini"

    print(f"=== [QUANTA] Generating Synthetic Dataset Preset: '{preset_name}' ===")
    ds = generate_dataset(
        n_students=students,
        n_courses=courses,
        n_rooms=rooms,
        n_days=days,
        slots_per_day=slots_per_day,
        seed=args.seed,
        name=preset_name,
        output_dir=args.output_dir,
    )

    stats = compute_dataset_stats(ds)
    print(f"   Courses: {stats['courses']} | Students: {stats['students']} | Enrollments: {stats['enrollments']}")
    print(f"   Rooms: {stats['rooms']} | Total Per-Slot Room Capacity: {stats['total_slot_capacity']}")
    print(f"   Slots: {stats['slots']} | Avg Demand/Slot: {stats['avg_slot_demand']:.1f} | Capacity Margin: {stats['capacity_margin']:.2f}x")
    print(f"   Conflict Graph Density: {stats['graph_density']:.3f} ({stats['conflict_edges']} edges)")
    print(f"   Max Pairwise Student Overlap: {stats['max_pairwise_overlap']}")

    target_dir = args.output_dir or f"data/synthetic/{preset_name}"
    print(f"   CSVs saved successfully to: {target_dir}")


if __name__ == "__main__":
    main()

