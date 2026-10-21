"""Unit tests for synthetic dataset generator (Task A1).

Owner: Member A (Classical core + backend)
Reference: docs/CONTRACTS.md Section 1 and tasks/A_backend.md
"""
import csv
import sys
import tempfile
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.core.datagen import compute_dataset_stats, generate_dataset


def test_datagen_determinism():
    """Verify generator output is strictly deterministic given the same seed."""
    ds1 = generate_dataset(n_students=100, n_courses=20, n_rooms=5, n_days=3, slots_per_day=3, seed=123)
    ds2 = generate_dataset(n_students=100, n_courses=20, n_rooms=5, n_days=3, slots_per_day=3, seed=123)

    assert len(ds1.courses) == len(ds2.courses)
    assert len(ds1.enrollments) == len(ds2.enrollments)
    assert len(ds1.rooms) == len(ds2.rooms)
    assert len(ds1.slots) == len(ds2.slots)

    # Check identical student-course mappings
    pairs1 = [(e.student_id, e.course_id) for e in ds1.enrollments]
    pairs2 = [(e.student_id, e.course_id) for e in ds2.enrollments]
    assert pairs1 == pairs2

    # Different seed produces different enrollments
    ds3 = generate_dataset(n_students=100, n_courses=20, n_rooms=5, n_days=3, slots_per_day=3, seed=999)
    pairs3 = [(e.student_id, e.course_id) for e in ds3.enrollments]
    assert pairs1 != pairs3


def test_no_duplicate_student_courses():
    """Verify that no student is enrolled in the same course more than once."""
    ds = generate_dataset(n_students=500, n_courses=40, n_rooms=8, n_days=4, slots_per_day=3, seed=42)

    student_courses: dict[str, list[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, []).append(e.course_id)

    for student_id, courses in student_courses.items():
        assert len(courses) == len(set(courses)), f"Student {student_id} has duplicate course enrollments"
        assert 4 <= len(courses) <= 7, f"Student {student_id} enrolled in unexpected number of courses: {len(courses)}"


def test_room_capacities_and_slot_ordering():
    """Verify room capacities are within [40, 400] and slot ordering is chronological."""
    ds = generate_dataset(n_students=200, n_courses=24, n_rooms=6, n_days=3, slots_per_day=3, seed=7)

    for r in ds.rooms:
        assert 40 <= r.capacity <= 400, f"Room {r.room_id} capacity {r.capacity} out of bounds [40, 400]"

    # Slots ordering
    for idx, s in enumerate(ds.slots):
        assert s.order == idx, f"Slot {s.slot_id} order {s.order} mismatch with index {idx}"
        assert 0 <= s.day < 3


def test_top_electives_dense_overlap():
    """Verify top electives share >= 100 students pairwise-connected overall in demo dataset."""
    # Run with a modest size that still displays dense elective clustering
    ds = generate_dataset(n_students=1200, n_courses=60, n_rooms=12, n_days=5, slots_per_day=3, seed=42)

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

    sorted_overlaps = sorted(pair_overlaps.values(), reverse=True)
    top_12_overlap_sum = sum(sorted_overlaps[:12])
    assert top_12_overlap_sum >= 100, f"Top 12 shared students sum {top_12_overlap_sum} < 100"


def test_capacity_feasibility_check():
    """Verify that total per-slot room capacity is at least 1.3x average slot demand."""
    ds = generate_dataset(n_students=600, n_courses=30, n_rooms=10, n_days=4, slots_per_day=3, seed=42)
    stats = compute_dataset_stats(ds)

    assert stats["capacity_margin"] >= 1.3, f"Capacity margin {stats['capacity_margin']} < 1.3x"


def test_csv_export_format():
    """Verify CSV export writes valid files matching docs/CONTRACTS.md Section 1."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        generate_dataset(n_students=50, n_courses=12, n_rooms=4, n_days=2, slots_per_day=3, seed=42, output_dir=tmp_path)

        # 1. courses.csv
        courses_file = tmp_path / "courses.csv"
        assert courses_file.exists()
        with open(courses_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            assert header == ["course_id", "name", "dept", "duration_min"]
            rows = list(reader)
            assert len(rows) == 12

        # 2. enrollments.csv
        enrollments_file = tmp_path / "enrollments.csv"
        assert enrollments_file.exists()
        with open(enrollments_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            assert header == ["student_id", "course_id"]
            rows = list(reader)
            assert len(rows) > 0

        # 3. rooms.csv
        rooms_file = tmp_path / "rooms.csv"
        assert rooms_file.exists()
        with open(rooms_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            assert header == ["room_id", "building", "capacity"]
            rows = list(reader)
            assert len(rows) == 4

        # 4. slots.csv
        slots_file = tmp_path / "slots.csv"
        assert slots_file.exists()
        with open(slots_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            assert header == ["slot_id", "day", "start", "end", "order"]
            rows = list(reader)
            assert len(rows) == 6


if __name__ == "__main__":
    test_datagen_determinism()
    test_no_duplicate_student_courses()
    test_room_capacities_and_slot_ordering()
    test_top_electives_dense_overlap()
    test_capacity_feasibility_check()
    test_csv_export_format()
    print("All datagen tests passed successfully!")
