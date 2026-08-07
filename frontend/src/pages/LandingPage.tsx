import { Link } from "react-router-dom";

const features = [
  {
    title: "Agent studio",
    body: "Spin up an assistant in seconds — give it a name, a role, and a knowledge base. No setup, no infra.",
  },
  {
    title: "Grounded answers",
    body: "Every reply is retrieved from your own documents and cites the exact source, so your team can trust it.",
  },
  {
    title: "Built-in guardrail",
    body: "A grounding check flags answers that aren't backed by your knowledge base — your first line against hallucination.",
  },
  {
    title: "One shared workspace",
    body: "Your whole team logs in, shares agents and knowledge, and sees every run. Admins manage members and roles.",
  },
  {
    title: "Conversations with memory",
    body: "Follow-up questions keep context, so chatting with an agent feels like talking to a teammate.",
  },
  {
    title: "Full observability",
    body: "Every run is traced — latency, tokens, provider, and the guardrail verdict — all in one place.",
  },
];

const steps = [
  { n: "1", title: "Create an agent", body: "Describe what it should do in one line." },
  { n: "2", title: "Add your knowledge", body: "Upload docs or paste text — it's chunked and indexed." },
  { n: "3", title: "Ask anything", body: "Get grounded, cited answers your team can rely on." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Mus<span className="text-muted">ter</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              state={{ register: true }}
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-line px-3 py-1 text-xs text-muted">
              Agent studio · RAG · guardrails
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              AI agents your whole team can actually trust.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Muster turns your company's documents into assistants that answer
              questions with real citations — and a guardrail that flags anything
              they can't back up.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                state={{ register: true }}
                className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white"
              >
                Get started — free
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-line px-5 py-2.5 text-sm font-medium hover:bg-soft"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">
              Self-hostable · works offline · no credit card.
            </p>
          </div>

          {/* Chat preview mock */}
          <div className="rounded-2xl border border-line bg-soft p-4 shadow-sm">
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-ink/20" />
                <span className="h-2 w-2 rounded-full bg-ink/20" />
                <span className="h-2 w-2 rounded-full bg-ink/20" />
                <span className="ml-2">HR Assistant</span>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-lg bg-ink px-3 py-2 text-sm text-white">
                  How many weeks of parental leave do I get?
                </div>
              </div>
              <div className="mt-3 max-w-[90%]">
                <div className="rounded-lg border border-line p-3 text-sm leading-relaxed">
                  You get 26 weeks of fully paid parental leave for the primary
                  caregiver <span className="text-muted">[chunk 2]</span>.
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <span className="rounded border border-ink bg-ink px-1.5 py-0.5 text-white">
                    grounded
                  </span>
                  <span className="text-muted">cited handbook.md · 480ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-line bg-soft">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything you need to run agents in production
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            The core primitives of an agent platform — without the enterprise
            price tag or the setup.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-paper p-5">
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Up and running in minutes</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-ink text-sm font-medium">
                {s.n}
              </div>
              <h3 className="mt-4 font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Give your team an assistant they can trust.
          </h2>
          <p className="max-w-md text-sm text-muted">
            Create your workspace in under a minute. The first account becomes the
            admin.
          </p>
          <Link
            to="/login"
            state={{ register: true }}
            className="mt-2 rounded-md bg-ink px-6 py-2.5 text-sm font-medium text-white"
          >
            Get started — free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted sm:flex-row">
          <span>
            Mus<span className="text-ink/60">ter</span> — the agent platform for small teams.
          </span>
          <span>Built with FastAPI + React. MIT licensed.</span>
        </div>
      </footer>
    </div>
  );
}
