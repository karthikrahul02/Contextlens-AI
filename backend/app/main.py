import asyncio
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.generation.llm_service import generate_response
from app.ingestion.document_processor import extract_document
from app.retrieval.rag_service import (
    EmptyTextError,
    LLMResponseError,
    SourceNotFoundError,
    ask_question,
    collection,
    ingest_text,
    recover_sources_from_chroma,
    delete_source_chunks,
)
from app.retrieval.source_registry import (
    get_source,
    init_source_registry,
    list_sources,
    register_source,
    remove_source_metadata,
)
from app.schemas.rag import (
    AnswerResponse,
    AskQuestionRequest,
    IngestTextRequest,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_source_registry()

    try:
        recovered = await asyncio.to_thread(recover_sources_from_chroma, collection)
        if recovered:
            logger.info("Recovered %d source(s) from ChromaDB", recovered)
    except Exception:
        logger.exception("Source recovery failed; continuing startup")

    yield


app = FastAPI(
    title="ContextLens AI",
    description="Source-grounded AI question-answering assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LLMTestRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)


@app.get("/")
def root():
    return {"message": "Welcome to ContextLens AI", "status": "running"}


@app.get("/api/v1/health")
def health():
    return {"status": "healthy", "service": "contextlens-api"}


@app.get("/api/v1/sources")
async def get_sources():
    try:
        sources = await asyncio.to_thread(list_sources)
        return {"sources": sources}
    except Exception:
        logger.exception("Failed to retrieve sources")
        raise HTTPException(status_code=500, detail="Failed to retrieve sources.")


@app.get("/api/v1/sources/{source_id}")
async def get_source_details(source_id: str):
    source = await asyncio.to_thread(get_source, source_id)

    if source is None:
        raise HTTPException(status_code=404, detail="Source not found.")

    return source
@app.delete("/api/v1/sources/{source_id}")
async def delete_source(source_id: str):
    # 1. Verify the source exists in SQLite.
    source = await asyncio.to_thread(
        get_source,
        source_id,
    )

    if source is None:
        raise HTTPException(
            status_code=404,
            detail="Source not found.",
        )

    # 2. Delete chunks from ChromaDB.
    try:
        deleted_chunks = await asyncio.to_thread(
            delete_source_chunks,
            source_id,
        )

    except SourceNotFoundError:
        logger.warning(
            "Source exists in SQLite but has no ChromaDB chunks: %s",
            source_id,
        )

        raise HTTPException(
            status_code=409,
            detail=(
                "Source metadata exists, but its indexed chunks "
                "were not found. Reconciliation is required."
            ),
        )

    except Exception:
        logger.exception(
            "Failed to delete source chunks: %s",
            source_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to delete source chunks.",
        )

    # 3. Remove metadata from SQLite.
    try:
        removed = await asyncio.to_thread(
            remove_source_metadata,
            source_id,
        )

        if not removed:
            logger.error(
                "Chunks deleted, but source metadata was not removed: %s",
                source_id,
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Chunks were deleted, but source metadata "
                    "could not be removed. Reconciliation is required."
                ),
            )

    except HTTPException:
        raise

    except Exception:
        logger.exception(
            "Chunks deleted, but SQLite metadata deletion failed: %s",
            source_id,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Chunks were deleted, but source metadata "
                "could not be removed. Reconciliation is required."
            ),
        )

    return {
        "message": "Source deleted successfully.",
        "source_id": source_id,
        "source_name": source["source_name"],
        "chunks_deleted": deleted_chunks,
    }


@app.post("/api/v1/llm/test")
async def test_llm(request: LLMTestRequest):
    try:
        answer = await generate_response(request.prompt)
        return {"answer": answer}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("LLM provider request failed")
        raise HTTPException(
            status_code=502,
            detail="LLM provider request failed. Check server logs.",
        )


@app.post("/api/v1/sources/text")
async def create_text_source(request: IngestTextRequest):
    try:
        result = await asyncio.to_thread(
            ingest_text,
            source_name=request.source_name,
            text=request.text,
        )
        await asyncio.to_thread(
            register_source,
            source_id=result["source_id"],
            source_name=result["source_name"],
            source_type="text",
            chunks_created=result["chunks_created"],
        )
        return result

    except EmptyTextError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Text ingestion failed")
        raise HTTPException(status_code=500, detail="Text ingestion failed.")


@app.post("/api/v1/ask", response_model=AnswerResponse)
async def ask(request: AskQuestionRequest):
    try:
        return await ask_question(
            source_id=request.source_id,
            question=request.question,
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except LLMResponseError as exc:
        logger.warning("Unusable LLM output: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception:
        logger.exception("Question answering failed")
        raise HTTPException(status_code=500, detail="Question answering failed.")


ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.post("/api/v1/sources/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "document").name
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload PDF, TXT, or DOCX.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        extracted_pages = await asyncio.to_thread(extract_document, temp_path)

        # Page markers only make sense for PDFs; DOCX and TXT have no pages.
        if extension == ".pdf":
            full_text = "\n\n".join(
                f"[Page {page['page_number']}]\n{page['text']}"
                for page in extracted_pages
            )
        else:
            full_text = "\n\n".join(page["text"] for page in extracted_pages)

        result = await asyncio.to_thread(
            ingest_text,
            source_name=filename,
            text=full_text,
        )

        await asyncio.to_thread(
            register_source,
            source_id=result["source_id"],
            source_name=result["source_name"],
            source_type=extension.lstrip("."),
            chunks_created=result["chunks_created"],
        )

        return {
            "message": "Document uploaded and processed successfully.",
            "source_id": result["source_id"],
            "source_name": result["source_name"],
            "chunks_created": result["chunks_created"],
            "pages_extracted": len(extracted_pages),
        }

    except ValueError as exc:  # EmptyTextError and extraction errors
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Document ingestion failed")
        raise HTTPException(status_code=500, detail="Document processing failed.")
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
        await file.close()