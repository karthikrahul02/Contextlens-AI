# ContextLens AI

**ContextLens AI** is a Retrieval-Augmented Generation (RAG) assistant
designed to help users find information in documents and receive
context-aware answers grounded in retrieved source material.

## Problem Statement

Finding accurate and relevant information from large amounts of
unstructured data is time-consuming and challenging. Traditional search
methods often lack contextual understanding, while AI-generated
responses may contain inaccurate or unsupported information. There is a
need for an intelligent system that can understand diverse data sources,
retrieve relevant information, and generate reliable, context-aware
answers with supporting evidence.

## Key Features

-   Ingest text and supported documents.
-   Split extracted content into chunks and generate embeddings.
-   Retrieve relevant chunks using semantic search.
-   Generate structured answers using a configured LLM.
-   Return an objective, short answer, long answer, source references,
    and evidence status.
-   Manage ingested sources: list, inspect, select, and delete.
-   Includes RAG evaluation utilities.

> **Input support:** Supported formats depend on the extractors
> implemented and tested in the current version. URL and video ingestion
> are intended possibilities and should not be assumed available unless
> implemented.

## Tech Stack

**Backend** - Python, FastAPI - ChromaDB - Sentence Transformers:
`sentence-transformers/all-MiniLM-L6-v2` - OpenAI-compatible client with
OpenRouter - PyMuPDF (PDF processing) - `python-docx` (DOCX
processing) - SQLite (source registry)

**Frontend** - React - Vite - Tailwind CSS - Lucide React

## How It Works

1.  **Ingestion:** Text is extracted from a supported input.
2.  **Chunking:** Content is split into smaller chunks.
3.  **Embedding:** Sentence Transformers converts chunks into vectors.
4.  **Storage:** Vectors and metadata are stored in ChromaDB; source
    information is tracked in SQLite.
5.  **Retrieval:** The question is embedded and relevant chunks are
    retrieved from the selected source.
6.  **Generation:** Retrieved context is passed to the configured
    language model.
7.  **Response:** ContextLens AI returns a structured answer with source
    references and an evidence status.

## Project Structure

``` text
Contextlens-AI/
├── backend/
│   ├── app/
│   │   ├── ingestion/
│   │   ├── retrieval/
│   │   ├── generation/
│   │   ├── schemas/
│   │   └── ...
│   ├── evaluate_rag.py
│   ├── rag_evaluation_results.json
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Prerequisites

-   Python (use a version compatible with the backend dependencies)
-   Node.js and npm
-   An OpenRouter API key
-   Git

## Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/karthikrahul02/Contextlens-AI.git
cd Contextlens-AI
```

### 2. Set up the backend

From the repository root:

``` powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local `backend/.env` file using the project's example if
available:

``` powershell
Copy-Item .env.example .env
```

Configure the environment variables expected by your backend, including
your OpenRouter API key and model settings. Example placeholder:

``` env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Keep real credentials in your local `.env` file only. Never commit API
keys, tokens, passwords, or other secrets. Keep `.env.example` limited
to placeholders.

Start the backend from the `backend` directory:

``` powershell
uvicorn app.main:app --reload
```

Backend endpoints: - API base: `http://127.0.0.1:8000` - Interactive
docs: `http://127.0.0.1:8000/docs` - Health check:
`http://127.0.0.1:8000/api/v1/health`

### 3. Set up the frontend

Open a second terminal:

``` powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

If the frontend requires an environment variable for the backend API
URL, configure the variable name used by your frontend code. Do not put
server-side secrets in frontend environment variables.

## API Overview

The backend includes source ingestion and management, and
question-answering routes. Confirm the latest route definitions in
`/docs`.

  Method     Endpoint                        Purpose
  ---------- ------------------------------- -------------------------------
  `GET`      `/api/v1/health`                Backend health check
  `POST`     `/api/v1/sources/text`          Ingest text
  `POST`     `/api/v1/sources/upload`        Upload a supported document
  `GET`      `/api/v1/sources`               List sources
  `GET`      `/api/v1/sources/{source_id}`   Retrieve source details
  `DELETE`   `/api/v1/sources/{source_id}`   Delete a source
  `POST`     `/api/v1/ask`                   Ask a question about a source

## Response Format

Responses are designed to contain:

-   **Objective:** What the question is asking.
-   **Short answer:** Concise key points.
-   **Long answer:** A fuller explanation.
-   **Sources:** Evidence references and retrieved excerpts.
-   **Evidence status:** A label describing the evidence state.

Evidence labels are system outputs, not guarantees of correctness.
Retrieval thresholds and model behavior can affect results. Check cited
source material for important decisions.

## Evaluation

The repository includes `backend/evaluate_rag.py` and
`backend/rag_evaluation_results.json`.

Review the evaluation script and its required configuration/data before
running it; it may need local environment variables or test inputs.

## Limitations & Responsible Use

-   Answer quality depends on extraction, chunking, retrieval, prompts,
    and the configured language model.
-   Semantic similarity does not prove factual correctness.
-   Validate references against the original material.
-   Only ingest content you are authorized to process.
-   Review evaluation outputs and sample data for confidential
    information before publishing.

## Roadmap

-   Improve evidence and citation validation.
-   Evaluate retrieval and answer quality with labeled test cases.
-   Improve handling of unsupported, incomplete, and conflicting
    evidence.
-   Expand and validate supported input formats.
-   Improve robustness, observability, and error handling.

## Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Make focused changes and test them.
4.  Open a pull request describing your changes.

## License

A license has not been specified in this README. Add a license file if
you intend to define reuse and distribution permissions.

## Author

**Rahul K**\
GitHub: [@karthikrahul02](https://github.com/karthikrahul02)
