import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Api } from "../../lib/api.js";

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

function statusClass(status) {
  switch (status) {
    case "LIVE":
      return "bg-green-500/15 text-green-600";
    case "WAITING":
      return "bg-yellow-500/15 text-yellow-600";
    case "PAUSED":
      return "bg-orange-500/15 text-orange-600";
    case "COMPLETED":
      return "bg-blue-500/15 text-blue-600";
    case "EVALUATED":
      return "bg-purple-500/15 text-purple-600";
    default:
      return "bg-muted text-ink";
  }
}

export default function InterviewListPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    student_id: "1",
    organization_id: "1",
    scheduled_at: "",
  });


  async function loadInterviews() {
    setLoading(true);
    setError("");

    try {
      const data = await Api.get("/interviews/examiner");
      setInterviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load interviews.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInterview(event) {
    event.preventDefault();

    setCreating(true);
    setError("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        student_id: Number(form.student_id),
        organization_id: form.organization_id
          ? Number(form.organization_id)
          : null,
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
      };

      await Api.post("/interviews", payload);

      setForm({
        title: "",
        description: "",
        student_id: "1",
        organization_id: "1",
        scheduled_at: "",
      });

      setShowCreateForm(false);
      await loadInterviews();
    } catch (err) {
      setError(err.message || "Unable to create interview.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadInterviews();
  }, []);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Coding Interviews</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and monitor your interactive coding interviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {showCreateForm ? "Cancel" : "+ New Interview"}
            </button>

            <button
              type="button"
              onClick={loadInterviews}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Refresh
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateInterview}
            className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold">
              Create Interactive Coding Interview
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a new interview for a candidate.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Interview Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={200}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Python Backend Interview"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Student ID *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.student_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      student_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Organization ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.organization_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organization_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Schedule
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduled_at: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-black"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Technical coding interview for backend development."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-black"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Interview"}
              </button>
            </div>
          </form>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && interviews.length === 0 && (
          <div className="rounded-xl border border-border p-8 text-center">
            <h2 className="text-lg font-medium">No interviews found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Interactive coding interviews assigned to you will appear here.
            </p>
          </div>
        )}

        {!loading && !error && interviews.length > 0 && (
          <div className="grid gap-4">
            {interviews.map((interview) => (
              <article
                key={interview.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold">
                        {interview.title}
                      </h2>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                          interview.status
                        )}`}
                      >
                        {interview.status}
                      </span>
                    </div>

                    {interview.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {interview.description}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">
                          Candidate
                        </span>
                        <div className="font-medium">
                          Student #{interview.student_id}
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Scheduled
                        </span>
                        <div className="font-medium">
                          {formatDate(interview.scheduled_at)}
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Created
                        </span>
                        <div className="font-medium">
                          {formatDate(interview.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/examiner/interviews/${interview.id}`)
                    }
                    className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Open Interview
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}