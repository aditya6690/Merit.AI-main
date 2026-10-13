import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Api } from "../../lib/api.js";
import { getToken } from "../../lib/auth.js";
import CodeEditor from "../../components/CodeEditor.jsx";


export default function ExaminerInterviewWorkspace() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  const [liveCode, setLiveCode] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [lastUpdate, setLastUpdate] = useState(null);

  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);


  const [actionLoading, setActionLoading] = useState(false);

  const [observationCategory, setObservationCategory] = useState("problem_solving");
  const [observationNote, setObservationNote] = useState("");
  const [observationLoading, setObservationLoading] = useState(false);

  const [evaluation, setEvaluation] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState({
    problem_solving_score: "",
    technical_knowledge_score: "",
    code_quality_score: "",
    communication_score: "",
    debugging_score: "",
    strengths: "",
    weaknesses: "",
    overall_feedback: "",
    recommendation: "",
  });
  const [evaluationLoading, setEvaluationLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // Load interview and assigned questions
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function loadInterview() {
      setLoading(true);
      setError("");

      try {
        const [interviewData, questionData] = await Promise.all([
          Api.get(`/interviews/${interviewId}`),
          Api.get(`/interviews/${interviewId}/questions`),
        ]);

        if (!mounted) return;

        setInterview(interviewData);
        setQuestions(questionData || []);

        if (questionData?.length) {
          setSelectedQuestionId(questionData[0].question_id);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load interview.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInterview();

    return () => {
      mounted = false;
    };
  }, [interviewId]);

  // ---------------------------------------------------------
  // Load code snapshot history
  // ---------------------------------------------------------
  useEffect(() => {
    if (!interviewId) return;
  
    async function loadSnapshots() {
      setSnapshotsLoading(true);
    
      try {
        const snapshotData = await Api.get(
          `/interviews/${interviewId}/code-snapshots`
        );
      
        setSnapshots(snapshotData || []);
      
        if (snapshotData?.length) {
          setSelectedSnapshotId(snapshotData[snapshotData.length - 1].id);
        }
      } catch (err) {
        console.error("Unable to load code snapshots:", err);
      } finally {
        setSnapshotsLoading(false);
      }
    }
  
    loadSnapshots();
  }, [interviewId]);

  // ---------------------------------------------------------
  // Selected question
  // ---------------------------------------------------------
  const selectedQuestion = useMemo(
    () =>
      questions.find(
        (question) => question.question_id === selectedQuestionId
      ),
    [questions, selectedQuestionId]
  );

  const selectedSnapshot = useMemo(
    () =>
      snapshots.find(
        (snapshot) => snapshot.id === selectedSnapshotId
      ),
    [snapshots, selectedSnapshotId]
  );

  // ---------------------------------------------------------
  // WebSocket - receive candidate live code
  // ---------------------------------------------------------
  useEffect(() => {
    if (!interviewId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = getToken();

    const socketUrl =
      `${protocol}//${window.location.host}/ws/interviews/${interviewId}` +
      `?token=${encodeURIComponent(token || "")}`;

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setConnectionStatus("Connected");
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Redis/WebSocket wrapper
        if (
          payload.type === "interview_event" &&
          payload.data?.type === "code_update"
        ) {
          const codeUpdate = payload.data;

          if (
            selectedQuestionId === null ||
            codeUpdate.question_id === selectedQuestionId
          ) {
            setLiveCode(codeUpdate.code || "");
            setLastUpdate(new Date());
          }
        }

        // Code run result from candidate
        if (
          payload.type === "interview_event" &&
          payload.data?.type === "code_run_result"
        ) {
          const runResultEvent = payload.data;
        
          if (
            selectedQuestionId === null ||
            runResultEvent.question_id === selectedQuestionId
          ) {
            setRunResult(runResultEvent.result);
            setLastUpdate(new Date());
          }
        }
      } catch (err) {
        console.error("Unable to process WebSocket message:", err);
      }
    };

    socket.onerror = () => {
      setConnectionStatus("Error");
    };

    socket.onclose = () => {
      setConnectionStatus("Disconnected");
    };

    return () => {
      socket.close();
    };
  }, [interviewId, selectedQuestionId]);
  
  // ---------------------------------------------------------
  // Interview controls
  // ---------------------------------------------------------
  async function handleInterviewAction(action) {
    setActionLoading(true);
    setError("");

    try {
      const updatedInterview = await Api.post(
        `/interviews/${interviewId}/${action}`
      );

      setInterview((current) => ({
        ...current,
        ...updatedInterview,
      }));
    } catch (err) {
      setError(err.message || `Unable to ${action} interview.`);
    } finally {
      setActionLoading(false);
    }
  }


  // ---------------------------------------------------------
  // Examiner Observation
  // ---------------------------------------------------------
  async function handleAddObservation() {
    if (!observationNote.trim()) {
      setError("Please enter an observation note.");
      return;
    }

    setObservationLoading(true);
    setError("");

    try {
      const observation = await Api.post(
       `/interviews/${interviewId}/observations`,
        {
          category: observationCategory,
          note: observationNote.trim(),
        }
      );

      setInterview((current) => ({
        ...current,
        observations: [
          ...(current?.observations || []),
          observation,
        ],
      }));

      setObservationNote("");
    } catch (err) {
      setError(err.message || "Unable to add observation.");
    } finally {
      setObservationLoading(false);
    }
  }

  // ---------------------------------------------------------
  // Structured Evaluation
  // ---------------------------------------------------------
  async function handleSubmitEvaluation() {
    setEvaluationLoading(true);
    setError("");
  
    try {
      const payload = {
        problem_solving_score:
          evaluationForm.problem_solving_score === ""
            ? null
            : Number(evaluationForm.problem_solving_score),
      
        technical_knowledge_score:
          evaluationForm.technical_knowledge_score === ""
            ? null
            : Number(evaluationForm.technical_knowledge_score),
      
        code_quality_score:
          evaluationForm.code_quality_score === ""
            ? null
            : Number(evaluationForm.code_quality_score),
      
        communication_score:
          evaluationForm.communication_score === ""
            ? null
            : Number(evaluationForm.communication_score),
      
        debugging_score:
          evaluationForm.debugging_score === ""
            ? null
            : Number(evaluationForm.debugging_score),
      
        strengths: evaluationForm.strengths.trim() || null,
        weaknesses: evaluationForm.weaknesses.trim() || null,
        overall_feedback:
          evaluationForm.overall_feedback.trim() || null,
      
        recommendation:
          evaluationForm.recommendation || null,
      };
    
      const result = await Api.post(
        `/interviews/${interviewId}/evaluation`,
        payload
      );
    
      setEvaluation(result);
    
      setInterview((current) => ({
        ...current,
        status: "evaluated",
      }));
    } catch (err) {
      setError(err.message || "Unable to submit evaluation.");
    } finally {
      setEvaluationLoading(false);
    }
  }


  // ---------------------------------------------------------
  // Loading
  // ---------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-page text-ink flex items-center justify-center">
        <div className="text-lg">Loading interview...</div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // Error
  // ---------------------------------------------------------
  if (error) {
    return (
      <div className="min-h-screen bg-page text-ink p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-6">
            <h2 className="text-xl font-semibold mb-2">
              Unable to load interview
            </h2>

            <p className="text-sm opacity-80">{error}</p>

            <button
              onClick={() => navigate("/examiner/interviews")}
              className="mt-4 rounded-lg border border-border px-4 py-2 hover:bg-surface"
            >
              Back to Interviews
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // Main workspace
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen bg-page text-ink">
      {/* Header */}
      <div className="border-b border-border bg-surface/40">
        <div className="max-w-[1600px] mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {interview?.title || "Interview"}
              </h1>

              <span className="rounded-full bg-slate-400/30 px-3 py-1 text-xs font-semibold uppercase">
                {interview?.status || "UNKNOWN"}
              </span>
            </div>

            {interview?.description && (
              <p className="mt-1 text-sm opacity-75">
                {interview.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {interview?.status === "wating" && (
              <button
                onClick={() => handleInterviewAction("start")}
                disabled={actionLoading}
                className="rounded-lg bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                {actionLoading ? "Starting..." : "Start Interview"}
              </button>
            )}

            {interview?.status === "live" && (
              <>
                <button
                  onClick={() => handleInterviewAction("pause")}
                  disabled={actionLoading}
                  className="rounded-lg border border-yellow-400/50 px-4 py-2 hover:bg-yellow-400/10 disabled:opacity-50"
                >
                  Pause
                </button>

                <button
                  onClick={() => handleInterviewAction("complete")}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Complete
                </button>
              </>
            )}

            {interview?.status === "paused" && (
              <>
                <button
                  onClick={() => handleInterviewAction("resume")}
                  disabled={actionLoading}
                  className="rounded-lg bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {actionLoading ? "Resuming..." : "Resume"}
                </button>

                <button
                  onClick={() => handleInterviewAction("complete")}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Complete
                </button>
              </>
            )}

            <button
              onClick={() => navigate("/examiner/interviews")}
              className="rounded-lg border border-border px-4 py-2 hover:bg-surface"
            >
              Back to Interviews
            </button>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-5">

          {/* Left panel */}
          <aside className="col-span-12 lg:col-span-3 space-y-5">

            {/* Interview details */}
            <div className="rounded-xl border border-border bg-surface/20 p-5">
              <h2 className="text-lg font-semibold mb-5">
                Interview Details
              </h2>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="opacity-60">Candidate</div>
                  <div className="font-medium">
                    Student #{interview?.student_id}
                  </div>
                </div>

                <div>
                  <div className="opacity-60">Examiner</div>
                  <div className="font-medium">
                    Examiner #{interview?.examiner_id}
                  </div>
                </div>

                <div>
                  <div className="opacity-60">Questions</div>
                  <div className="font-medium">
                    {questions.length}
                  </div>
                </div>

                <div>
                  <div className="opacity-60">Scheduled</div>
                  <div className="font-medium">
                    {interview?.scheduled_at
                      ? new Date(
                          interview.scheduled_at
                        ).toLocaleString()
                      : "Not scheduled"}
                  </div>
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-border bg-surface/20 p-5">
              <h2 className="text-lg font-semibold mb-4">
                Questions
              </h2>

              <div className="space-y-2">
                {questions.map((question, index) => {
                  const selected =
                    question.question_id === selectedQuestionId;

                  return (
                    <button
                      key={question.id}
                      onClick={() =>
                        setSelectedQuestionId(question.question_id)
                      }
                      className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                        selected
                          ? "border-blue-400 bg-blue-500/10"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <div className="font-medium">
                        Question {index + 1}
                      </div>

                      <div className="text-xs opacity-60 mt-1">
                        Question ID: {question.question_id}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* WebSocket status */}
            <div className="rounded-xl border border-border bg-surface/20 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Live Connection
              </h2>

              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    connectionStatus === "Connected"
                      ? "bg-green-500"
                      : connectionStatus === "Connecting"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                />

                <span className="text-sm">
                  {connectionStatus}
                </span>
              </div>

              {lastUpdate && (
                <div className="mt-3 text-xs opacity-60">
                  Last code update:{" "}
                  {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </aside>

          {/* Center - live code */}
          <main className="col-span-12 lg:col-span-6">
            <div className="rounded-xl border border-border bg-surface/20 overflow-hidden">

              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Candidate Code
                  </h2>

                  <p className="text-xs opacity-60 mt-1">
                    Live view of the candidate's coding workspace
                  </p>
                </div>

                <span className="rounded-full border border-border px-3 py-1 text-xs">
                  Read Only
                </span>
              </div>

              <div className="p-4">
                {selectedQuestion ? (
                  <CodeEditor
                    value={liveCode}
                    language="python"
                    onChange={() => {}}
                  />
                ) : (
                  <div className="h-[500px] flex items-center justify-center opacity-60">
                    No coding question selected.
                  </div>
                )}
              </div>
            </div>
            
            {/* Latest Run Result */}
            {runResult && (
              <div className="rounded-xl border border-border bg-surface p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Latest Run Result</h2>

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      runResult.all_passed
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {runResult.all_passed ? "All Tests Passed" : "Tests Failed"}
                  </span>
                </div>
                    
                <div className="space-y-3">
                  {(runResult.results || []).map((test, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          Test Case {index + 1}
                        </span>
                  
                        <span
                          className={
                            test.passed
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {test.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                        
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-muted">Input:</span>{" "}
                          <code>{test.input}</code>
                        </div>
                        
                        <div>
                          <span className="text-muted">Expected:</span>{" "}
                          <code>{test.expected_output}</code>
                        </div>
                        
                        <div>
                          <span className="text-muted">Actual:</span>{" "}
                          <code>{test.actual_output}</code>
                        </div>
                        
                        {test.time_ms !== undefined && (
                          <div>
                            <span className="text-muted">Execution time:</span>{" "}
                            {test.time_ms} ms
                          </div>
                        )}

                        {test.error && (
                          <div className="text-red-400">
                            Error: {test.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}            

            {/* Code History */}
            <div className="mt-5 rounded-xl border border-border bg-surface/20 overflow-hidden">

              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Code History
                  </h2>

                  <p className="text-xs opacity-60 mt-1">
                    Previously saved versions of the candidate's code
                  </p>
                </div>

                <span className="rounded-full border border-border px-3 py-1 text-xs">
                  {snapshots.length} Snapshots
                </span>
              </div>

              <div className="p-4">
                {snapshotsLoading ? (
                  <div className="py-6 text-center text-sm opacity-60">
                    Loading code history...
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="py-6 text-center text-sm opacity-60">
                    No saved code snapshots yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {snapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() =>
                          setSelectedSnapshotId(snapshot.id)
                        }
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          selectedSnapshotId === snapshot.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Version {snapshot.version}
                          </span>

                          <span className="text-xs opacity-60">
                            {snapshot.reason}
                          </span>
                        </div>

                        <div className="mt-1 text-xs opacity-60">
                          {new Date(snapshot.created_at).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedSnapshot && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Version {selectedSnapshot.version} Code
                      </span>

                      <span className="text-xs opacity-60">
                        {selectedSnapshot.language}
                      </span>
                    </div>

                    <CodeEditor
                      value={selectedSnapshot.code}
                      language={selectedSnapshot.language}
                      onChange={() => {}}
                    />
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Right panel */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="rounded-xl border border-border bg-surface/20 p-5 h-full min-h-[600px]">
                        
              <div className="mb-5">
                <h2 className="text-lg font-semibold">
                  Interview Observations
                </h2>
                        
                <p className="text-xs opacity-60 mt-1">
                  Record your observations during the interview.
                </p>
              </div>
                        
              {/* Add observation */}
              <div className="space-y-4">
                        
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category
                  </label>
                        
                  <select
                    value={observationCategory}
                    onChange={(event) =>
                      setObservationCategory(event.target.value)
                    }
                    disabled={observationLoading}
                    className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none"
                  >
                    <option value="problem_solving">
                      Problem Solving
                    </option>
                  
                    <option value="technical">
                      Technical Skills
                    </option>
                  
                    <option value="code_quality">
                      Code Quality
                    </option>
                  
                    <option value="communication">
                      Communication
                    </option>
                  
                    <option value="debugging">
                      Debugging
                    </option>
                  </select>
                </div>
                  
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Observation
                  </label>
                  
                  <textarea
                    value={observationNote}
                    onChange={(event) =>
                      setObservationNote(event.target.value)
                    }
                    disabled={observationLoading}
                    rows={5}
                    maxLength={10000}
                    placeholder="Enter your observation about the candidate..."
                    className="w-full resize-none rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
          
                  <div className="mt-1 text-right text-xs opacity-50">
                    {observationNote.length}/10000
                  </div>
                </div>
                  
                <button
                  onClick={handleAddObservation}
                  disabled={
                    observationLoading ||
                    !observationNote.trim() ||
                    interview?.status === "completed" ||
                    interview?.status === "evaluated"
                  }
                  className="w-full rounded-lg bg-blue-500 px-4 py-2.5 font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {observationLoading
                    ? "Saving..."
                    : "Add Observation"}
                </button>
                  
              </div>
                  
              {/* Saved observations */}
              <div className="mt-8">
                  
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">
                    Saved Observations
                  </h3>
                  
                  <span className="text-xs opacity-60">
                    {interview?.observations?.length || 0}
                  </span>
                </div>
                  
                {interview?.observations?.length ? (
                  <div className="space-y-3">
                  
                    {interview.observations
                      .slice()
                      .reverse()
                      .map((observation) => (
                        <div
                          key={observation.id}
                          className="rounded-lg border border-border bg-page/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                      
                            <span className="rounded-full border border-border px-2 py-1 text-xs font-medium">
                              {observation.category
                                .replaceAll("_", " ")
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase()
                                )}
                            </span>
                              
                            <span className="text-[11px] opacity-50">
                              {new Date(
                                observation.created_at
                              ).toLocaleTimeString()}
                            </span>
                            
                          </div>
                            
                          <p className="mt-3 text-sm leading-5">
                            {observation.note}
                          </p>
                        </div>
                      ))}
          
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm opacity-60">
                    No observations added yet.
                  </div>
                )}

              </div>

              {/* Structured Evaluation */}
              <div className="mt-8 border-t border-border pt-6">

                <div className="mb-4">
                  <h3 className="font-semibold">
                    Structured Evaluation
                  </h3>
                  <p className="mt-1 text-xs opacity-60">
                    Score the candidate and provide final interview feedback.
                  </p>
                </div>

                <div className="space-y-4">

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-3">

                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        Problem Solving
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={evaluationForm.problem_solving_score}
                        onChange={(event) =>
                          setEvaluationForm((current) => ({
                            ...current,
                            problem_solving_score: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="0-10"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        Technical Knowledge
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={evaluationForm.technical_knowledge_score}
                        onChange={(event) =>
                          setEvaluationForm((current) => ({
                            ...current,
                            technical_knowledge_score: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="0-10"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        Code Quality
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={evaluationForm.code_quality_score}
                        onChange={(event) =>
                          setEvaluationForm((current) => ({
                            ...current,
                            code_quality_score: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="0-10"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        Communication
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={evaluationForm.communication_score}
                        onChange={(event) =>
                          setEvaluationForm((current) => ({
                            ...current,
                            communication_score: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="0-10"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium">
                        Debugging
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={evaluationForm.debugging_score}
                        onChange={(event) =>
                          setEvaluationForm((current) => ({
                            ...current,
                            debugging_score: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="0-10"
                      />
                    </div>

                  </div>


                  {/* Strengths */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Strengths
                    </label>
                    <textarea
                      rows={3}
                      value={evaluationForm.strengths}
                      onChange={(event) =>
                        setEvaluationForm((current) => ({
                          ...current,
                          strengths: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Candidate strengths..."
                    />
                  </div>


                  {/* Weaknesses */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Weaknesses
                    </label>
                    <textarea
                      rows={3}
                      value={evaluationForm.weaknesses}
                      onChange={(event) =>
                        setEvaluationForm((current) => ({
                          ...current,
                          weaknesses: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Areas for improvement..."
                    />
                  </div>


                  {/* Overall Feedback */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Overall Feedback
                    </label>
                    <textarea
                      rows={4}
                      value={evaluationForm.overall_feedback}
                      onChange={(event) =>
                        setEvaluationForm((current) => ({
                          ...current,
                          overall_feedback: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Overall interview feedback..."
                    />
                  </div>


                  {/* Recommendation */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Recommendation
                    </label>

                    <select
                      value={evaluationForm.recommendation}
                      onChange={(event) =>
                        setEvaluationForm((current) => ({
                          ...current,
                          recommendation: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Select recommendation</option>
                      <option value="strong_yes">Strong Yes</option>
                      <option value="yes">Yes</option>
                      <option value="mixed">Mixed</option>
                      <option value="no">No</option>
                      <option value="strong_no">Strong No</option>
                    </select>
                  </div>


                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleSubmitEvaluation}
                    disabled={
                      evaluationLoading ||
                      interview?.status === "evaluated"
                    }
                    className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {evaluationLoading
                      ? "Submitting..."
                      : interview?.status === "evaluated"
                        ? "Evaluation Submitted"
                        : "Submit Evaluation"}
                  </button>


                  {/* Existing evaluation result */}
                  {evaluation && (
                    <div className="rounded-lg border border-border bg-page/60 p-4">

                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          Evaluation Submitted
                        </span>

                        {evaluation.overall_score !== null &&
                          evaluation.overall_score !== undefined && (
                            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
                              Overall: {evaluation.overall_score}/10
                            </span>
                          )}
                      </div>

                    </div>
                  )}

                </div>

              </div>


            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}