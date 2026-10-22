#!/usr/bin/env python3
"""
DATA-02B.2 / DATA-02B.3: Hardened Parquet Extraction Script

Reads raw Parquet files from raw directory (default: data/raw/candidate-matching-synthetic/),
verifies cryptographic SHA-256 checksums against docs/dataset-audit.md,
validates table schemas, and atomically exports raw records to interim JSONL files.
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
import pyarrow.parquet as pq

# Canonical SHA-256 hashes from docs/dataset-audit.md
EXPECTED_HASHES = {
    "resumes.parquet": "4A25ADD9C3A620C4C396E867063E390FC8084F9B53ED8135DEF049303A29D7A4",
    "jobs.parquet": "C13D7C7E0AB510E81117974027DE1364F973A27B3CACC8FABFBD8851C352C871",
    "matches.parquet": "DAB24E40948B2DA348C6DF7072B5B5FE3BB6EF8CAB335F88EEF5D5667EE79A92",
}

# Required columns per schema contract
REQUIRED_RESUME_COLS = {
    "resume_id",
    "role",
    "seniority",
    "years_experience",
    "industry",
    "education",
    "skills",
    "summary",
    "experience_bullets",
}

REQUIRED_JOB_COLS = {
    "job_id",
    "job_title",
    "seniority",
    "industry",
    "must_have_skills",
    "nice_to_have_skills",
    "description",
    "responsibilities",
    "requirements",
}

REQUIRED_MATCH_COLS = {
    "job_id",
    "relevant_resume_ids",
}

def compute_sha256(filepath: Path) -> str:
    """Computes uppercase SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest().upper()

def verify_source_hashes(raw_dir: Path) -> bool:
    """Verifies all source Parquet file checksums against expected values."""
    print("Verifying source Parquet SHA-256 checksums...")
    all_valid = True
    for filename, expected in EXPECTED_HASHES.items():
        filepath = raw_dir / filename
        if not filepath.exists():
            print(f"[ERROR] Source file missing: {filepath}", file=sys.stderr)
            all_valid = False
            continue
        actual = compute_sha256(filepath)
        if actual != expected:
            print(
                f"[ERROR] Checksum mismatch for {filename}:\n"
                f"  Expected: {expected}\n"
                f"  Actual:   {actual}",
                file=sys.stderr,
            )
            all_valid = False
        else:
            print(f"  [OK] {filename} (SHA-256: {actual[:16]}...)")
    return all_valid

def verify_table_schema(table, required_cols: set, table_name: str) -> None:
    """Verifies that all required columns are present in the table schema."""
    cols = set(table.column_names)
    missing = required_cols - cols
    if missing:
        raise ValueError(
            f"Parquet table '{table_name}' is missing required columns: {sorted(missing)}"
        )

def extract_parquet(raw_dir: Path, interim_dir: Path) -> None:
    """Extracts Parquet files to interim JSONL files atomically."""
    if not verify_source_hashes(raw_dir):
        print("[FATAL] Source file verification failed. Aborting extraction.", file=sys.stderr)
        sys.exit(1)

    interim_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = interim_dir / "_extract_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Extract Resumes
        print("\nExtracting resumes.parquet...")
        resumes_table = pq.read_table(raw_dir / "resumes.parquet")
        verify_table_schema(resumes_table, REQUIRED_RESUME_COLS, "resumes.parquet")
        resumes_pylist = resumes_table.to_pylist()
        resumes_pylist.sort(key=lambda r: r["resume_id"])

        resumes_tmp = tmp_dir / "raw-resumes.jsonl.tmp"
        with open(resumes_tmp, "w", encoding="utf-8", newline="\n") as f:
            for row in resumes_pylist:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  -> Processed {len(resumes_pylist)} resumes")

        # 2. Extract Jobs
        print("\nExtracting jobs.parquet...")
        jobs_table = pq.read_table(raw_dir / "jobs.parquet")
        verify_table_schema(jobs_table, REQUIRED_JOB_COLS, "jobs.parquet")
        jobs_pylist = jobs_table.to_pylist()
        jobs_pylist.sort(key=lambda j: j["job_id"])

        jobs_tmp = tmp_dir / "raw-jobs.jsonl.tmp"
        with open(jobs_tmp, "w", encoding="utf-8", newline="\n") as f:
            for row in jobs_pylist:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  -> Processed {len(jobs_pylist)} jobs")

        # 3. Extract Matches
        print("\nExtracting matches.parquet...")
        matches_table = pq.read_table(raw_dir / "matches.parquet")
        verify_table_schema(matches_table, REQUIRED_MATCH_COLS, "matches.parquet")
        matches_pylist = matches_table.to_pylist()
        matches_pylist.sort(key=lambda m: m["job_id"])

        matches_tmp = tmp_dir / "raw-matches.jsonl.tmp"
        with open(matches_tmp, "w", encoding="utf-8", newline="\n") as f:
            for row in matches_pylist:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  -> Processed {len(matches_pylist)} match records")

        # Atomic move to final interim paths
        resumes_tmp.replace(interim_dir / "raw-resumes.jsonl")
        jobs_tmp.replace(interim_dir / "raw-jobs.jsonl")
        matches_tmp.replace(interim_dir / "raw-matches.jsonl")

    except Exception as e:
        print(f"[FATAL] Extraction error: {e}", file=sys.stderr)
        # Clean up temporary files on error
        for p in tmp_dir.glob("*.tmp"):
            try:
                p.unlink()
            except OSError:
                pass
        sys.exit(1)
    finally:
        try:
            tmp_dir.rmdir()
        except OSError:
            pass

    print(f"\nExtraction completed successfully. Interim files written to: {interim_dir}")

def parse_args():
    parser = argparse.ArgumentParser(description="Extract Parquet files to interim JSONL")
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=None,
        help="Path to directory containing raw Parquet files",
    )
    parser.add_argument(
        "--interim-dir",
        type=Path,
        default=None,
        help="Path to directory where interim JSONL files should be written",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify SHA-256 checksums of raw Parquet files without extracting",
    )
    return parser.parse_args()

def main():
    repo_root = Path(__file__).resolve().parent.parent.parent
    args = parse_args()

    raw_dir = args.raw_dir if args.raw_dir else repo_root / "data" / "raw" / "candidate-matching-synthetic"
    interim_dir = args.interim_dir if args.interim_dir else repo_root / "data" / "interim"

    if args.verify_only:
        if not verify_source_hashes(raw_dir):
            sys.exit(1)
        sys.exit(0)

    extract_parquet(raw_dir, interim_dir)

if __name__ == "__main__":
    main()
