import "./App.css";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  FileText,
  Upload,
  Plus,
  Send,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  BookOpen,
  LoaderCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trash2,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000/api/v1";

const ACCEPTED_FILES = ".pdf,.txt,.docx";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [sources, setSources] = useState([]);
  const [activeSource, setActiveSource] = useState(null);

  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [deletingSourceId, setDeletingSourceId] = useState(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showTextModal, setShowTextModal] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [sourceText, setSourceText] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);

  function resetMessages() {
    setError("");
    setNotice("");
  }
  async function loadSources() {
  setSourcesLoading(true);

  try {
    const response = await fetch(`${API_BASE}/sources`);
    const data = await parseResponse(response);

    const loadedSources = Array.isArray(data.sources)
      ? data.sources
      : [];

    setSources(loadedSources);

    // Restore the selected source if it still exists.
    setActiveSource((previous) => {
      if (!previous) {
        return null;
      }

      return (
        loadedSources.find(
          (source) =>
            source.source_id === previous.source_id
        ) || null
      );
    });
  } catch (err) {
    setError(
      err.message || "Unable to load your saved sources."
    );
  } finally {
    setSourcesLoading(false);
  }
}

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Unexpected server response (${response.status}). Check the FastAPI server.`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail || data);

      throw new Error(detail || `Request failed: ${response.status}`);
    }

    return data;
  }
  useEffect(() => {
  loadSources();
}, []);

  function registerSource(data, fallbackName) {
    const sourceId = data.source_id;

    if (!sourceId) {
      throw new Error(
        "The backend did not return a source_id. Check your ingestion response."
      );
    }

    const source = {
      source_id: sourceId,
      source_name: data.source_name || fallbackName,
      chunks_created: data.chunks_created ?? null,
    };

    setSources((previous) => {
      const filtered = previous.filter(
        (item) => item.source_id !== sourceId
      );

      return [source, ...filtered];
    });

    setActiveSource(source);
    setAnswer(null);
    setQuestion("");

    return source;
  }

  async function handleFileUpload() {
    resetMessages();

    if (!selectedFile) {
      setError("Choose a document before uploading.");
      return;
    }

    const extension = selectedFile.name
      .split(".")
      .pop()
      .toLowerCase();

    if (!["pdf", "txt", "docx"].includes(extension)) {
      setError("Supported formats: PDF, TXT and DOCX.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      // This assumes the FastAPI upload parameter is named "file".
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_BASE}/sources/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await parseResponse(response);

      const source = registerSource(data, selectedFile.name);

      setNotice(
        `Document uploaded successfully: ${source.source_name}`
      );

      setSelectedFile(null);

      const fileInput = document.getElementById("document-upload");

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      setError(err.message || "Document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleTextIngestion(event) {
    event.preventDefault();
    resetMessages();

    if (!sourceName.trim()) {
      setError("Please provide a source name.");
      return;
    }

    if (!sourceText.trim()) {
      setError("Please enter some text.");
      return;
    }

    setUploading(true);

    try {
      const response = await fetch(
        `${API_BASE}/sources/text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source_name: sourceName.trim(),
            text: sourceText,
          }),
        }
      );

      const data = await parseResponse(response);

      const source = registerSource(data, sourceName.trim());

      setNotice(`Text added successfully: ${source.source_name}`);

      setSourceName("");
      setSourceText("");
      setShowTextModal(false);
    } catch (err) {
      setError(err.message || "Text ingestion failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk() {
  const submittedQuestion = question.trim();

  if (!submittedQuestion || !activeSource) {
    return;
  }

  // Clear the input immediately.
  setQuestion("");

  setError("");
  setNotice("");

  try {
    const response = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_id: activeSource.source_id,
        question: submittedQuestion,
      }),
    });

    const data = await parseResponse(response);

    setAnswer(data);
  } catch (err) {
    setError(
      err.message || "Unable to generate an answer."
    );
  }
}

  function handleNewChat() {
    setAnswer(null);
    setQuestion("");
    resetMessages();
  }

  function handleSelectSource(source) {
    setActiveSource(source);
    setAnswer(null);
    setQuestion("");
    resetMessages();
  }
  async function handleDeleteSource(source) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${source.source_name}"?\n\nThis will remove the source and its indexed chunks.`
  );

  if (!confirmed) {
    return;
  }

  resetMessages();
  setDeletingSourceId(source.source_id);

  try {
    const response = await fetch(
      `${API_BASE}/sources/${encodeURIComponent(
        source.source_id
      )}`,
      {
        method: "DELETE",
      }
    );

    const data = await parseResponse(response);

    // Remove the deleted source from the UI.
    setSources((previous) =>
      previous.filter(
        (item) =>
          item.source_id !== source.source_id
      )
    );

    // Clear selected source and previous answer if needed.
    setActiveSource((previous) =>
      previous?.source_id === source.source_id
        ? null
        : previous
    );

    if (
      activeSource?.source_id === source.source_id
    ) {
      setAnswer(null);
      setQuestion("");
    }

    setNotice(
      `${data.source_name || source.source_name} deleted successfully.`
    );
  } catch (err) {
    setError(
      err.message || "Unable to delete this source."
    );
  } finally {
    setDeletingSourceId(null);
  }
}

  const evidenceStatus = answer?.evidence_status;

  const statusConfig = {
    supported: {
      label: "Supported",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    retrieved: {
      label: "Retrieved",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    insufficient: {
      label: "Insufficient evidence",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    conflicting: {
      label: "Conflicting evidence",
      className: "bg-red-50 text-red-700 border-red-200",
    },
  };

  const currentStatus = statusConfig[evidenceStatus] || {
    label: evidenceStatus || "Unknown",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };

  return (
    <div className="contextlens-app flex h-screen overflow-hidden bg-[#fafafa] text-zinc-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-[270px]" : "w-0"
        } flex shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white transition-all duration-200`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-zinc-100 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <BrainCircuit size={23} />
          </div>

          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-[15px] font-bold tracking-tight">
              ContextLens AI
            </h1>
            <p className="text-xs text-zinc-500">
              Research with evidence
            </p>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <Plus size={17} />
            New conversation
          </button>
        </div>

        <div className="px-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Your sources
            </p>

            <button
              onClick={() => setShowTextModal(true)}
              title="Add text source"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="space-y-2">
            {sourcesLoading ? (
              <div className="flex items-center gap-2 px-2 py-4 text-sm text-zinc-400">
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Loading sources...
              </div>
            ) : sources.length === 0 ? (
              <p className="rounded-lg px-2 py-3 text-sm text-zinc-400">
                No saved sources yet. Add a document or text to get started.
              </p>
            ) : (
              sources.map((source) => {
                const isActive =
                  activeSource?.source_id === source.source_id;

                const isDeleting =
                  deletingSourceId === source.source_id;

                return (
                  <div
                    key={source.source_id}
                    className={`group flex items-center gap-1 rounded-xl transition ${
                      isActive
                        ? "bg-zinc-100"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    {/* Source selection */}
                    <button
                      type="button"
                      onClick={() => handleSelectSource(source)}
                      disabled={Boolean(deletingSourceId)}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? "text-zinc-950"
                          : "text-zinc-600"
                      }`}
                    >
                      <FileText
                        size={18}
                        className="shrink-0 text-zinc-500"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {source.source_name}
                        </span>

                        <span className="text-xs text-zinc-400">
                          {source.source_type || "Source"}
                          {" · "}
                          {source.chunks_created ?? 0} chunks
                        </span>
                      </span>
                    </button>

                    {/* Delete source */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSource(source)}
                      disabled={Boolean(deletingSourceId)}
                      title={`Delete ${source.source_name}`}
                      aria-label={`Delete ${source.source_name}`}
                      className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isDeleting ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-auto border-t border-zinc-100 p-4">
          <div className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <p className="text-xs font-semibold text-zinc-800">
                Evidence-first AI
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Answers are generated using retrieved content.
                Always verify important claims against the sources.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main application */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose size={19} />
              ) : (
                <PanelLeftOpen size={19} />
              )}
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {activeSource
                  ? activeSource.source_name
                  : "New conversation"}
              </p>
              <p className="text-xs text-zinc-400">
                {activeSource
                  ? "Ask questions about this source"
                  : "Upload content to get started"}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-zinc-600">
              ContextLens workspace
            </span>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
            {!answer && !loading && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-200">
                    <Sparkles size={27} />
                  </div>

                  <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Understand your content.
                  </h2>

                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base">
                    Upload a document, add text, and ask questions.
                    Get concise answers grounded in your material.
                  </p>
                </div>

                {/* Upload card */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                      <Upload size={20} />
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        Add a source
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Upload a document or provide text.
                      </p>
                    </div>
                  </div>

                  <label
                    htmlFor="document-upload"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center transition hover:border-zinc-400 hover:bg-zinc-100"
                  >
                    <FileText
                      size={27}
                      className="mb-3 text-zinc-500"
                    />

                    <span className="text-sm font-medium">
                      {selectedFile
                        ? selectedFile.name
                        : "Choose a document"}
                    </span>

                    <span className="mt-1 text-xs text-zinc-400">
                      PDF, TXT or DOCX
                    </span>

                    <input
                      id="document-upload"
                      type="file"
                      accept={ACCEPTED_FILES}
                      className="hidden"
                      onChange={(event) =>
                        setSelectedFile(
                          event.target.files?.[0] || null
                        )
                      }
                    />
                  </label>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || uploading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading ? (
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Upload size={17} />
                      )}

                      {uploading ? "Processing..." : "Upload document"}
                    </button>

                    <button
                      onClick={() => {
                        resetMessages();
                        setShowTextModal(true);
                      }}
                      disabled={uploading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      <Plus size={17} />
                      Add text instead
                    </button>
                  </div>

                  <div className="mt-5 flex items-start gap-2 border-t border-zinc-100 pt-4">
                    <ShieldCheck
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />

                    <p className="text-xs leading-relaxed text-zinc-500">
                      Your questions are answered using retrieved
                      source content. Avoid uploading sensitive
                      information unless your setup is approved for it.
                    </p>
                  </div>
                </div>

                {/* Example prompts */}
                <div className="mt-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    What you can ask
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "What are the main findings?",
                      "What evidence supports the conclusion?",
                      "Which limitations are mentioned?",
                      "What information is missing?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setQuestion(prompt)}
                        className="rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
                      >
                        <MessageSquareText
                          size={16}
                          className="mb-2 text-zinc-400"
                        />
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex min-h-[300px] flex-col items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <LoaderCircle
                    size={27}
                    className="animate-spin"
                  />
                </div>

                <h3 className="mt-5 font-semibold">
                  Analyzing your question
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  Retrieving evidence and generating your answer...
                </p>
              </div>
            )}

            {/* Answer */}
            {answer && !loading && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-8">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Your question
                  </p>

                  <h2 className="text-2xl font-semibold tracking-tight">
                    {answer.question}
                  </h2>
                </div>

                {/* Objective */}
                <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Objective
                  </p>

                  <p className="text-sm leading-6 text-zinc-700">
                    {answer.objective}
                  </p>
                </section>

                {/* Short answer */}
                <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      Short answer
                    </h3>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${currentStatus.className}`}
                    >
                      {currentStatus.label}
                    </span>
                  </div>

                  {answer.short_answer?.length > 0 ? (
                    <ul className="space-y-3">
                      {answer.short_answer.map((item, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm leading-6 text-zinc-700"
                        >
                          <CheckCircle2
                            size={17}
                            className="mt-1 shrink-0 text-zinc-400"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No short answer was returned.
                    </p>
                  )}
                </section>

                {/* Long answer */}
                <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <BookOpen size={18} className="text-zinc-500" />
                    <h3 className="font-semibold">
                      Detailed answer
                    </h3>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                    {answer.long_answer}
                  </p>
                </section>

                {/* Sources */}
                <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        Retrieved evidence
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Review the passages used during retrieval.
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {answer.sources?.length || 0} sources
                    </span>
                  </div>

                  {answer.sources?.length > 0 ? (
                    <div className="space-y-3">
                      {answer.sources.map((source, index) => (
                        <details
                          key={`${source.reference}-${index}`}
                          className="group rounded-xl border border-zinc-200"
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                                <FileText
                                  size={17}
                                  className="text-zinc-600"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  [{source.reference}]
                                </p>
                                <p className="truncate text-xs text-zinc-500">
                                  {source.source_name}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs text-zinc-400">
                              Distance:{" "}
                              {typeof source.distance === "number"
                                ? source.distance.toFixed(3)
                                : "N/A"}
                            </span>
                          </summary>

                          <div className="border-t border-zinc-100 bg-zinc-50 p-4">
                            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                              {source.text}
                            </p>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-zinc-50 p-5 text-center">
                      <AlertCircle
                        size={22}
                        className="mx-auto mb-2 text-amber-500"
                      />
                      <p className="text-sm font-medium text-zinc-700">
                        No evidence sources were returned.
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        The available evidence may be insufficient.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Error and success messages */}
            {error && (
              <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0"
                  />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {notice && (
              <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0"
                  />
                  <span>{notice}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question input */}
        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {activeSource && (
              <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                <FileText size={14} />
                <span>Asking about:</span>
                <span className="max-w-[260px] truncate font-medium text-zinc-700">
                  {activeSource.source_name}
                </span>
              </div>
            )}

            <form
              onSubmit={handleAsk}
              className="flex items-end gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 transition focus-within:border-zinc-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-zinc-100"
            >
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder={
                  activeSource
                    ? "Ask a question about your source..."
                    : "Add a source to start asking questions..."
                }
                rows={1}
                maxLength={5000}
                className="max-h-32 min-h-11 flex-1 resize-y bg-transparent px-3 py-3 text-sm outline-none placeholder:text-zinc-400"
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !activeSource ||
                  !question.trim()
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                title="Send question"
              >
                {loading ? (
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-zinc-400">
              AI-generated responses can contain errors. Verify
              important information against the source.
            </p>
          </div>
        </div>
      </main>

      {/* Text ingestion modal */}
      {showTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Add text source
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add notes, an article excerpt or other text.
                </p>
              </div>

              <button
                onClick={() => setShowTextModal(false)}
                disabled={uploading}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                title="Close"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleTextIngestion}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="source-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Source name
                </label>

                <input
                  id="source-name"
                  value={sourceName}
                  onChange={(event) =>
                    setSourceName(event.target.value)
                  }
                  placeholder="e.g. Research notes"
                  maxLength={200}
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="source-text"
                  className="mb-2 block text-sm font-medium"
                >
                  Content
                </label>

                <textarea
                  id="source-text"
                  value={sourceText}
                  onChange={(event) =>
                    setSourceText(event.target.value)
                  }
                  placeholder="Paste your content here..."
                  rows={9}
                  maxLength={500000}
                  required
                  className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-zinc-400 focus:bg-white"
                />

                <p className="mt-1 text-right text-xs text-zinc-400">
                  {sourceText.length.toLocaleString()} / 500,000
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {uploading ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={17} />
                )}

                {uploading ? "Processing..." : "Add source"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

