import {
  countPopulatedP2pLocalFields,
  countPopulatedP2pSheets,
  countPopulatedP2pWorkbookCells,
  createDefaultP2pWorkspace,
  deriveP2pWorkspaceStatus,
  normalizeP2pWorkspace,
  P2P_LOCAL_TAB_IDS,
  P2P_TABS,
} from "../config/p2pWorkspace";
import { countFilledP2pDiscoveryFields, deriveP2pDiscoveryMetrics } from "../config/p2pDiscovery";
import { deriveP2pScopeMetrics } from "../config/p2pScope";
import { buildP2pWorkloadModel } from "../config/p2pWorkload";
import P2pBenchmarkPage from "./P2pBenchmarkPage";
import P2pAiBenefitPage from "./P2pAiBenefitPage";
import P2pBusinessCasePage from "./P2pBusinessCasePage";
import P2pSensitivityPage from "./P2pSensitivityPage";
import P2pRiskPage from "./P2pRiskPage";
import P2pComplexityPage from "./P2pComplexityPage";
import P2pDiscoveryPage from "./P2pDiscoveryPage";
import P2pFteEnginePage from "./P2pFteEnginePage";
import P2pCostPage from "./P2pCostPage";
import P2pPricingPage from "./P2pPricingPage";
import P2pOutcomePage from "./P2pOutcomePage";
import P2pTransitionPage from "./P2pTransitionPage";
import P2pOpsModelPage from "./P2pOpsModelPage";
import P2pPersonasPage from "./P2pPersonasPage";
import P2pRateCardPage from "./P2pRateCardPage";
import P2pScopePage from "./P2pScopePage";
import P2pDealRisksPage from "./P2pDealRisksPage";
import P2pRecommendPage from "./P2pRecommendPage";
import P2pClientValuePage from "./P2pClientValuePage";
import P2pDashboardPage from "./P2pDashboardPage";
import P2pTraceLogPage from "./P2pTraceLogPage";
import P2pGovernancePage from "./P2pGovernancePage";
import P2pConfidencePage from "./P2pConfidencePage";
import P2pCalibrationPage from "./P2pCalibrationPage";
import P2pBenchmarkPackPage from "./P2pBenchmarkPackPage";
import P2pChangeLogPage from "./P2pChangeLogPage";
import P2pL3BusinessViewPage from "./P2pL3BusinessViewPage";
import P2pWorkbookSheet from "./P2pWorkbookSheet";
import P2pWorkloadPage from "./P2pWorkloadPage";
import { StatusPill } from "./TowerWorkspacePrimitives";

function workspaceStatusTone(status) {
  if (status === "Ready for Engine") {
    return "success";
  }
  if (status === "In Progress") {
    return "warning";
  }
  return "neutral";
}

function tabTone(kind) {
  if (kind === "input") {
    return "success";
  }
  if (kind === "engine") {
    return "info";
  }
  if (kind === "governance") {
    return "warning";
  }
  return "neutral";
}

function renderLocalTab(tabId, props) {
  if (tabId === "p2p-02-discovery") {
    return <P2pDiscoveryPage {...props} />;
  }
  if (tabId === "p2p-03-scope-l3") {
    return <P2pScopePage {...props} />;
  }
  if (tabId === "p2p-04-benchmarks") {
    return <P2pBenchmarkPage {...props} />;
  }
  if (tabId === "p2p-05-workload") {
    return <P2pWorkloadPage {...props} />;
  }
  if (tabId === "p2p-06-complexity") {
    return <P2pComplexityPage {...props} />;
  }
  if (tabId === "p2p-07-personas") {
    return <P2pPersonasPage {...props} />;
  }
  if (tabId === "p2p-08-ai-benefit") {
    return <P2pAiBenefitPage {...props} />;
  }
  if (tabId === "p2p-09-ops-model") {
    return <P2pOpsModelPage {...props} />;
  }
  if (tabId === "p2p-10-rate-card") {
    return <P2pRateCardPage {...props} />;
  }
  if (tabId === "p2p-11-fte-engine") {
    return <P2pFteEnginePage {...props} />;
  }
  if (tabId === "p2p-12-cost") {
    return <P2pCostPage {...props} />;
  }
  if (tabId === "p2p-13-pricing") {
    return <P2pPricingPage {...props} />;
  }
  if (tabId === "p2p-14-outcome") {
    return <P2pOutcomePage {...props} />;
  }
  if (tabId === "p2p-15-transition") {
    return <P2pTransitionPage {...props} />;
  }
  if (tabId === "p2p-16-business-case") {
    return <P2pBusinessCasePage {...props} />;
  }
  if (tabId === "p2p-17-sensitivity") {
    return <P2pSensitivityPage {...props} />;
  }
  if (tabId === "p2p-18-risk") {
    return <P2pRiskPage {...props} />;
  }
  if (tabId === "p2p-19-deal-risks") {
    return <P2pDealRisksPage {...props} />;
  }
  if (tabId === "p2p-20-recommend") {
    return <P2pRecommendPage {...props} />;
  }
  if (tabId === "p2p-21-client-value") {
    return <P2pClientValuePage {...props} />;
  }
  if (tabId === "p2p-22-dashboard") {
    return <P2pDashboardPage {...props} />;
  }
  if (tabId === "p2p-23-trace-log") {
    return <P2pTraceLogPage {...props} />;
  }
  if (tabId === "p2p-24-governance") {
    return <P2pGovernancePage {...props} />;
  }
  if (tabId === "p2p-25-confidence") {
    return <P2pConfidencePage {...props} />;
  }
  if (tabId === "p2p-26-calibration") {
    return <P2pCalibrationPage {...props} />;
  }
  if (tabId === "p2p-27-benchmark-pack") {
    return <P2pBenchmarkPackPage {...props} />;
  }
  if (tabId === "p2p-28-change-log") {
    return <P2pChangeLogPage {...props} />;
  }
  if (tabId === "p2p-29-l3-business-view") {
    return <P2pL3BusinessViewPage {...props} />;
  }
  return null;
}

