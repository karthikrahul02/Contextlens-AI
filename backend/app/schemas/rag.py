from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class IngestTextRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source_name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=500000)


class AskQuestionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source_id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=1, max_length=5000)


class AnswerSource(BaseModel):
    reference: str
    source_name: str
    chunk_index: int
    distance: float
    text: str


class AnswerResponse(BaseModel):
    question: str
    objective: str

    short_answer: list[str] = Field(
        min_length=3,
        max_length=3,
    )

    long_answer: str

    sources: list[AnswerSource] = Field(default_factory=list)

    evidence_status: Literal[
        "retrieval_failure",
        "supported",
        "insufficient",
        "conflicting",
    ]