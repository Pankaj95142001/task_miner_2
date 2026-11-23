import { useMemo, useState } from "react";

import {
  buildFpaL3BusinessViewWorkbookView,
  formatL3BusinessViewValue,
} from "../config/fpaL3BusinessView";

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note, tone = "neutral" }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className={`metric-note is-${tone}`}>{note}</span>
    </article>
  );
}

function SectionCard({ badge, title, note, meta = null, children, className = "" }) {
  return (
    <section className={["compact-card", "fpa-subpanel", className].filter(Boolean).join(" ")}>
      <div className="step-header">
        <div>
          <span className="step-badge">{badge}</span>
          <h4>{title}</h4>
          {note ? <p className="section-note">{note}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

function floorStatusTone(value) {
  if (value === "RED") {
    return "danger";
  }
  if (value === "AMBER") {
    return "warning";
  }
  if (value === "OK") {
    return "success";
  }
  return "neutral";
}

function dominantLeverTone(value) {
  if (value === "AUTO") {
    return "success";
  }
  if (value === "COPILOT") {
    return "info";
  }
  if (value === "AGENT") {
    return "warning";
  }
  return "neutral";
}

function dispositionTone(value) {
  if (value === "Transfer") {
    return "info";
  }
  if (value === "Automate") {
    return "success";
  }
  if (value === "Eliminate") {
    return "warning";
  }
  return "neutral";
}

function methodTone(value) {
  if (String(value).startsWith("A")) {
    return "success";
  }
  if (String(value).startsWith("D")) {
    return "info";
  }
  if (String(value).startsWith("E")) {
    return "warning";
  }
  return "neutral";
}

function ClusterRollupTable({ workbookView }) {
  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table fpa-l3-business-table">
        <colgroup>
          <col style={{ width: "82px" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Cluster</th>
            <th>Description</th>
            <th className="is-number">Hours / month</th>
            <th className="is-number">% of tower</th>
            <th className="is-number">FTE (recommended)</th>
            <th className="is-number">Hours removed (steady)</th>
            <th>Pod floor</th>
            <th>Floor status</th>
          </tr>
        </thead>
        <tbody>
          {workbookView.clusterRows.map((row) => (
            <tr key={row.cluster}>
              <td><strong>{row.cluster}</strong></td>
              <td className="fpa-l3-business-wrap-cell">{row.description}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.hoursPerMonth, "decimal2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.towerShare, "percent1")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.recommendedFte, "fte2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.hoursRemoved, "decimal2")}</td>
              <td>{row.podFloor}</td>
              <td className="fpa-l3-business-status-cell"><StatusPill tone={floorStatusTone(row.floorStatus)}>{row.floorStatus}</StatusPill></td>
            </tr>
          ))}
          <tr className="fpa-l3-business-total-row">
            <td colSpan={2}><strong>{workbookView.clusterTotalRow.label}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.clusterTotalRow.hoursPerMonth, "decimal2")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.clusterTotalRow.towerShare, "percent0")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.clusterTotalRow.recommendedFte, "fte2")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.clusterTotalRow.hoursRemoved, "decimal2")}</strong></td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function L2MoneyMapTable({ workbookView }) {
  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table fpa-l3-business-table">
        <colgroup>
          <col style={{ width: "25%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "13%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>L2 Process</th>
            <th>Cluster</th>
            <th className="is-number">Hours / month</th>
            <th className="is-number">Net reduction</th>
            <th className="is-number">Hours removed</th>
            <th className="is-number">FTE</th>
            <th>Dominant lever</th>
            <th className="is-number">Rank</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {workbookView.l2MoneyRows.map((row) => (
            <tr key={row.id}>
              <td className="fpa-l3-business-wrap-cell"><strong>{row.label}</strong></td>
              <td>{row.cluster}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.monthlyHours, "decimal2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.netReduction, "percent1")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.hoursRemoved, "decimal2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.recommendedFte, "fte2")}</td>
              <td className="fpa-l3-business-status-cell"><StatusPill tone={dominantLeverTone(row.dominantLever)}>{row.dominantLever}</StatusPill></td>
              <td className="is-number">{row.rank}</td>
              <td className="fpa-l3-business-status-cell"><StatusPill tone={methodTone(row.methodLabel)}>{row.methodLabel}</StatusPill></td>
            </tr>
          ))}
          <tr className="fpa-l3-business-total-row">
            <td><strong>{workbookView.l2MoneyTotalRow.label}</strong></td>
            <td>—</td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.l2MoneyTotalRow.monthlyHours, "decimal2")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.l2MoneyTotalRow.netReduction, "percent1")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.l2MoneyTotalRow.hoursRemoved, "decimal2")}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.l2MoneyTotalRow.recommendedFte, "fte2")}</strong></td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function L3AllocatedHoursTable({ workbookView }) {
  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table fpa-l3-business-table">
        <colgroup>
          <col style={{ width: "7%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>L2#</th>
            <th>L2 Process</th>
            <th>L3 Activity</th>
            <th>Cluster</th>
            <th className="is-number">Final %</th>
            <th className="is-number">Allocated hrs / mo</th>
            <th>Disposition</th>
            <th>Location intent</th>
          </tr>
        </thead>
        <tbody>
          {workbookView.l3AllocatedRows.map((row) => (
            <tr key={row.id}>
              <td>{row.l2Number}</td>
              <td className="fpa-l3-business-wrap-cell">{row.l2Process}</td>
              <td className="fpa-l3-business-wrap-cell"><strong>{row.activity}</strong></td>
              <td>{row.cluster}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.finalPct, "scopePercent")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.allocatedHours, "decimal2")}</td>
              <td className="fpa-l3-business-status-cell"><StatusPill tone={dispositionTone(row.disposition)}>{row.disposition}</StatusPill></td>
              <td className="fpa-l3-business-wrap-cell">{row.locationIntent}</td>
            </tr>
          ))}
          <tr className="fpa-l3-business-total-row">
            <td colSpan={5}><strong>{workbookView.l3AllocatedTotalRow.label}</strong></td>
            <td className="is-number"><strong>{formatL3BusinessViewValue(workbookView.l3AllocatedTotalRow.allocatedHours, "decimal2")}</strong></td>
            <td colSpan={2} className="fpa-l3-business-status-cell"><StatusPill tone={floorStatusTone(workbookView.l3AllocatedTotalRow.status.startsWith("OK") ? "OK" : "AMBER")}>{workbookView.l3AllocatedTotalRow.status}</StatusPill></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TomSplitTable({ workbookView }) {
  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table fpa-l3-business-table">
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "24%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Disposition</th>
            <th className="is-number">Hours / month</th>
            <th className="is-number">% of tower</th>
            <th className="is-number"># L3 activities</th>
          </tr>
        </thead>
        <tbody>
          {workbookView.tomSplitRows.map((row) => (
            <tr key={row.disposition}>
              <td className="fpa-l3-business-status-cell"><StatusPill tone={dispositionTone(row.disposition)}>{row.disposition}</StatusPill></td>
              <td className="is-number">{formatL3BusinessViewValue(row.hoursPerMonth, "decimal2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.towerShare, "percent1")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.activityCount, "whole")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeverMapTable({ workbookView }) {
  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table fpa-l3-business-table">
        <colgroup>
          <col style={{ width: "24%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "18%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Lever</th>
            <th>Type</th>
            <th>Linked L2 processes</th>
            <th className="is-number">Hours removed / month</th>
            <th className="is-number">FTE equivalent</th>
            <th>Quick-win or structural</th>
          </tr>
        </thead>
        <tbody>
          {workbookView.leverRows.map((row) => (
            <tr key={row.id}>
              <td className="fpa-l3-business-wrap-cell"><strong>{row.label}</strong></td>
              <td>{row.type}</td>
              <td>{row.linkedProcesses}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.hoursRemoved, "decimal2")}</td>
              <td className="is-number">{formatL3BusinessViewValue(row.fteEquivalent, "fte2")}</td>
              <td className="fpa-l3-business-wrap-cell">{row.lifeCycle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FpaL3BusinessViewPage({
  currentDeal,
  fpaWorkspace,
}) {
  const workbookView = useMemo(
    () => buildFpaL3BusinessViewWorkbookView({ currentDeal, workspace: fpaWorkspace }),
    [currentDeal, fpaWorkspace],
  );
  const [activeSectionId, setActiveSectionId] = useState(workbookView.sections[0]?.id || "clusterRollup");

  const activeSection = workbookView.sections.find((section) => section.id === activeSectionId) || workbookView.sections[0];

  function renderActiveSection() {
    switch (activeSectionId) {
      case "clusterRollup":
        return <ClusterRollupTable workbookView={workbookView} />;
      case "l2MoneyMap":
        return <L2MoneyMapTable workbookView={workbookView} />;
      case "l3AllocatedHours":
        return <L3AllocatedHoursTable workbookView={workbookView} />;
      case "tomSplit":
        return <TomSplitTable workbookView={workbookView} />;
      case "leverMap":
        return <LeverMapTable workbookView={workbookView} />;
      default:
        return <ClusterRollupTable workbookView={workbookView} />;
    }
  }

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-l3-business-metric-grid">
        <MetricCard
          label="Recommended Persona"
          value={workbookView.recommendedPersona.label}
          note={`Tab 20 | Persona ${workbookView.recommendedPersona.index}`}
          tone="info"
        />
        <MetricCard
          label="Total Monthly Hours"
          value={formatL3BusinessViewValue(workbookView.totalMonthlyHours, "whole")}
          note="Workbook rows 29 / 86 | ties to Tab 05"
          tone="info"
        />
        <MetricCard
          label="Hours Removed (steady)"
          value={formatL3BusinessViewValue(workbookView.totalHoursRemoved, "whole")}
          note={formatL3BusinessViewValue(workbookView.totalNetReduction, "percent1")}
          tone="success"
        />
        <MetricCard
          label="In-Scope L3 Activities"
          value={`${workbookView.selectedL3Count}/${workbookView.totalL3Count}`}
          note={workbookView.dominantDisposition ? `Primary TOM: ${workbookView.dominantDisposition.disposition}` : "Scope-driven view"}
          tone="info"
        />
      </div>

      <SectionCard
        badge="Workbook 29"
        title={workbookView.title}
        note={workbookView.note}
        meta={(
          <div className="overview-pills">
            <StatusPill tone="info">{workbookView.sections.length} sections</StatusPill>
            <StatusPill tone="info">{workbookView.totalL3Count} L3 activities</StatusPill>
            {workbookView.leadingLever ? <StatusPill tone="success">Top lever: {workbookView.leadingLever.label}</StatusPill> : null}
          </div>
        )}
      >
        <div className="fpa-l3-business-toolbar">
          <label className="field-block fpa-l3-business-section-field">
            <span>Jump to workbook section</span>
            <select value={activeSectionId} onChange={(event) => setActiveSectionId(event.target.value)}>
              {workbookView.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.code} | {section.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="fpa-l3-business-section-note">
          <span className="section-chip">{activeSection.rowRange}</span>
          <p className="section-note">{activeSection.note}</p>
        </div>

        {renderActiveSection()}
      </SectionCard>
    </div>
  );
}
