import { useEffect, useMemo, useRef, useState } from "react";
import {
  askPortfolioCopilot,
  clearPortfolioCopilotSession,
  fetchPortfolioCopilotSession,
} from "../api/deals";
import { formatDateTime } from "../utils/dealMaster";
import CopilotSources from "./CopilotSources";

const QUICK_PROMPTS = [
  "Which accessible deals need review attention first?",
  "Summarise uploaded document coverage across my deals.",
  "What FP&A fields are most ready from extracted evidence?",
  "Which deals still have missing Deal Master data?",
];

function emptySession(currentUser) {
  return {
    id: "__all-deals__::" + String(currentUser?.id || "user"),
    dealId: "__all-deals__",
    userId: currentUser?.id || "",
    userName: currentUser?.name || "",
    updatedAt: "",
    messageCount: 0,
    messages: [],
  };
}

function CountPill({ label, value }) {
  return (
    <span className="floating-copilot-count-pill">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function SuggestedFieldList({ rows }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <div className="floating-copilot-suggestion-list">
      {rows.map((row, index) => (
        <article key={(row?.targetPath || row?.fieldKey || "field") + "-" + index} className="floating-copilot-suggestion-card">
          <div>
            <span>{row?.section || row?.tower || "Portal field"}</span>
            <strong>{row?.fieldLabel || row?.fieldKey || row?.targetPath || "Field"}</strong>
          </div>
          <b>{row?.proposedValue || "No proposed value"}</b>
        </article>
      ))}
    </div>
  );
}

export default function PortalCopilotWidget({ currentUser, deals = [], isBusy = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState(() => emptySession(currentUser));
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const messageListRef = useRef(null);
  const composerRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isSessionLoading && !isLoading) composerRef.current?.focus({ preventScroll: true });
  }, [isOpen, isSessionLoading, isLoading]);

  useEffect(() => {
    setSession(emptySession(currentUser));
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    if (!isOpen || !currentUser?.id) {
      return undefined;
    }

    let isCancelled = false;

    async function loadSession() {
      setIsSessionLoading(true);
      setStatusText("Loading conversation…");
      try {
        const response = await fetchPortfolioCopilotSession(currentUser.id);
        if (!isCancelled) {
          setSession(response?.session || emptySession(currentUser));
          setErrorText("");
          setStatusText("");
          setIsSessionLoading(false);
        }
      } catch (error) {
        if (!isCancelled) {
          setSession(emptySession(currentUser));
          setErrorText(error.message || "Unable to load the portfolio copilot session.");
          setStatusText("");
          setIsSessionLoading(false);
        }
      }
    }

    void loadSession();
    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id, isOpen]);

  useEffect(() => {
    if (!isOpen || !messageListRef.current) {
      return;
    }
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [isOpen, session?.messageCount, pendingQuestion]);

  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const canRun = Boolean(currentUser?.id && !isBusy && !isLoading && !isSessionLoading);
  const visibleDealCount = Array.isArray(deals) ? deals.length : 0;
  const documentCount = useMemo(
    () =>
      (Array.isArray(deals) ? deals : []).reduce((total, deal) => {
        const documents = Array.isArray(deal?.documentIntake?.documents) ? deal.documentIntake.documents.length : 0;
        return total + documents;
      }, 0),
    [deals],
  );
  const reviewFieldCount = useMemo(
    () =>
      (Array.isArray(deals) ? deals : []).reduce((total, deal) => {
        const fields = Array.isArray(deal?.documentIntake?.logicBuilder?.reviewQueue?.fields)
          ? deal.documentIntake.logicBuilder.reviewQueue.fields.length
          : 0;
        return total + fields;
      }, 0),
    [deals],
  );

  async function submitQuestion(rawQuestion) {
    const nextQuestion = String(rawQuestion || question).trim();
    if (!nextQuestion || !canRun) {
      return;
    }

    setIsLoading(true);
    setErrorText("");
    setPendingQuestion(nextQuestion);
    setStatusText("Reading your accessible deals…");
    try {
      const response = await askPortfolioCopilot(nextQuestion, currentUser.id);
      setSession(response?.session || emptySession(currentUser));
      setQuestion("");
      setStatusText((response?.reply?.retrievalWarnings || []).join(" "));
    } catch (error) {
      setErrorText(error.message || "Portal copilot could not answer right now.");
      setStatusText("");
    } finally {
      setIsLoading(false);
      setPendingQuestion("");
    }
  }

  async function handleReset() {
    if (!currentUser?.id || isLoading || isBusy) {
      return;
    }

    setIsLoading(true);
    setErrorText("");
    setStatusText("Resetting portfolio chat...");
    try {
      const response = await clearPortfolioCopilotSession(currentUser.id);
      setSession(response?.session || emptySession(currentUser));
      setStatusText("Chat reset.");
    } catch (error) {
      setErrorText(error.message || "Unable to reset the portfolio copilot session.");
      setStatusText("");
    } finally {
      setIsLoading(false);
      setPendingQuestion("");
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  return (
    <div className={"floating-copilot-shell" + (isOpen ? " is-open" : "")}>
      {isOpen ? (
        <section id="portfolio-copilot-dialog" className="floating-copilot-panel" role="dialog" aria-labelledby="portfolio-copilot-title">
          <header className="floating-copilot-panel-head">
            <div>
              <span className="floating-copilot-kicker">All Deals assistant</span>
              <h3 id="portfolio-copilot-title">Portal Copilot</h3>
              <p>Answers from the deals you can access.</p>
            </div>
            <div className="floating-copilot-panel-actions">
              <button type="button" className="floating-copilot-ghost-button" onClick={() => void handleReset()} disabled={!messages.length || !canRun}>
                Reset
              </button>
              <button type="button" className="floating-copilot-close-button" onClick={() => { setIsOpen(false); requestAnimationFrame(() => launcherRef.current?.focus()); }} aria-label="Close portal copilot">
                ×
              </button>
            </div>
          </header>

          <div className="floating-copilot-count-row">
            <CountPill label="deals" value={String(visibleDealCount)} />
            <CountPill label="uploads" value={String(documentCount)} />
            <CountPill label="review fields" value={String(reviewFieldCount)} />
          </div>



          <div ref={messageListRef} className="floating-copilot-message-list" role="log" aria-label="Portfolio conversation" aria-live="polite">
            {!messages.length && !pendingQuestion ? (
              <div className="floating-copilot-empty-state">
                <strong>Ask anything about your portal deals</strong>
                <p>
                  Try review readiness, missing fields, extracted evidence, company context, or which deals need finance attention next.
                </p>
              </div>
            ) : null}

            {!messages.length && !pendingQuestion ? (
          <div className="floating-copilot-quick-row">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="floating-copilot-quick-button"
                onClick={() => void submitQuestion(prompt)}
                disabled={!canRun}
              >
                {prompt}
              </button>
            ))}
          </div>
            ) : null}

            {messages.map((message) => (
              <article key={message.id} className={"floating-copilot-message floating-copilot-message-" + (message.role || "assistant")}>
                <div className="floating-copilot-message-meta">
                  <strong>{message.role === "user" ? currentUser?.name || "You" : "Portal Copilot"}</strong>
                  <span>{message.createdAt ? formatDateTime(message.createdAt) : "Now"}</span>
                </div>
                <div className="floating-copilot-message-body">
                  <p>{message.content || ""}</p>
                  {message.role === "assistant" && message.confidence ? (
                    <small>Confidence: {message.confidence}</small>
                  ) : null}
                </div>
                {message.role === "assistant" ? <CopilotSources rows={message.sourceRefs} /> : null}
                {message.role === "assistant" ? <SuggestedFieldList rows={message.suggestedFields} /> : null}
              </article>
            ))}
            {pendingQuestion ? <>
              <article className="floating-copilot-message floating-copilot-message-user"><div className="floating-copilot-message-meta"><strong>You</strong></div><div className="floating-copilot-message-body"><p>{pendingQuestion}</p></div></article>
              <div className="copilot-thinking" role="status"><span aria-hidden="true">● ● ●</span> Reviewing your deals…</div>
            </> : null}
          </div>

          <div className="floating-copilot-composer">
            <label className="copilot-visually-hidden" htmlFor="portfolio-copilot-question">Ask about your deals</label>
            <textarea
              id="portfolio-copilot-question"
              ref={composerRef}
              rows="2"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask about your deals…"
              disabled={!canRun}
            />
            <div className="floating-copilot-composer-foot">
              <div className="floating-copilot-status-copy" role={errorText ? "alert" : "status"}>
                {!errorText && !statusText ? <span className="copilot-keyboard-hint">Enter to send · Shift + Enter for a new line</span> : null}
                {errorText ? <span className="floating-copilot-error">{errorText}</span> : null}
                {!errorText && statusText ? <span>{statusText}</span> : null}
              </div>
              <button type="button" className="btn btn-primary" onClick={() => void submitQuestion()} disabled={!String(question || "").trim() || !canRun}>
                {isLoading ? "Working…" : "Send"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <button type="button" ref={launcherRef} aria-controls="portfolio-copilot-dialog" className="floating-copilot-launcher" onClick={() => setIsOpen((previous) => !previous)} aria-expanded={isOpen}>
        <span className="floating-copilot-launcher-mark">AI</span>
        <span className="floating-copilot-launcher-copy">
          <strong>Portal Copilot</strong>
          <small>Ask about all deals</small>
        </span>
        {messages.length ? <span className="floating-copilot-launcher-badge">{messages.length}</span> : null}
      </button>
    </div>
  );
}

