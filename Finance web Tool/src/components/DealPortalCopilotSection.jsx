import { useEffect, useRef, useState } from "react";
import { askDealCopilot, clearDealCopilotSession, fetchDealCopilotSession } from "../api/deals";
import { formatDateTime } from "../utils/dealMaster";
import DealKnowledgePanel from "./DealKnowledgePanel";
import CopilotSources from "./CopilotSources";

const QUICK_PROMPTS = [
  { label: "Summarise this deal", question: "Summarise the current saved deal and its document evidence." },
  { label: "Find missing information", question: "What information is still missing from this deal?" },
  { label: "Check finance values", question: "What are the saved finance FTE and cost baseline for this deal?" },
  { label: "Compare document evidence", question: "Do any document values conflict with the current saved deal values? Cite the sources." },
];

const emptySession = () => ({ messages: [], messageCount: 0 });

export default function DealPortalCopilotSection({ currentDeal, currentUser, isBusy = false, isPersisted = false }) {
  const [session, setSession] = useState(emptySession);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [documentCount, setDocumentCount] = useState(null);
  const messageListRef = useRef(null);
  const composerRef = useRef(null);
  const requestRef = useRef(0);
  const tabId = `deal-copilot-${currentDeal.id}`;

  useEffect(() => {
    let cancelled = false;
    setSession(emptySession());
    setQuestion("");
    setErrorText("");
    setStatusText("");
    setPendingQuestion("");
    setIsLoading(false);
    setIsSessionLoading(true);
    setDocumentCount(null);
    requestRef.current += 1;
    if (!currentDeal?.id || !currentUser?.id || !isPersisted) {
      setIsSessionLoading(false);
      return undefined;
    }
    fetchDealCopilotSession(currentDeal.id, currentUser.id).then((response) => {
      if (!cancelled) setSession(response?.session || emptySession());
    }).catch((error) => {
      if (!cancelled) setErrorText(error.message || "Unable to load the conversation.");
    }).finally(() => {
      if (!cancelled) setIsSessionLoading(false);
    });
    return () => { cancelled = true; requestRef.current += 1; };
  }, [currentDeal?.id, currentUser?.id, isPersisted]);

  useEffect(() => {
    if (activeTab === "chat" && messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [session, pendingQuestion, activeTab]);

  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const canRun = Boolean(currentDeal?.id && currentUser?.id && isPersisted && !isBusy && !isSessionLoading);

  async function submitQuestion(rawQuestion) {
    const nextQuestion = String(rawQuestion || question).trim();
    if (!nextQuestion || !canRun || isLoading) return;
    const request = ++requestRef.current;
    setIsLoading(true);
    setPendingQuestion(nextQuestion);
    setErrorText("");
    setStatusText("Reading your deal and document evidence…");
    try {
      const response = await askDealCopilot(currentDeal.id, nextQuestion, currentUser.id);
      if (request !== requestRef.current) return;
      setSession(response?.session || emptySession());
      setQuestion("");
      setStatusText((response?.reply?.retrievalWarnings || []).join(" "));
    } catch (error) {
      if (request !== requestRef.current) return;
      setQuestion(nextQuestion);
      setErrorText(error.message || "Unable to answer right now. Please try again.");
      setStatusText("");
    } finally {
      if (request === requestRef.current) {
        setIsLoading(false);
        setPendingQuestion("");
        requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }));
      }
    }
  }

  async function handleReset() {
    if (!canRun || isLoading) return;
    const request = ++requestRef.current;
    setIsLoading(true);
    setErrorText("");
    setStatusText("Clearing conversation…");
    try {
      const response = await clearDealCopilotSession(currentDeal.id, currentUser.id);
      if (request !== requestRef.current) return;
      setSession(response?.session || emptySession());
      setStatusText("Conversation cleared.");
    } catch (error) {
      if (request === requestRef.current) setErrorText(error.message || "Unable to clear the conversation.");
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  }

  function selectTab(tab, focus = false) {
    setActiveTab(tab);
    if (focus) document.getElementById(`${tabId}-${tab}-tab`)?.focus();
  }

  return (
    <section id="step-copilot" className="compact-card step-card portal-copilot-section" aria-label="Deal copilot">
      <header className="copilot-section-heading">
        <div className="copilot-heading-title"><span className="copilot-heading-mark" aria-hidden="true">AI</span><div><h3>Portal Copilot</h3><p>Answers from your saved deal and document evidence.</p></div></div>
        <span className="copilot-scope-badge" title={currentDeal.clientName || currentDeal.draftLabel}>This deal · {currentDeal.clientName || currentDeal.draftLabel || "Current deal"}</span>
      </header>
      <div className="copilot-tabs" role="tablist" aria-label="Copilot views" onKeyDown={(event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          selectTab(event.key === "Home" ? "chat" : event.key === "End" ? "documents" : activeTab === "chat" ? "documents" : "chat", true);
        }
      }}>
        {["chat", "documents"].map((tab) => <button key={tab} id={`${tabId}-${tab}-tab`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`${tabId}-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => selectTab(tab)}>
          {tab === "chat" ? "Conversation" : "Documents"}{tab === "documents" && documentCount !== null ? <span>{documentCount}</span> : null}
        </button>)}
      </div>
      {!isPersisted ? <div className="portal-copilot-banner">Save this deal to start a conversation or add document evidence.</div> : null}
      <div id={`${tabId}-chat`} role="tabpanel" aria-labelledby={`${tabId}-chat-tab`} hidden={activeTab !== "chat"}>
        <div className="portal-copilot-layout">
          <div className="portal-copilot-console">
            <div className="portal-copilot-console-head"><span className="portal-copilot-kicker">Deal conversation</span><button type="button" className="btn btn-secondary" onClick={handleReset} disabled={!canRun || isLoading || !messages.length}>Clear chat</button></div>
            <div className="portal-copilot-message-list" ref={messageListRef} role="log" aria-label="Deal conversation" aria-live="polite" aria-busy={isLoading}>
              {!messages.length && !pendingQuestion ? <div className="portal-copilot-empty"><span className="copilot-empty-mark" aria-hidden="true">✦</span><strong>{isSessionLoading ? "Loading your conversation…" : "What would you like to know?"}</strong><p>Explore this deal, check finance values, or find the document behind an answer.</p></div> : null}
              {messages.map((message) => <article key={message.id} className={`portal-copilot-message portal-copilot-message-${message.role || "assistant"}`}>
                <div className="portal-copilot-message-meta"><strong>{message.role === "user" ? "You" : "Portal Copilot"}</strong><span>{message.createdAt ? formatDateTime(message.createdAt) : ""}</span></div>
                <div className="portal-copilot-message-body"><p>{message.content || ""}</p></div>
                {message.role === "assistant" ? <>
                  {message.confidence ? <span className="portal-copilot-inline-meta">Confidence: {message.confidence}</span> : null}
                  <CopilotSources rows={message.sourceRefs} />
                  {message.suggestedFields?.length ? <details className="copilot-evidence"><summary>Suggested fields <span>{message.suggestedFields.length}</span></summary><div className="portal-copilot-suggestion-list">{message.suggestedFields.map((field, i) => <div className="portal-copilot-suggestion-card" key={`${field.targetPath}-${i}`}><strong>{field.fieldLabel || field.targetPath}</strong><b>{field.proposedValue}</b></div>)}</div></details> : null}
                </> : null}
              </article>)}
              {pendingQuestion ? <><article className="portal-copilot-message portal-copilot-message-user"><div className="portal-copilot-message-meta"><strong>You</strong></div><div className="portal-copilot-message-body"><p>{pendingQuestion}</p></div></article><div className="copilot-thinking" role="status"><span aria-hidden="true">● ● ●</span> Reviewing evidence…</div></> : null}
            </div>
            <div className="portal-copilot-composer">
              <label className="copilot-visually-hidden" htmlFor={`${tabId}-question`}>Ask about this deal</label>
              <textarea id={`${tabId}-question`} ref={composerRef} rows="2" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submitQuestion(); } }} placeholder="Ask about this deal…" disabled={!canRun || isLoading} />
              <div className="portal-copilot-composer-actions"><span className="copilot-keyboard-hint">Enter to send · Shift + Enter for a new line</span><button type="button" className="btn btn-primary" onClick={() => void submitQuestion()} disabled={!canRun || isLoading || !question.trim()}>{isLoading ? "Working…" : "Send message"}<span aria-hidden="true"> ↗</span></button></div>
              {errorText || statusText ? <div className="portal-copilot-status-copy" role={errorText ? "alert" : "status"}><span className={errorText ? "portal-copilot-error" : ""}>{errorText || statusText}</span></div> : null}
            </div>
          </div>
          <aside className="portal-copilot-aside" aria-label="Conversation starters">
            <section className="portal-copilot-side-card"><span className="portal-copilot-kicker">Start with a question</span><div className="portal-copilot-quick-list">{QUICK_PROMPTS.map((prompt) => <button key={prompt.label} type="button" className="portal-copilot-quick-button" onClick={() => void submitQuestion(prompt.question)} disabled={!canRun || isLoading}><span>{prompt.label}</span><span aria-hidden="true">↗</span></button>)}</div></section>
            <section className="copilot-context-note"><strong>Connected to this deal</strong><p>Current saved values and searchable documents. Expand Sources on an answer to review its evidence.</p><button type="button" onClick={() => selectTab("documents")}>Manage documents <span aria-hidden="true">→</span></button></section>
          </aside>
        </div>
      </div>
      <div id={`${tabId}-documents`} role="tabpanel" aria-labelledby={`${tabId}-documents-tab`} hidden={activeTab !== "documents"}>
        <DealKnowledgePanel key={`${currentDeal.id}-${currentUser.id}`} deal={currentDeal} user={currentUser} enabled={canRun && !isLoading} onCountChange={setDocumentCount} />
      </div>
    </section>
  );
}
