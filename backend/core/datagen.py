"""Synthetic campus dataset generator with realistic Zipfian elective overlaps."""
from __future__ import annotations

import csv
import os
from pathlib import Path
import numpy as np
from backend.schemas import Dataset, Course, Enrollment, Room, Slot


def generate_dataset(
    n_students: int = 4200,
    n_courses: int = 180,
    n_rooms: int = 22,
    n_days: int = 5,
    slots_per_day: int = 3,
    seed: int = 42,
    output_dir: str | Path | None = None,
) -> Dataset:
    """Generates synthetic university examination instances with realistic conflict topology."""
    rng = np.random.default_rng(seed)
    departments = ["CS", "ECE", "ME", "EE", "CV", "MATH", "PHY", "HUM"]

    # 1. Generate Rooms
    rooms: list[Room] = []
    for r_idx in range(n_rooms):
        cap = int(rng.choice([50, 80, 100, 150, 200, 300, 400]))
        rooms.append(Room(room_id=f"R{r_idx + 1:02d}", building=f"Bld-{r_idx % 4 + 1}", capacity=cap))

    # 2. Generate Slots
    slots: list[Slot] = []
    slot_order = 0
    start_times = ["09:00", "13:00", "16:30"]
    end_times = ["12:00", "16:00", "19:30"]
    for day in range(n_days):
        for s_idx in range(slots_per_day):
            slot_id = f"D{day + 1}S{s_idx + 1}"
            slots.append(
                Slot(
                    slot_id=slot_id,
                    day=day,
                    start=start_times[s_idx % len(start_times)],
                    end=end_times[s_idx % len(end_times)],
                    order=slot_order,
                )
            )
            slot_order += 1

    # 3. Generate Courses
    courses: list[Course] = []
    for c_idx in range(n_courses):
        dept = departments[c_idx % len(departments)]
        courses.append(
            Course(
                course_id=f"CRS{c_idx + 1:03d}",
                name=f"{dept} Elective {c_idx + 1}",
                dept=dept,
                duration_min=180 if c_idx % 5 == 0 else 120,
            )
        )

    # 4. Generate Student Enrollments
    # Zipfian distribution on cross-department electives to create dense bottleneck clusters
    elective_weights = 1.0 / np.arange(1, n_courses + 1) ** 1.1
    elective_weights /= elective_weights.sum()

    enrollments: list[Enrollment] = []
    for s_idx in range(n_students):
        student_id = f"STU{s_idx + 1:05d}"
        n_enrolled = int(rng.integers(4, 7))
        chosen_courses = rng.choice(
            [c.course_id for c in courses],
            size=n_enrolled,
            replace=False,
            p=elective_weights,
        )
        for c_id in chosen_courses:
            enrollments.append(Enrollment(student_id=student_id, course_id=str(c_id)))

    dataset = Dataset(courses=courses, enrollments=enrollments, rooms=rooms, slots=slots)

    if output_dir:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        # Write 4 CSVs
        with open(out_path / "courses.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["course_id", "name", "dept", "duration_min"])
            for c in courses:
                writer.writerow([c.course_id, c.name, c.dept, c.duration_min])

        with open(out_path / "enrollments.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["student_id", "course_id"])
            for e in enrollments:
                writer.writerow([e.student_id, e.course_id])

        with open(out_path / "rooms.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["room_id", "building", "capacity"])
            for r in rooms:
                writer.writerow([r.room_id, r.building, r.capacity])

        with open(out_path / "slots.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["slot_id", "day", "start", "end", "order"])
            for s in slots:
                writer.writerow([s.slot_id, s.day, s.start, s.end, s.order])

    return dataset
