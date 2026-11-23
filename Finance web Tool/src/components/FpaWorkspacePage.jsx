import {
  countFilledFpaDiscoveryFields,
  countSelectedFpaScopes,
  createDefaultFpaWorkspace,
  deriveFpaWorkspaceStatus,
  FPA_DISCOVERY_OPTIONS,
  FPA_TABS,
  MONTH_OPTIONS,
  normalizeFpaWorkspace,
} from "../config/fpaWorkspace";
import FpaWorkbookSheet from "./FpaWorkbookSheet";
import FpaBenchmarkPage from "./FpaBenchmarkPage";
import FpaAiBenefitPage from "./FpaAiBenefitPage";
import FpaComplexityPage from "./FpaComplexityPage";
import FpaOpsModelPage from "./FpaOpsModelPage";
import FpaRateCardPage from "./FpaRateCardPage";
import FpaFteEnginePage from "./FpaFteEnginePage";
import FpaCostPage from "./FpaCostPage";
import FpaPricingPage from "./FpaPricingPage";
import FpaScplPage from "./FpaScplPage";
import FpaSizingBandMixPage from "./FpaSizingBandMixPage";
import FpaOutcomePage from "./FpaOutcomePage";
import FpaTransitionPage from "./FpaTransitionPage";
import FpaBusinessCasePage from "./FpaBusinessCasePage";
import FpaSensitivityPage from "./FpaSensitivityPage";
import FpaRiskPage from "./FpaRiskPage";
import FpaDealRisksPage from "./FpaDealRisksPage";
import FpaRecommendPage from "./FpaRecommendPage";
import FpaClientValuePage from "./FpaClientValuePage";
import FpaDashboardPage from "./FpaDashboardPage";
import FpaDiscoveryPage from "./FpaDiscoveryPage";
import FpaGovernancePage from "./FpaGovernancePage";
import FpaConfidencePage from "./FpaConfidencePage";
import FpaCalibrationPage from "./FpaCalibrationPage";
import FpaBenchmarkPackPage from "./FpaBenchmarkPackPage";
import FpaChangeLogPage from "./FpaChangeLogPage";
import FpaL3BusinessViewPage from "./FpaL3BusinessViewPage";
import FpaPersonasPage from "./FpaPersonasPage";
import FpaScopePage from "./FpaScopePage";
import FpaTraceLogPage from "./FpaTraceLogPage";
import FpaWorkloadPage from "./FpaWorkloadPage";

const FPA_COVER_TITLE = "FINANCIAL PLANNING & ANALYSIS (FP&A) \u2014 SOLUTION SIZING & COMMERCIAL MODEL \u2014 E2E Finance Solution v5.0";
const FPA_COVER_SUBTITLE = "Tower instance of the shared framework | Plan & analyse | F&A sourcing-provider archetype | zero-customer-data capable";


const FPA_COVER_STEPS = [
  "E2E Deal Master \u2014 identity, term, constructs; tick this tower in scope. 01 shows what the tower inherits.",
  "02 Discovery \u2014 enter what you know; blanks auto-default; check coverage, completeness, tech stack (\u00A7D) and pain points (\u00A7E).",
  "03 Scope \u2014 switch L3 activities Y/Partial/N; disposition for the TOM story.",
  "05 Workload \u2014 review method mix (A/D/E), variance flags; reconcile customer FTE in \u00A7C; override with notes only.",
  "06 Complexity + 08 AI Benefit \u2014 confirm scores, gates and lever effects vs ceilings.",
  "09/10 \u2014 shore mix, location blends, pyramid tilt; rate card sanity (confirm flag).",
  "11/12/13 \u2014 FTE (steady + ramped years), cost-to-serve, floor/target/markup/recommended price.",
  "15/16 \u2014 transition fee & billing factor; multiyear P&L, NPV, payback, TCV/ACV.",
  "17/18/19 \u2014 sensitivity, 20 validation rules, deal risks. Clear the REDs or log the story (23).",
  "20/21/22 \u2014 recommendation + conditions, client savings, executive dashboard; 25/26/27 confidence & calibration; then the E2E layer.",
];

