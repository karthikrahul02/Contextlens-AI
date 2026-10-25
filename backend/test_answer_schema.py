from app.schemas.rag import AnswerResponse


response = AnswerResponse(
    question="Which database stores the vector embeddings?",
    objective="Identify the database used for vector storage.",
    short_answer=[
        "ChromaDB stores the vector embeddings.",
        "The embeddings support semantic retrieval.",
        "Retrieved content helps generate answers.",
    ],
    long_answer=(
        "ChromaDB stores the vector embeddings used by "
        "ContextLens AI. These embeddings support semantic "
        "retrieval from the indexed content."
    ),
    sources=[],
    evidence_status="retrieved",
)

print(response.model_dump_json(indent=2))