export default function P2pWorkspacePage({
  currentDeal,
  accessRole,
  accessLabel,
  accessTone,
  canEditP2p,
  isBusy,
  isLoading,
  isSyncing,
  currentUserId,
  currentUserName,
  activeSection,
  onSelectTab,
  onSave,
  onUpdateCell,
  onUpdateWorkspace,
}) {
  const p2pWorkspace = normalizeP2pWorkspace(currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : {};
  const workspaceStatus = deriveP2pWorkspaceStatus(p2pWorkspace, workbookInputs);
  const activeTab = P2P_TABS.find((tab) => tab.id === activeSection) || P2P_TABS[0];
  const activeTabIndex = P2P_TABS.findIndex((tab) => tab.id === activeTab.id);
  const previousTab = activeTabIndex > 0 ? P2P_TABS[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex < P2P_TABS.length - 1 ? P2P_TABS[activeTabIndex + 1] : null;
  const populatedSheetCount = countPopulatedP2pSheets(workbookInputs);
  const populatedCellCount = countPopulatedP2pWorkbookCells(workbookInputs);
  const localFieldCount = countPopulatedP2pLocalFields(p2pWorkspace);
  const discoveryMetrics = deriveP2pDiscoveryMetrics(p2pWorkspace);
  const scopeMetrics = deriveP2pScopeMetrics(p2pWorkspace.scopeL3);
  const workloadModel = buildP2pWorkloadModel(p2pWorkspace, currentDeal || {});
  const isLocalTab = P2P_LOCAL_TAB_IDS.has(activeTab.id);

  return (
    <>
      <section className="compact-card fpa-cover-hero">
        <div className="fpa-cover-hero-copy">
          <p className="section-kicker">Tower Workspace</p>
          <h3>Procure-to-Pay (P2P) - local-first portal</h3>
          <p className="fpa-cover-subtitle">The first twenty-eight P2P tabs now run with frontend formulas for instant load. Downstream tabs can still fall back to workbook render while the tower is ported step by step.</p>
        </div>

        <div className="fpa-cover-hero-side">
          <div className="overview-pills">
            <StatusPill tone={workspaceStatusTone(currentDeal?.towerStatus_P2P || workspaceStatus)}>{currentDeal?.towerStatus_P2P || workspaceStatus}</StatusPill>
            <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
            <StatusPill tone="info">{P2P_LOCAL_TAB_IDS.size} local tabs live</StatusPill>
          </div>

          <div className="fpa-cover-context-grid">
            <div className="fpa-cover-context-item">
              <span>Draft</span>
              <strong>{currentDeal?.draftLabel || currentDeal?.dealId || "Draft"}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Client</span>
              <strong>{currentDeal?.clientName || "<Client Name>"}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Discovery Fields Answered</span>
              <strong>{countFilledP2pDiscoveryFields(p2pWorkspace.discovery)}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>L2 Processes In Scope</span>
              <strong>{scopeMetrics.selectedL2Count}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Workbook Tabs Touched</span>
              <strong>{populatedSheetCount}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Workbook Inputs Saved</span>
              <strong>{populatedCellCount}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Coverage Mode</span>
              <strong>{discoveryMetrics.sizingMode}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Monthly Hours</span>
              <strong>{workloadModel.totalMonthlyHours.toFixed(1)}</strong>
            </div>
            <div className="fpa-cover-context-item">
              <span>Local Signals</span>
              <strong>{localFieldCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {!canEditP2p ? (
        <section className="compact-card info-banner">
          <div>
            <p className="section-kicker">Access</p>
            <h3>P2P is read-only in this workspace</h3>
            <p className="muted-copy">
              You can review the tower tabs and current inputs, but only the deal owner or assigned P2P users can update this workspace.
            </p>
          </div>
          <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
        </section>
      ) : null}

      <section className="compact-card fpa-tab-shell">
        <div className="step-header">
          <div>
            <span className="step-badge">Tower Tab</span>
            <h3>{activeTab.sidebarLabel} | {activeTab.title}</h3>
            <p className="section-note">{activeTab.description}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={tabTone(activeTab.kind)}>{activeTab.kind}</StatusPill>
            <span className="section-chip">{isLocalTab ? "Frontend formula engine" : "Workbook fallback"}</span>
          </div>
        </div>

        {isLocalTab ? renderLocalTab(activeTab.id, {
          currentDeal,
          p2pWorkspace,
          canEditP2p,
          currentUserName,
          isBusy,
          onUpdateCell,
          onUpdateWorkspace,
        }) : (
          <P2pWorkbookSheet
            activeTab={activeTab}
            currentDeal={currentDeal}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            canEdit={canEditP2p}
            isBusy={isBusy}
            onUpdateCell={onUpdateCell}
          />
        )}

        <div className="fpa-tab-actions">
          <button type="button" className="btn btn-secondary" onClick={() => previousTab && onSelectTab(previousTab.id)} disabled={!previousTab}>
            Previous Tab
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => nextTab && onSelectTab(nextTab.id)} disabled={!nextTab}>
            Next Tab
          </button>
          {canEditP2p ? (
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={isBusy}>
              {isSyncing && !isLoading ? "Saving..." : "Save P2P"}
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}



























