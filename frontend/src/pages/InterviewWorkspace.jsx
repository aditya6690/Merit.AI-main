import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor.jsx';
import DashboardHeader from '../components/DashboardHeader.jsx';
import { Api } from '../lib/api.js';
import { getToken } from "../lib/auth.js";

export default function InterviewWorkspace() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const socketRef = useRef(null);
  const suppressSocketUpdate = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInterview() {
      try {
        const [interviewData, questionData] = await Promise.all([
          Api.get(`/interviews/${interviewId}`),
          Api.get(`/interviews/${interviewId}/questions`),
        ]);

        if (cancelled) return;

        setInterview(interviewData);
        setQuestions(questionData || []);

        if (questionData?.length) {
          const firstQuestion = questionData[0];
          setSelectedQuestion(firstQuestion);

          setCode(
            firstQuestion.starter_code ||
            firstQuestion.question?.starter_code ||
            ''
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load interview.');
        }
      }
    }

    loadInterview();

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    const token = getToken();

    const socket = new WebSocket(
      `${protocol}//${host}/ws/interviews/${interviewId}?token=${encodeURIComponent(token || "")}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'interview_event') {
          const data = message.data;

          if (
            data?.type === 'code_update' &&
            data?.question_id === selectedQuestion?.question_id
          ) {
            suppressSocketUpdate.current = true;
            setCode(data.code || '');
          }
        }
      } catch {
        // Ignore malformed WebSocket messages.
      }
    };

    socket.onerror = () => {
      setConnectionStatus('error');
    };

    socket.onclose = () => {
      setConnectionStatus('disconnected');
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [interviewId, selectedQuestion?.question_id]);

  function handleCodeChange(nextCode) {
    setCode(nextCode);

    if (suppressSocketUpdate.current) {
      suppressSocketUpdate.current = false;
      return;
    }

    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'code_update',
          question_id: selectedQuestion?.question_id,
          code: nextCode,
        })
      );
    }
  }

  async function saveSnapshot() {
    try {
      await Api.post(`/interviews/${interviewId}/code-snapshots`, {
        question_id: selectedQuestion.question_id,
        language: "python",
        code,
        reason: "manual",
      });
    } catch (err) {
      setError(err.message || 'Unable to save code snapshot.');
    }
  }

  async function handleRunCode() {
  if (!selectedQuestion?.question_id) {
    setError('Please select a coding question.');
    return;
  }

  setIsRunning(true);
  setRunResult(null);
  setError('');

  try {
    const result = await Api.post(
      `/interviews/${interviewId}/run-code`,
      {
        question_id: selectedQuestion.question_id,
        source_code: code,
      }
    );

    setRunResult(result);
  } catch (err) {  
    setError(err.message || 'Unable to run code.');
  } finally {
    setIsRunning(false);
  }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-page text-ink">
        <DashboardHeader title="Coding Interview" />
        <main className="max-w-5xl mx-auto px-5 py-8">
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-danger">
            {error}
          </div>
        </main>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-page text-ink">
        <DashboardHeader title="Coding Interview" />
        <main className="max-w-5xl mx-auto px-5 py-8">
          <div className="rounded-2xl border border-border bg-surface p-6">
            Loading interview...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <DashboardHeader title="Interactive Coding Interview" />

      <main className="max-w-7xl mx-auto w-full px-5 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold">
              {interview.title}
            </h1>
            <p className="text-sm text-muted mt-1">
              Live coding interview
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold">
              WebSocket:
              {' '}
              <span
                className={
                  connectionStatus === 'connected'
                    ? 'text-success'
                    : connectionStatus === 'connecting'
                      ? 'text-warning'
                      : 'text-danger'
                }
              >
                {connectionStatus}
              </span>
            </span>

            <button
              type="button"
              onClick={saveSnapshot}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
            >
              Save Code
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          <aside className="rounded-2xl border border-border bg-surface shadow-card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Interview Questions
            </h2>

            <div className="flex flex-col gap-2">
              {questions.map((item, index) => {
                const questionId = item.question_id || item.id;
                const question = item.question || item;

                return (
                  <button
                    key={questionId}
                    type="button"
                    onClick={() => {
                      setSelectedQuestion(item);
                      setCode(question?.starter_code || '');
                    }}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      selectedQuestion &&
                      (selectedQuestion.question_id || selectedQuestion.id) === questionId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="text-xs text-muted mb-1">
                      Question {index + 1}
                    </div>
                    <div className="text-sm font-semibold">
                      {question?.title || question?.text || `Question ${index + 1}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedQuestion && (
              <div className="mt-5 pt-5 border-t border-border">
                <h3 className="font-bold mb-2">
                  {selectedQuestion.question?.title ||
                    selectedQuestion.title ||
                    'Coding Question'}
                </h3>

                <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                  {selectedQuestion.question?.description ||
                    selectedQuestion.description ||
                    'Solve the coding problem shown above.'}
                </p>
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-border bg-surface shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">Your Code</h2>
                <p className="text-xs text-muted">
                  Python
                </p>
              </div>
            </div>

            <CodeEditor
              value={code}
              language="python"
              onChange={handleCodeChange}
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning}
                className="px-4 py-2 rounded-lg bg-success text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? 'Running...' : 'Run Code'}
              </button> 
            </div>

            <div className="mt-4 rounded-xl border border-border bg-page p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">
                  Output
                </div>

                {runResult && (
                  <span
                    className={
                      runResult.all_passed
                        ? 'text-xs font-bold text-success'
                        : 'text-xs font-bold text-danger'
                    }
                  >
                    {runResult.all_passed ? 'All Tests Passed' : 'Some Tests Failed'}
                  </span>
                )}
              </div>

              {!runResult ? (
                <p className="text-sm text-muted">
                  Run your code to see the test results.
                </p>
              ) : (
                <div className="space-y-3">
                  {runResult.results?.map((result, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border bg-surface p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">
                          Test Case {index + 1}
                        </span>

                        <span
                          className={
                            result.passed
                              ? 'text-xs font-bold text-success'
                              : 'text-xs font-bold text-danger'
                          }
                        >
                          {result.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-muted mb-1">Input</div>
                          <pre className="rounded-md bg-page p-2 whitespace-pre-wrap">
                            {result.input || '(empty)'}
                          </pre>
                        </div>

                        <div>
                          <div className="text-muted mb-1">Expected Output</div>
                          <pre className="rounded-md bg-page p-2 whitespace-pre-wrap">
                            {result.expected_output || '(empty)'}
                          </pre>
                        </div>

                        <div>
                          <div className="text-muted mb-1">Actual Output</div>
                          <pre className="rounded-md bg-page p-2 whitespace-pre-wrap">
                            {result.actual_output || '(empty)'}
                          </pre>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted">
                        Execution time: {result.time_ms ?? '-'} ms
                      </div>

                      {result.error && (
                        <div className="mt-2 rounded-md bg-danger/5 border border-danger/20 p-2 text-xs text-danger whitespace-pre-wrap">
                          {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </section>
        </div>
      </main>
    </div>
  );
}