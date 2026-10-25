import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# --------------------------------------------------
# Configuration
# --------------------------------------------------

API_URL = os.getenv(
    "CONTEXTLENS_API_URL",
    "http://127.0.0.1:8000/api/v1/ask",
)

SOURCE_ID = os.getenv(
    "CONTEXTLENS_SOURCE_ID",
    "fdf8317a-eb25-4f48-b72c-cdcaef5b99d3",
)


# --------------------------------------------------
# Evaluation Dataset
# --------------------------------------------------

TEST_CASES = [
    {
        "name": "Vector database identification",
        "question": "Which database stores the vector embeddings?",
        "expected_status": "supported",
        "expected_keywords": ["ChromaDB"],
    },
    {
        "name": "Embedding model identification",
        "question": "Which technology generates text embeddings?",
        "expected_status": "supported",
        "expected_keywords": ["Sentence Transformers"],
    },
    {
        "name": "Backend identification",
        "question": "Which framework is used for the backend?",
        "expected_status": "supported",
        "expected_keywords": ["FastAPI"],
    },
    {
        "name": "LLM identification",
        "question": "Which language model generates answers?",
        "expected_status": "supported",
        "expected_keywords": ["Qwen"],
    },
    {
        "name": "Unsupported CEO question",
        "question": "Who is the CEO of ContextLens AI?",
        "expected_status": "insufficient",
        "expected_keywords": [],
    },
    {
        "name": "Unsupported founding date",
        "question": "In which year was ContextLens AI founded?",
        "expected_status": "insufficient",
        "expected_keywords": [],
    },
]


# --------------------------------------------------
# API Request
# --------------------------------------------------

def ask_question(question: str) -> dict:
    payload = {
        "source_id": SOURCE_ID,
        "question": question,
    }

    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


# --------------------------------------------------
# Evaluation
# --------------------------------------------------

def evaluate_case(test_case: dict) -> dict:
    print("\n" + "=" * 65)
    print(f"Test: {test_case['name']}")
    print(f"Question: {test_case['question']}")

    try:
        result = ask_question(test_case["question"])

    except HTTPError as exc:
        print(f"HTTP Error: {exc.code}")
        print(exc.read().decode("utf-8", errors="replace"))

        return {
            "name": test_case["name"],
            "passed": False,
            "error": f"HTTP {exc.code}",
        }

    except URLError as exc:
        print(f"Connection Error: {exc.reason}")

        return {
            "name": test_case["name"],
            "passed": False,
            "error": str(exc.reason),
        }

    except Exception as exc:
        print(f"Unexpected Error: {exc}")

        return {
            "name": test_case["name"],
            "passed": False,
            "error": str(exc),
        }

    actual_status = result.get("evidence_status")

    short_answer = result.get("short_answer", [])

    long_answer = result.get("long_answer", "")

    sources = result.get("sources", [])

    combined_answer = " ".join(
        str(item)
        for item in short_answer
    ) + " " + str(long_answer)

    expected_status = test_case["expected_status"]

    status_match = actual_status == expected_status

    keywords = test_case["expected_keywords"]

    keyword_match = all(
        keyword.lower() in combined_answer.lower()
        for keyword in keywords
    )

    references = {
        source.get("reference")
        for source in sources
        if isinstance(source, dict)
    }

    citations_valid = all(
        isinstance(ref, str)
        and ref.startswith("chunk_")
        for ref in references
    )

    # Basic structural checks.
    structure_valid = (
        isinstance(result.get("question"), str)
        and isinstance(result.get("objective"), str)
        and isinstance(short_answer, list)
        and len(short_answer) == 3
        and all(
            isinstance(item, str) and item.strip()
            for item in short_answer
        )
        and isinstance(long_answer, str)
        and bool(long_answer.strip())
        and isinstance(sources, list)
    )

    passed = (
        status_match
        and keyword_match
        and citations_valid
        and structure_valid
    )

    print(f"Expected status: {expected_status}")
    print(f"Actual status:   {actual_status}")

    print(f"Status match:    {status_match}")
    print(f"Keyword match:   {keyword_match}")
    print(f"Citations valid: {citations_valid}")
    print(f"Structure valid: {structure_valid}")

    print("\nShort answer:")

    for point in short_answer:
        print(f"- {point}")

    print("\nLong answer:")
    print(long_answer)

    print("\nSources:")

    for source in sources:
        print(
            f"- {source.get('reference')} | "
            f"distance={source.get('distance')}"
        )

    print(f"\nResult: {'PASS' if passed else 'FAIL'}")

    return {
        "name": test_case["name"],
        "passed": passed,
        "expected_status": expected_status,
        "actual_status": actual_status,
        "status_match": status_match,
        "keyword_match": keyword_match,
        "citations_valid": citations_valid,
        "structure_valid": structure_valid,
    }


# --------------------------------------------------
# Main
# --------------------------------------------------

def main():
    print("=" * 65)
    print("CONTEXTLENS AI - RAG EVALUATION")
    print("=" * 65)

    print(f"API: {API_URL}")
    print(f"Source ID: {SOURCE_ID}")
    print(f"Total tests: {len(TEST_CASES)}")

    results = []

    for test_case in TEST_CASES:
        result = evaluate_case(test_case)
        results.append(result)

    passed = sum(
        result["passed"]
        for result in results
    )

    failed = len(results) - passed

    print("\n" + "=" * 65)
    print("EVALUATION SUMMARY")
    print("=" * 65)

    print(f"Total tests: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")

    if results:
        print(
            f"Pass rate: {passed / len(results) * 100:.2f}%"
        )

    print("\nDetailed results:")

    for result in results:
        status = "PASS" if result["passed"] else "FAIL"

        print(
            f"[{status}] {result['name']}"
        )

    # Save evaluation results.
    with open(
        "rag_evaluation_results.json",
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            results,
            file,
            indent=4,
        )

    print("\nResults saved to rag_evaluation_results.json")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()