const FPA_COVER_PROFILE_ROWS = [
  {
    label: "Scope (L2 processes)",
    value: "Strategic & Long-Range Planning \u00B7 Annual Budgeting & Target Setting \u00B7 Rolling Forecasting & IBP \u00B7 Revenue & Commercial Forecasting \u00B7 Cost, Productivity & Margin Management \u00B7 Workforce & Capacity Planning \u00B7 Cash Flow & Capital Planning \u00B7 Variance Analysis & Performance Management \u00B7 Management Reporting & Decision Support \u00B7 Scenario Planning & Risk Modelling \u00B7 Profitability, Pricing & Business Cases \u00B7 Governance, Master Data & Business Partnering",
  },
  {
    label: "Key KPIs",
    value: "Forecast accuracy (MAPE) \u00B7 Budget cycle time \u00B7 Budget variance (abs.) \u00B7 Planning iterations per budget \u00B7 Report turnaround after close \u00B7 Reports automated / self-service \u00B7 Business-partner time on analysis vs data prep",
  },
  {
    label: "Controls preserved",
    value: "Version control on plans & forecasts \u00B7 Driver & assumption governance (register, owners) \u00B7 Board-pack review & sign-off \u00B7 Hierarchy / master-data change control \u00B7 Access & segregation in EPM",
  },
  {
    label: "Technology landscape",
    value: "ERP / sub-ledger feed \u00B7 Planning platform (EPM) \u00B7 Close / consolidation \u00B7 BI / reporting \u00B7 Data layer \u00B7 MDM",
  },
  {
    label: "Automation & AI levers",
    value: "Driver-based planning \u00B7 Self-service BI & report rationalisation \u00B7 GenAI variance & commentary narratives \u00B7 Scenario & forecasting copilots \u00B7 Agentic data stewardship & reconciliation",
  },
  {
    label: "Sizing drivers",
    value: "# Legal Entities \u00B7 # Business Units \u00B7 Employee Count (000s) \u00B7 Geographic Footprint (# countries) \u00B7 # Cost Centres \u00B7 # Products / Service Lines \u00B7 # Report Packs / month \u00B7 # Data Sources feeding the tower",
  },
  {
    label: "Clusters & pod floors",
    value: "P&F = Planning & Forecasting (min 2, hard) \u00B7 R&A = Reporting & Analytics (min 2, hard) \u00B7 BP&DS = Business Partnering & Decision Support (min 0.5, advisory) \u00B7 D&G = Data & Governance (min 0.5, advisory)",
  },
];
function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function SummaryList({ rows }) {
  return (
    <div className="summary-list">
      {rows.map((row) => (
        <div key={row.label} className="summary-item">
          <span className="summary-label">{row.label}</span>
          <span className={`summary-value ${row.muted ? "is-muted" : ""}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function TextField({ label, name, value, onChange, type = "text", disabled = false }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <input name={name} type={type} value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options, disabled = false }) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));

  return (
    <label className="field-block">
      <span>{label}</span>
      <select name={name} value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)}>
        <option value="">Select</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function workspaceStatusTone(status) {
  if (status === "Ready for Engine") {
    return "success";
  }

  if (status === "In Progress") {
    return "info";
  }

  return "neutral";
}

function fpaTabTone(kind) {
  if (kind === "input") {
    return "success";
  }

  if (kind === "output") {
    return "info";
  }

  if (kind === "governance") {
    return "warning";
  }

  return "neutral";
}

export default function FpaWorkspacePage({
  currentDeal,
  accessRole,
  accessLabel,
  accessTone,
  canEditFpa,
  isBusy,
  isLoading,
  isSyncing,
  currentUserId,
  currentUserName,
  activeSection,
  onSelectTab,
  onSave,
  onUpdateDiscoveryField,
  onUpdateScopeItem,
  onUpdateNotes,
  onUpdateWorkbookCell,
  onUpdateWorkspace,
}) {
  const fpaWorkspace = normalizeFpaWorkspace(currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workspaceStatus = deriveFpaWorkspaceStatus(fpaWorkspace);
  const discoveryCount = countFilledFpaDiscoveryFields(fpaWorkspace);
  const scopeCount = countSelectedFpaScopes(fpaWorkspace);
  const activeTab = FPA_TABS.find((tab) => tab.id === activeSection) || FPA_TABS[0];
  const activeTabIndex = FPA_TABS.findIndex((tab) => tab.id === activeTab.id);
  const previousTab = activeTabIndex > 0 ? FPA_TABS[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex < FPA_TABS.length - 1 ? FPA_TABS[activeTabIndex + 1] : null;

  function renderActivePanel() {
    if (activeTab.id === "fpa-00-cover") {
      return (
        <div className="fpa-cover-layout">
          <div className="fpa-cover-grid">
            <article className="compact-card fpa-subpanel">
              <div className="step-header">
                <div>
                  <span className="step-badge">Workbook Guide</span>
                  {/* <h4>How to Use - 10 Steps</h4> */}
                  <p className="section-note">Identical in every tower, preserved from the source FP&A workbook.</p>
                </div>
                <span className="section-chip">10 steps</span>
              </div>

              <ol className="fpa-cover-step-list" aria-label="FP&A workbook usage steps">
                {FPA_COVER_STEPS.map((step, index) => (
                  <li key={`cover-step-${index}`} className="fpa-cover-step-item">
                    <span className="fpa-cover-step-number">{index + 1}</span>
                    <span className="fpa-cover-step-text">{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <article className="compact-card fpa-subpanel">
            <div className="step-header">
              <div>
                <span className="step-badge">Tower Profile</span>
                <h4>FP&A Tower Profile</h4>
                <p className="section-note">Workbook reference content carried over so the portal keeps the same operating context as the model.</p>
              </div>
              <span className="section-chip">7 profile rows</span>
            </div>

            <div className="fpa-cover-profile-grid">
              {FPA_COVER_PROFILE_ROWS.map((row) => (
                <div key={row.label} className="fpa-cover-profile-row">
                  <span className="fpa-cover-profile-key">{row.label}</span>
                  <span className="fpa-cover-profile-value">{row.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      );
    }
    if (activeTab.id === "fpa-00-logic") {
      return (
        <div className="review-grid">
          <article className="review-panel">
            <h4>Preserved logic rules</h4>
            <SummaryList
              rows={[
                { label: "No double-count guard", value: "Complexity shapes buffers and fit, but does not multiply workload twice." },
                { label: "AI benefit pattern", value: "Addressable x Reduction x Residual x Ambition x Ramp x Gate, with an effective cap." },
                { label: "Persona order", value: "Conservative, Standard, Lean, Aggressive AI-First, Autonomous Finance." },
                { label: "Governance", value: "Evidence, overrides, and approvals must remain traceable before client-ready outputs." },
              ]}
            />
          </article>
          <article className="review-panel">
            <h4>Current implementation stance</h4>
            <SummaryList
              rows={[
                { label: "Now live", value: "Deal Setup, Discovery, Scope L3, sidebar workbook tabs, and JSON persistence." },
                { label: "Next formula port", value: "Benchmarks -> Workload -> Complexity -> AI Benefit -> FTE Engine." },
                { label: "Formula cells in this tab", value: String(activeTab.formulaCount) },
              ]}
            />
          </article>
        </div>
      );
    }

    if (activeTab.id === "fpa-00-dict") {
      return (
        <div className="review-grid">
          <article className="review-panel">
            <h4>Input classes</h4>
            <SummaryList
              rows={[
                { label: "Shared inputs", value: "Deal identity, commercials, FX, currency, benchmark policy, and tower ownership." },
                { label: "Tower inputs", value: "Discovery drivers, process scope, platform signals, current staffing, and baseline cost." },
                { label: "Output classes", value: "Sizing, cost, pricing, business case, risk, recommendation, and dashboard labels." },
              ]}
            />
          </article>
          <article className="review-panel">
            <h4>Source classes</h4>
            <SummaryList
              rows={[
                { label: "Client-confirmed", value: "Client-provided data and validated operating facts." },
                { label: "Client estimate", value: "Customer-side directional or proxy information." },
                { label: "Practitioner assumption", value: "Delivery or presales judgement used when source data is missing." },
                { label: "Benchmark / Market", value: "External benchmark or market reference used for defensible sizing." },
              ]}
            />
          </article>
        </div>
      );
    }

    if (activeTab.id === "fpa-01-deal-setup") {
      return (
        <div className="review-grid">
          <article className="review-panel">
            <h4>Mapped from Deal Master</h4>
            <SummaryList
              rows={[
                { label: "Client", value: currentDeal.clientName || "-" },
                { label: "Deal ID", value: currentDeal.dealId || "-" },
                { label: "Programme", value: currentDeal.programName || "-" },
                { label: "Bid Date", value: currentDeal.bidDate || "-" },
                { label: "Contract Term", value: `${currentDeal.contractTerm || "-"} years` },
                { label: "Display Currency", value: currentDeal.displayCurrency || "-" },
              ]}
            />
          </article>
          <article className="review-panel">
            <h4>Commercial controls</h4>
            <SummaryList
              rows={[
                { label: "Pricing Construct", value: currentDeal.pricingConstruct || "-" },
                { label: "Transition Commercials", value: currentDeal.transitionCommercials || "-" },
                { label: "Transformation Funding", value: currentDeal.transformationFunding || "-" },
                { label: "Benchmark Policy", value: currentDeal.benchmarkPolicy || "-" },
                { label: "FP&A Workspace Owner", value: currentDeal.towerLead_FPA || "Unassigned" },
                { label: "Status", value: currentDeal.towerStatus_FPA || workspaceStatus },
              ]}
            />
          </article>
        </div>
      );
    }

    if (activeTab.id === "fpa-02-discovery") {
      return (
        <FpaDiscoveryPage
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateWorkspace={onUpdateWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-03-scope-l3") {
      return (
        <FpaScopePage
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateWorkspace={onUpdateWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-04-benchmarks") {
      return (
        <FpaBenchmarkPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-05-workload") {
      return (
        <FpaWorkloadPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }
    if (activeTab.id === "fpa-06-complexity") {
      return (
        <FpaComplexityPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-07-personas") {
      return (
        <FpaPersonasPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-08-ai-benefit") {
      return (
        <FpaAiBenefitPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-09-ops-model") {
      return (
        <FpaOpsModelPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-10-rate-card") {
      return (
        <FpaRateCardPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-11-fte-engine") {
      return (
        <FpaFteEnginePage
          currentDeal={currentDeal}
          currentUserId={currentUserId}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-12-cost") {
      return (
        <FpaCostPage
          currentDeal={currentDeal}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-13-pricing") {
      return (
        <FpaPricingPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }
    if (activeTab.id === "fpa-30-scpl") {
      return (
        <FpaScplPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-31-sizing-band-mix") {
      return (
        <FpaSizingBandMixPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-14-outcome") {
      return (
        <FpaOutcomePage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-15-transition") {
      return (
        <FpaTransitionPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-16-business-case") {
      return (
        <FpaBusinessCasePage
          currentDeal={currentDeal}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-17-sensitivity") {
      return (
        <FpaSensitivityPage
          currentDeal={currentDeal}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-18-risk") {
      return (
        <FpaRiskPage
          currentDeal={currentDeal}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-19-deal-risks") {
      return (
        <FpaDealRisksPage
          currentDeal={currentDeal}
          isBusy={isBusy}
        />
      );
    }

    if (activeTab.id === "fpa-20-recommend") {
      return (
        <FpaRecommendPage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-21-client-value") {
      return (
        <FpaClientValuePage
          currentDeal={currentDeal}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }

    if (activeTab.id === "fpa-22-dashboard") {
      return (
        <FpaDashboardPage
          currentDeal={currentDeal}
        />
      );
    }

    if (activeTab.id === "fpa-23-trace-log") {
      return (
        <FpaTraceLogPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          currentUserName={currentUserName}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
        />
      );
    }



    if (activeTab.id === "fpa-24-governance") {
      return (
        <FpaGovernancePage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateCell={onUpdateWorkbookCell}
          onUpdateWorkspace={onUpdateWorkspace}
        />
      );
    }


    if (activeTab.id === "fpa-25-confidence") {
      return (
        <FpaConfidencePage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-26-calibration") {
      return (
        <FpaCalibrationPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-27-benchmark-pack") {
      return (
        <FpaBenchmarkPackPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-28-change-log") {
      return (
        <FpaChangeLogPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
          currentUserName={currentUserName}
          canEditFpa={canEditFpa}
          isBusy={isBusy}
          onUpdateWorkspace={onUpdateWorkspace}
        />
      );
    }

    if (activeTab.id === "fpa-29-l3-business-view") {
      return (
        <FpaL3BusinessViewPage
          currentDeal={currentDeal}
          fpaWorkspace={fpaWorkspace}
        />
      );
    }

    return (
      <FpaWorkbookSheet
        activeTab={activeTab}
        currentDeal={currentDeal}
        currentUserId={currentUserId}
        canEdit={canEditFpa}
        isBusy={isBusy}
        onUpdateCell={onUpdateWorkbookCell}
      />
    );
  }

  return (
    <>
      {activeTab.id === "fpa-00-cover" ? (
        <section className="compact-card fpa-cover-hero">
          <div className="fpa-cover-hero-copy">
            <p className="section-kicker">Workbook Cover</p>
            <h3>{FPA_COVER_TITLE}</h3>
            <p className="fpa-cover-subtitle">{FPA_COVER_SUBTITLE}</p>
          </div>

          <div className="fpa-cover-hero-side">
            <div className="overview-pills">
              <StatusPill tone={workspaceStatusTone(currentDeal.towerStatus_FPA || workspaceStatus)}>{currentDeal.towerStatus_FPA || workspaceStatus}</StatusPill>
              <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
              <StatusPill tone="info">{FPA_TABS.length} workbook tabs</StatusPill>
            </div>

            <div className="fpa-cover-context-grid">
              <div className="fpa-cover-context-item">
                <span>Draft</span>
                <strong>{currentDeal.draftLabel || currentDeal.dealId || "Draft"}</strong>
              </div>
              <div className="fpa-cover-context-item">
                <span>Client</span>
                <strong>{currentDeal.clientName || "<Client Name>"}</strong>
              </div>
              <div className="fpa-cover-context-item">
                <span>Programme</span>
                <strong>{currentDeal.programName || "Programme pending"}</strong>
              </div>
              <div className="fpa-cover-context-item">
                <span>Workspace Owner</span>
                <strong>{currentDeal.towerLead_FPA || "Unassigned"}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!canEditFpa ? (
        <section className="compact-card info-banner">
          <div>
            <p className="section-kicker">Access</p>
            <h3>FP&A is read-only in this workspace</h3>
            <p className="muted-copy">
              You can review the FP&A workbook tabs and current inputs, but only the deal owner or the assigned FP&A users can update this tower.
            </p>
          </div>
          <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
        </section>
      ) : null}

      <section className="compact-card fpa-tab-shell">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Tab</span>
            <h3>{activeTab.sidebarLabel} | {activeTab.title}</h3>
            <p className="section-note">{activeTab.description}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={fpaTabTone(activeTab.kind)}>{activeTab.kind}</StatusPill>
            <span className="section-chip">{activeTab.formulaCount.toLocaleString("en-IN")} formula cells</span>
          </div>
        </div>

        {renderActivePanel()}

        <div className="fpa-tab-actions">
          <button type="button" className="btn btn-secondary" onClick={() => previousTab && onSelectTab(previousTab.id)} disabled={!previousTab}>
            Previous Tab
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => nextTab && onSelectTab(nextTab.id)} disabled={!nextTab}>
            Next Tab
          </button>
          {canEditFpa ? (
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={isBusy}>
              {isSyncing && !isLoading ? "Saving..." : "Save FP&A"}
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}





































