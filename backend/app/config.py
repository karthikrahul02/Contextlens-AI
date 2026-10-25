import os
from pathlib import Path

# Backend directory
BASE_DIR = Path(__file__).resolve().parent.parent

# ChromaDB storage directory
CHROMA_PATH = os.getenv(
    "CHROMA_PATH",
    str(BASE_DIR / "chroma_db"),
)

# SQLite source registry
DATA_DIR = Path(CHROMA_PATH).parent

DB_PATH = DATA_DIR / "contextlens_sources.db"