import { useMemo } from "react";

import {
  buildP2pL3BusinessView,
  formatP2pL3BusinessViewValue,
} from "../config/p2pL3BusinessView";
import {
  MetricCard,
  SectionCard,
  StatusPill,
} from "./TowerWorkspacePrimitives";

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

function leverTone(value) {
  if (value === "Automation") {
    return "success";
  }
  if (value === "Copilot") {
    return "info";
  }
  if (value === "Agentic") {
    return "warning";
  }
  return "neutral";
}

function methodTone(value) {
  const text = String(value || "");
  if (text.startsWith("A")) {
    return "success";
  }
  if (text.startsWith("D")) {
    return "info";
  }
  if (text.startsWith("E")) {
    return "warning";
  }
  return "neutral";
}

function gateTone(value) {
  return value ? "success" : "warning";
}

function dispositionTone(value) {
  if (value === "Transfer") {
    return "info";
  }
  if (value === "Transfer + retain") {
    return "warning";
  }
  if (value === "Retain") {
    return "success";
  }
  return "neutral";
}

export default function P2pL3BusinessViewPage({
  currentDeal,
  p2pWorkspace,
}) {
  const workbookView = useMemo(
    () => buildP2pL3BusinessView({ currentDeal, workspace: p2pWorkspace }),
    [currentDeal, p2pWorkspace],
  );

  const sortedL2Rows = useMemo(() => (
    [...workbookView.l2MoneyRows].sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.processNumber - right.processNumber;
    })
  ), [workbookView.l2MoneyRows]);

  const gateOpenCount = workbookView.leverMapRows.filter((row) => row.gateOpen).length;
  const gateHoldCount = workbookView.leverMapRows.length - gateOpenCount;
  const outOfScopeCount = workbookView.l2MoneyRows.filter((row) => !row.selected).length;
  const allocatedL3Hours = workbookView.l3AllocatedRows.reduce((sum, row) => sum + row.allocatedHoursPerMonth, 0);
  const allocatedL3Fte = workbookView.l3AllocatedRows.reduce((sum, row) => sum + row.allocatedFte, 0);
  const l2SelectedCost = workbookView.selectedL2MoneyRows.reduce((sum, row) => sum + row.annualCostY1, 0);

  return (
    <div className="fpa-form-stack p2p-l3-business-layout">
      <SectionCard
        badge="Workbook 29"
        title="P2P L3 business view"
        note={workbookView.note}
        className="p2p-l3-business-hero"
        meta={(
          <div className="overview-pills">
            <StatusPill tone="info">Selected persona {workbookView.selectedPersonaLabel}</StatusPill>
            <StatusPill tone={workbookView.selectedPersonaMatchesRecommend ? "success" : "warning"}>
              {workbookView.selectedPersonaMatchesRecommend ? "Aligned to tab 20" : `Override from ${workbookView.recommendedPersonaLabel}`}
            </StatusPill>
          </div>
        )}
      >
        <div className="review-grid p2p-l3-business-hero-grid">
          <article className="review-panel p2p-l3-business-hero-panel">
            <h4>Selection logic</h4>
            <SummaryList
              rows={[
                { label: "Selected ops persona", value: workbookView.selectedPersonaLabel },
                { label: "Recommend tab persona", value: workbookView.recommendedPersonaLabel },
                { label: "L2 processes in scope", value: `${workbookView.selectedL2Count} of 10` },
                { label: "L3 activities allocated", value: String(workbookView.selectedL3Count) },
              ]}
            />
          </article>

          <article className="review-panel p2p-l3-business-hero-panel">
            <h4>Workload lens</h4>
            <SummaryList
              rows={[
                { label: "Monthly workload", value: formatP2pL3BusinessViewValue(workbookView.totalMonthlyHours, "whole") },
                { label: "Delivery FTE", value: formatP2pL3BusinessViewValue(workbookView.deliveryFte, "number2") },
                { label: "Steady reduction", value: formatP2pL3BusinessViewValue(workbookView.steadyReductionPct, "percent1") },
                { label: "Net run hours / month", value: formatP2pL3BusinessViewValue(workbookView.netRunHoursPerMonth, "whole") },
              ]}
            />
          </article>

          <article className="review-panel review-panel-wide p2p-l3-business-hero-panel">
            <h4>Commercial lens</h4>
            <SummaryList
              rows={[
                { label: "Annual cost Y1", value: formatP2pL3BusinessViewValue(workbookView.annualCostY1, "currency0") },
                { label: "Allocated L3 hours", value: formatP2pL3BusinessViewValue(allocatedL3Hours, "whole") },
                { label: "AI gates open", value: `${gateOpenCount}/${workbookView.leverMapRows.length}` },
                { label: "AI gates on hold", value: String(gateHoldCount) },
              ]}
            />
            <p className="section-note p2p-l3-business-rationale">{workbookView.recommendedPersonaRationale}</p>
          </article>
        </div>
      </SectionCard>

      <div className="metric-grid fpa-l3-business-metric-grid">
        <MetricCard
          label="Selected Persona"
          value={workbookView.selectedPersonaLabel}
          note={workbookView.selectedPersonaMatchesRecommend ? "Matches tab 20 recommendation" : `Recommend tab suggests ${workbookView.recommendedPersonaLabel}`}
        />
        <MetricCard
          label="Scope Mix"
          value={`${workbookView.selectedL2Count} L2 | ${workbookView.selectedL3Count} L3`}
          note={`${outOfScopeCount} L2 rows currently out of scope`}
        />
        <MetricCard
          label="Delivery FTE"
          value={formatP2pL3BusinessViewValue(workbookView.deliveryFte, "number2")}
          note="Selected persona operating baseline"
        />
        <MetricCard
          label="Annual Cost Y1"
          value={formatP2pL3BusinessViewValue(workbookView.annualCostY1, "currency0")}
          note="Blended selected-persona delivery cost"
        />
      </div>

      <SectionCard
        badge="Workbook A"
        title="Cluster roll-up"
        note={workbookView.sections[0].note}
        meta={(
          <div className="overview-pills">
            <span className="section-chip">{workbookView.sections[0].rowRange}</span>
            <StatusPill tone="info">{workbookView.clusterRows.length} active clusters</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-l3-business-table">
            <thead>
              <tr>
                <th>Cluster</th>
                <th>Selected L2</th>
                <th>Monthly Hours</th>
                <th>Tower Share</th>
                <th>Delivery FTE</th>
                <th>Annual Cost Y1</th>
                <th>Steady Reduction</th>
                <th>Hours Removed / Mo</th>
                <th>Dominant Lever</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.clusterRows.map((row) => (
                <tr key={`cluster-${row.clusterCode}`}>
                  <td className="fpa-l3-business-wrap-cell">
                    <strong>{row.clusterLabel}</strong>
                  </td>
                  <td>{formatP2pL3BusinessViewValue(row.selectedL2Count, "whole")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.monthlyHours, "whole")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.towerShare, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.deliveryFte, "number2")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.annualCostY1, "currency0")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.steadyReductionPct, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.hoursRemovedPerMonth, "whole")}</td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={leverTone(row.dominantLever.label)}>{row.dominantLever.label}</StatusPill>
                  </td>
                </tr>
              ))}
              <tr className="fpa-l3-business-total-row p2p-l3-business-total-row">
                <td><strong>Total</strong></td>
                <td>{formatP2pL3BusinessViewValue(workbookView.selectedL2Count, "whole")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.totalMonthlyHours, "whole")}</td>
                <td>{formatP2pL3BusinessViewValue(1, "percent0")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.deliveryFte, "number2")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.annualCostY1, "currency0")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.steadyReductionPct, "percent1")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.hoursRemovedPerMonthSteady, "whole")}</td>
                <td>{workbookView.selectedPersonaLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook B"
        title="L2 money map"
        note={workbookView.sections[1].note}
        meta={(
          <div className="overview-pills">
            <span className="section-chip">{workbookView.sections[1].rowRange}</span>
            <StatusPill tone="info">{formatP2pL3BusinessViewValue(l2SelectedCost, "currency0")} selected annual cost</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-l3-business-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>L2 Process</th>
                <th>Cluster</th>
                <th>Scope</th>
                <th>Method</th>
                <th>Monthly Hours</th>
                <th>Annual Cost Y1</th>
                <th>Retained Share</th>
                <th>Removed / Mo</th>
                <th>Net Run Hours</th>
                <th>Dominant Lever</th>
              </tr>
            </thead>
            <tbody>
              {sortedL2Rows.map((row) => (
                <tr key={`l2-${row.id}`} className={row.selected ? "" : "p2p-l3-business-muted-row"}>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={row.selected ? "success" : "neutral"}>{row.selected ? "In" : "Out"}</StatusPill>
                  </td>
                  <td className="fpa-l3-business-wrap-cell">
                    <strong>{row.processNumber}. {row.processLabel}</strong>
                  </td>
                  <td>{row.clusterLabel}</td>
                  <td>{formatP2pL3BusinessViewValue(row.scopePct, "percent0")}</td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={methodTone(row.method)}>{row.method}</StatusPill>
                  </td>
                  <td>{formatP2pL3BusinessViewValue(row.monthlyHours, "whole")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.annualCostY1, "currency0")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.retainedShare, "percent0")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.hoursRemovedPerMonth, "whole")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.netRunHoursPerMonth, "whole")}</td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={leverTone(row.dominantLever.label)}>{row.dominantLever.label}</StatusPill>
                  </td>
                </tr>
              ))}
              <tr className="fpa-l3-business-total-row p2p-l3-business-total-row">
                <td colSpan="5"><strong>Selected total</strong></td>
                <td>{formatP2pL3BusinessViewValue(workbookView.totalMonthlyHours, "whole")}</td>
                <td>{formatP2pL3BusinessViewValue(l2SelectedCost, "currency0")}</td>
                <td>-</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.hoursRemovedPerMonthSteady, "whole")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.netRunHoursPerMonth, "whole")}</td>
                <td>{workbookView.selectedPersonaLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook C"
        title="L3 allocated hours"
        note={workbookView.sections[2].note}
        meta={(
          <div className="overview-pills">
            <span className="section-chip">{workbookView.sections[2].rowRange}</span>
            <StatusPill tone="info">{workbookView.selectedL3Count} allocated activities</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-l3-business-table">
            <thead>
              <tr>
                <th>L2</th>
                <th>L3 Activity</th>
                <th>Cluster</th>
                <th>Share in L2</th>
                <th>Hours / Mo</th>
                <th>FTE</th>
                <th>Disposition</th>
                <th>Location Intent</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.l3AllocatedRows.map((row) => (
                <tr key={`l3-${row.id}`}>
                  <td className="fpa-l3-business-wrap-cell">
                    <strong>{row.l2Number}. {row.l2Label}</strong>
                  </td>
                  <td className="fpa-l3-business-wrap-cell">{row.l3Label}</td>
                  <td>{row.clusterLabel}</td>
                  <td>{formatP2pL3BusinessViewValue(row.shareWithinL2, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.allocatedHoursPerMonth, "whole")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.allocatedFte, "number2")}</td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={dispositionTone(row.dispositionLabel)}>{row.dispositionLabel}</StatusPill>
                  </td>
                  <td>{row.locationIntent}</td>
                </tr>
              ))}
              <tr className="fpa-l3-business-total-row p2p-l3-business-total-row">
                <td colSpan="4"><strong>Allocated total</strong></td>
                <td>{formatP2pL3BusinessViewValue(allocatedL3Hours, "whole")}</td>
                <td>{formatP2pL3BusinessViewValue(allocatedL3Fte, "number2")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.selectedL3Count, "whole")} lines</td>
                <td>Live scope mix</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook D"
        title="Target operating model split"
        note={workbookView.sections[3].note}
        meta={(
          <div className="overview-pills">
            <span className="section-chip">{workbookView.sections[3].rowRange}</span>
            <StatusPill tone="info">Disposition + location intent</StatusPill>
          </div>
        )}
      >
        <div className="review-grid">
          <article className="review-panel">
            <h4>Disposition mix</h4>
            <div className="fpa-table-wrap fpa-cost-table-wrap">
              <table className="fpa-table fpa-cost-table fpa-l3-business-table">
                <thead>
                  <tr>
                    <th>Disposition</th>
                    <th>Activities</th>
                    <th>Hours / Mo</th>
                    <th>Tower Share</th>
                  </tr>
                </thead>
                <tbody>
                  {workbookView.tomSplitRows.map((row) => (
                    <tr key={`tom-${row.label}`}>
                      <td>{row.label}</td>
                      <td>{formatP2pL3BusinessViewValue(row.activityCount, "whole")}</td>
                      <td>{formatP2pL3BusinessViewValue(row.monthlyHours, "whole")}</td>
                      <td>{formatP2pL3BusinessViewValue(row.sharePct, "percent1")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="review-panel">
            <h4>Location intent mix</h4>
            <div className="fpa-table-wrap fpa-cost-table-wrap">
              <table className="fpa-table fpa-cost-table fpa-l3-business-table">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Activities</th>
                    <th>Hours / Mo</th>
                    <th>Tower Share</th>
                  </tr>
                </thead>
                <tbody>
                  {workbookView.locationIntentRows.map((row) => (
                    <tr key={`location-${row.label}`}>
                      <td>{row.label}</td>
                      <td>{formatP2pL3BusinessViewValue(row.activityCount, "whole")}</td>
                      <td>{formatP2pL3BusinessViewValue(row.monthlyHours, "whole")}</td>
                      <td>{formatP2pL3BusinessViewValue(row.sharePct, "percent1")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook E"
        title="Automation & AI lever map"
        note={workbookView.sections[4].note}
        meta={(
          <div className="overview-pills">
            <span className="section-chip">{workbookView.sections[4].rowRange}</span>
            <StatusPill tone="info">{workbookView.gateNarrative}</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-l3-business-table">
            <thead>
              <tr>
                <th>L2 Process</th>
                <th>Auto</th>
                <th>Copilot</th>
                <th>Agent</th>
                <th>Steady Reduction</th>
                <th>Removed / Mo</th>
                <th>Gate</th>
                <th>Dominant Lever</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.leverMapRows.map((row) => (
                <tr key={`lever-${row.id}`}>
                  <td className="fpa-l3-business-wrap-cell">
                    <strong>{row.processDisplay}</strong>
                  </td>
                  <td>{formatP2pL3BusinessViewValue(row.autoPct, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.copilotPct, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.agentPct, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.steadyReductionPct, "percent1")}</td>
                  <td>{formatP2pL3BusinessViewValue(row.hoursRemovedPerMonth, "whole")}</td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={gateTone(row.gateOpen)}>{row.gateOpen ? `Open (${row.gateCode})` : `Hold (${row.gateCode})`}</StatusPill>
                  </td>
                  <td className="fpa-l3-business-status-cell">
                    <StatusPill tone={leverTone(row.dominantLever.label)}>{row.dominantLever.label}</StatusPill>
                  </td>
                </tr>
              ))}
              <tr className="fpa-l3-business-total-row p2p-l3-business-total-row">
                <td><strong>Gate summary</strong></td>
                <td colSpan="2">{gateOpenCount} open / {gateHoldCount} hold</td>
                <td>-</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.steadyReductionPct, "percent1")}</td>
                <td>{formatP2pL3BusinessViewValue(workbookView.hoursRemovedPerMonthSteady, "whole")}</td>
                <td>{gateOpenCount}/{workbookView.leverMapRows.length} open</td>
                <td>{workbookView.selectedPersonaLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
