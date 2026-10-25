import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import DB_PATH


# Store the SQLite database beside the ChromaDB directory.
DATA_DIR = Path(DB_PATH).parent
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "contextlens_sources.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_source_registry():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                source_id TEXT PRIMARY KEY,
                source_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                chunks_created INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def register_source(
    source_id: str,
    source_name: str,
    source_type: str,
    chunks_created: int,
):
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO sources (
                source_id,
                source_name,
                source_type,
                chunks_created,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                source_id,
                source_name,
                source_type,
                chunks_created,
                created_at,
            ),
        )


def list_sources() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                source_id,
                source_name,
                source_type,
                chunks_created,
                created_at
            FROM sources
            ORDER BY created_at DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_source(source_id: str):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM sources
            WHERE source_id = ?
            """,
            (source_id,),
        ).fetchone()

    return dict(row) if row else None


def remove_source_metadata(source_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            DELETE FROM sources
            WHERE source_id = ?
            """,
            (source_id,),
        )

        return cursor.rowcount > 0


def recover_sources_from_chroma(collection) -> int:
    """
    Recover source metadata from existing ChromaDB records.

    Existing SQLite records are preserved.
    Only missing sources are registered.

    Returns:
        Number of newly registered sources.
    """
    result = collection.get(
        include=["metadatas"],
    )

    metadatas = result.get("metadatas") or []

    grouped_sources = {}

    for metadata in metadatas:
        if not metadata:
            continue

        source_id = metadata.get("source_id")
        source_name = metadata.get("source_name")

        if not source_id or not source_name:
            continue

        if source_id not in grouped_sources:
            grouped_sources[source_id] = {
                "source_id": source_id,
                "source_name": source_name,
                "chunks_created": 0,
            }

        grouped_sources[source_id]["chunks_created"] += 1

    migrated_count = 0

    for source in grouped_sources.values():

        existing_source = get_source(
            source["source_id"]
        )

        if existing_source:
            continue

        register_source(
            source_id=source["source_id"],
            source_name=source["source_name"],
            source_type="unknown",
            chunks_created=source["chunks_created"],
        )

        migrated_count += 1

    return migrated_count

