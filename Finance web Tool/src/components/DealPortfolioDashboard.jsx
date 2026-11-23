import { useMemo } from "react";
import {
  completionPercent,
  scopedTowerCount,
  towerCompletionPercent,
} from "../utils/dealMaster";

const TERMINAL_STATUSES = new Set(["Won", "Lost", "Archived"]);
const REVIEW_WATERMARKS = new Set(["READY WITH REVIEW ITEMS", "SUBMIT-READY"]);
const REVIEW_STATUSES = new Set(["In Review", "Approved for Submission", "Submitted"]);
const TOWER_META = [
  { code: "FPA", label: "FP&A", tone: "blue" },
  { code: "RTR", label: "RTR", tone: "teal" },
  { code: "O2C", label: "O2C", tone: "amber" },
  { code: "P2P", label: "P2P", tone: "indigo" },
];
const STATUS_ACCENTS = ["blue", "teal", "amber", "indigo", "red"];

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function buildProfileInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "DL";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function isReviewDeal(deal) {
  return REVIEW_WATERMARKS.has(String(deal?.watermark || "")) || REVIEW_STATUSES.has(String(deal?.dealStatus || ""));
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function formatShortDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateDistance(value) {
  if (!value) {
    return "Date pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date pending";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays > 0) {
    return `${diffDays}d to go`;
  }

  return `${Math.abs(diffDays)}d ago`;
}

function stageTone(label) {
  const value = String(label || "").toLowerCase();

  if (value.includes("won") || value.includes("approved")) {
    return "success";
  }

  if (value.includes("review") || value.includes("submitted") || value.includes("sizing")) {
    return "info";
  }

  if (value.includes("lost") || value.includes("archived")) {
    return "danger";
  }

  return "warning";
}

function sortGroupRows(rows) {
  return rows.sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }

    return left.label.localeCompare(right.label);
  });
}

function buildGroupedRows(items, getKey, getMeta) {
  const groups = new Map();

  items.forEach((item) => {
    const key = getKey(item) || "Not Tagged";
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  });

  return sortGroupRows(
    Array.from(groups.entries()).map(([label, rows], index) => ({
      label,
      value: rows.length,
      tone: STATUS_ACCENTS[index % STATUS_ACCENTS.length],
      meta: typeof getMeta === "function" ? getMeta(rows, label) : null,
    })),
  );
}

function DashboardMetric({ label, value, note, tone = "blue" }) {
  return (
    <article className={`deal-portfolio-kpi deal-portfolio-tone-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function BarListCard({ title, note, rows, emptyText = "No data yet." }) {
  const maxValue = rows.length ? Math.max(...rows.map((row) => row.value), 1) : 1;

  return (
    <article className="deal-portfolio-panel">
      <div className="deal-portfolio-panel-head">
        <div>
          <p className="section-kicker">Portfolio Cut</p>
          <h4>{title}</h4>
        </div>
        {note ? <span className="section-chip">{note}</span> : null}
      </div>

      {rows.length ? (
        <div className="deal-portfolio-bar-list">
          {rows.map((row) => {
            const width = Math.max((row.value / maxValue) * 100, 10);
            return (
              <div key={row.label} className="deal-portfolio-bar-row">
                <div className="deal-portfolio-bar-copy">
                  <span className="deal-portfolio-bar-label">{row.label}</span>
                  {row.meta ? <span className="deal-portfolio-bar-meta">{row.meta}</span> : null}
                </div>
                <div className="deal-portfolio-bar-track" aria-hidden="true">
                  <span className={`deal-portfolio-bar-fill is-${row.tone || "blue"}`} style={{ width: `${width}%` }} />
                </div>
                <strong>{row.value}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted-copy">{emptyText}</p>
      )}
    </article>
  );
}

function OpenDealButton({ dealId, onOpenDeal }) {
  if (typeof onOpenDeal !== "function") {
    return null;
  }

  return (
    <button type="button" className="deal-portfolio-open-btn" onClick={() => onOpenDeal(dealId)}>
      Open
    </button>
  );
}

export default function DealPortfolioDashboard({
  deals = [],
  allDeals = [],
  currentUserId = "",
  title = "Presales Dashboard",
  subtitle = "Live cockpit built directly from the portal deal master, tower scope, collaborator, and readiness data.",
  filterLabel = "All Deals",
  isStandalone = false,
  onOpenDeal = null,
  onOpenFullDashboard = null,
}) {
  const portfolio = useMemo(() => {
    const visibleDeals = Array.isArray(deals) ? deals : [];
    const totalUniverse = Array.isArray(allDeals) && allDeals.length ? allDeals.length : visibleDeals.length;
    const today = normalizeDate(new Date()) || new Date();
    const dayMs = 86400000;

    const signalRows = visibleDeals.map((deal) => {
      const readiness = completionPercent(deal);
      const towers = scopedTowerCount(deal);
      const collaboratorCount = Array.isArray(deal?.collaborators) ? deal.collaborators.length : 0;
      const bidDate = normalizeDate(deal?.bidDate);
      const updatedDate = normalizeDate(deal?.updatedAt || deal?.createdAt);
      const daysToBid = bidDate ? Math.round((bidDate.getTime() - today.getTime()) / dayMs) : null;
      const daysSinceUpdate = updatedDate ? Math.round((today.getTime() - updatedDate.getTime()) / dayMs) : null;
      const active = !TERMINAL_STATUSES.has(String(deal?.dealStatus || ""));
      const review = isReviewDeal(deal);
      const overdue = active && daysToBid !== null && daysToBid < 0;
      const dueIn7Days = active && daysToBid !== null && daysToBid >= 0 && daysToBid <= 7;
      const dueIn14Days = active && daysToBid !== null && daysToBid >= 0 && daysToBid <= 14;
      const dueIn30Days = active && daysToBid !== null && daysToBid >= 0 && daysToBid <= 30;
      const stale = active && daysSinceUpdate !== null && daysSinceUpdate >= 14;
      const lowReadiness = active && readiness < 50;
      const unstaffed = active && collaboratorCount === 0;

      let riskScore = 0;
      const reasons = [];

      if (overdue) {
        riskScore += 4;
        reasons.push(`${Math.abs(daysToBid)}d overdue`);
      } else if (dueIn7Days) {
        riskScore += 2;
        reasons.push(`${daysToBid}d to bid`);
      } else if (dueIn14Days) {
        riskScore += 1;
        reasons.push(`${daysToBid}d to bid`);
      }

      if (readiness < 50) {
        riskScore += 3;
        reasons.push(`${readiness}% readiness`);
      } else if (readiness < 75) {
        riskScore += 1;
        reasons.push(`${readiness}% readiness`);
      }

      if (review) {
        riskScore += 1;
        reasons.push(deal?.watermark || deal?.dealStatus || "Review queue");
      }

      if (unstaffed) {
        riskScore += 1;
        reasons.push("No collaborator tagged");
      }

      if (towers >= 3 && readiness < 70) {
        riskScore += 1;
        reasons.push(`${towers} towers in scope`);
      }

      return {
        id: deal.id,
        deal,
        title: deal.draftLabel || deal.dealId || "Untitled Deal",
        client: deal.clientName || "Client pending",
        owner: deal.dealOwnerName || deal.presalesLead || "Owner TBD",
        status: deal.dealStatus || "Not Tagged",
        watermark: deal.watermark || "No watermark",
        readiness,
        towers,
        active,
        review,
        collaboratorCount,
        daysToBid,
        daysSinceUpdate,
        overdue,
        dueIn7Days,
        dueIn14Days,
        dueIn30Days,
        stale,
        lowReadiness,
        unstaffed,
        atRisk: active && riskScore >= 3,
        riskScore,
        updatedAt: deal.updatedAt || deal.createdAt || "",
        reasons: reasons.slice(0, 3),
      };
    });

    const activeSignalRows = signalRows.filter((row) => row.active);

    const activeDeals = activeSignalRows.map((row) => row.deal);
    const reviewDeals = signalRows.filter((row) => row.review).map((row) => row.deal);
    const avgReadiness = clampPercent(average(signalRows.map((row) => row.readiness)));
    const avgTowerCoverage = Number(average(signalRows.map((row) => row.towers)).toFixed(1));
    const uniqueCollaborators = new Set(
      visibleDeals.flatMap((deal) =>
        Array.isArray(deal?.collaborators)
          ? deal.collaborators.map((collaborator) => String(collaborator?.email || collaborator?.name || "").trim()).filter(Boolean)
          : [],
      ),
    );

    const stageRows = buildGroupedRows(visibleDeals, (deal) => deal?.dealStatus, (rows) => `${clampPercent(average(rows.map((deal) => completionPercent(deal))))}% avg readiness`);
    const watermarkRows = buildGroupedRows(visibleDeals, (deal) => deal?.watermark, (rows, label) => {
      const inFlight = rows.filter((deal) => !TERMINAL_STATUSES.has(String(deal?.dealStatus || ""))).length;
      return `${inFlight} active · ${label}`;
    });

    const towerRows = TOWER_META.map((tower) => {
      const scopedDeals = visibleDeals.filter((deal) => Boolean(deal?.[`towerScope_${tower.code}`]));
      const avgProgress = scopedDeals.length
        ? clampPercent(average(scopedDeals.map((deal) => towerCompletionPercent(deal, tower.code))))
        : 0;

      return {
        label: tower.label,
        value: scopedDeals.length,
        tone: tower.tone,
        meta: scopedDeals.length ? `${avgProgress}% avg progress` : "No deal in scope",
      };
    });

    const ownerGroups = new Map();
    visibleDeals.forEach((deal) => {
      const key = String(deal?.dealOwnerName || deal?.presalesLead || "Owner TBD").trim() || "Owner TBD";
      const current = ownerGroups.get(key) || [];
      current.push(deal);
      ownerGroups.set(key, current);
    });

    const ownerRows = sortGroupRows(
      Array.from(ownerGroups.entries()).map(([label, rows], index) => ({
        label,
        value: rows.length,
        tone: STATUS_ACCENTS[index % STATUS_ACCENTS.length],
        meta: `${rows.filter((deal) => deal?.dealOwnerUserId === currentUserId).length} mine · ${clampPercent(average(rows.map((deal) => completionPercent(deal))))}% avg`,
      })),
    ).slice(0, 5);

    const dueIn7Count = activeSignalRows.filter((row) => row.dueIn7Days).length;
    const overdueCount = activeSignalRows.filter((row) => row.overdue).length;
    const dueIn30Count = activeSignalRows.filter((row) => row.dueIn30Days).length;
    const staleCount = activeSignalRows.filter((row) => row.stale).length;
    const lowReadinessCount = activeSignalRows.filter((row) => row.lowReadiness).length;
    const unstaffedCount = activeSignalRows.filter((row) => row.unstaffed).length;
    const atRiskCount = activeSignalRows.filter((row) => row.atRisk).length;

    const milestoneRows = signalRows
      .filter((row) => row.daysToBid !== null)
      .map((row) => ({
        id: row.id,
        title: row.title,
        client: row.client,
        dateValue: row.daysToBid,
        dateLabel: formatShortDate(row.deal?.bidDate),
        relativeLabel: formatDateDistance(row.deal?.bidDate),
        status: row.status,
      }))
      .sort((left, right) => left.dateValue - right.dateValue)
      .slice(0, 6);

    const attentionRows = activeSignalRows
      .map((row) => {
        const fallbackReasons = [];

        if (!row.reasons.length) {
          if (row.daysToBid !== null) {
            fallbackReasons.push(formatDateDistance(row.deal?.bidDate));
          }

          if (row.daysSinceUpdate !== null) {
            fallbackReasons.push(`Updated ${row.daysSinceUpdate}d ago`);
          }
        }

        return {
          id: row.id,
          title: row.title,
          client: row.client,
          readiness: row.readiness,
          status: row.status,
          watermark: row.watermark,
          reasons: (row.reasons.length ? row.reasons : fallbackReasons).slice(0, 3).join(" · "),
          score: row.riskScore,
          daysToBid: row.daysToBid ?? Number.POSITIVE_INFINITY,
        };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || left.daysToBid - right.daysToBid || left.readiness - right.readiness)
      .slice(0, 6);

    const liveRows = [...signalRows]
      .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
      .slice(0, 8);

    const latestUpdate = liveRows.length ? formatShortDate(liveRows[0].updatedAt) : formatShortDate(new Date().toISOString());

    return {
      totalDeals: visibleDeals.length,
      totalUniverse,
      activeDealCount: activeDeals.length,
      reviewDealCount: reviewDeals.length,
      submitReadyCount: visibleDeals.filter((deal) => String(deal?.watermark || "") === "SUBMIT-READY").length,
      avgReadiness,
      avgTowerCoverage,
      uniqueCollaboratorCount: uniqueCollaborators.size,
      dueIn7Count,
      overdueCount,
      dueIn30Count,
      staleCount,
      lowReadinessCount,
      unstaffedCount,
      atRiskCount,
      latestUpdate,
      stageRows,
      watermarkRows,
      towerRows,
      ownerRows,
      milestoneRows,
      attentionRows,
      liveRows,
    };
  }, [allDeals, currentUserId, deals]);

  if (!portfolio.totalDeals) {
    return (
      <section className={`deal-portfolio-dashboard-page ${isStandalone ? "is-standalone" : "is-inline"}`.trim()}>
        <div className="compact-card deal-portfolio-dashboard deal-portfolio-empty-state">
          <p className="section-kicker">Live Presales Cockpit</p>
          <h3>{title}</h3>
          <p className="page-copy">No deals are visible in this view yet, so the dynamic dashboard has nothing to summarise.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`deal-portfolio-dashboard-page ${isStandalone ? "is-standalone" : "is-inline"}`.trim()} aria-label={title}>
      <div className={`compact-card deal-portfolio-dashboard ${isStandalone ? "is-standalone" : "is-inline"}`.trim()}>
        <div className="deal-portfolio-head">
          <div className="deal-portfolio-copy">
            <p className="section-kicker">Live Presales Cockpit</p>
            <h3>{title}</h3>
            <p className="page-copy">{subtitle}</p>
          </div>
          <div className="deal-portfolio-head-meta">
            <span className="section-chip">{filterLabel} · {portfolio.totalDeals}/{portfolio.totalUniverse} deals</span>
            <StatusPill tone="info">Updated {portfolio.latestUpdate}</StatusPill>
            {!isStandalone && typeof onOpenFullDashboard === "function" ? (
              <button type="button" className="btn btn-secondary" onClick={onOpenFullDashboard}>
                Open Full Dashboard
              </button>
            ) : null}
          </div>
        </div>

        <div className="deal-portfolio-kpi-grid">
          <DashboardMetric label="Visible Deals" value={portfolio.totalDeals} note={`${portfolio.totalUniverse} total available in portal`} tone="blue" />
          <DashboardMetric label="Active Pursuits" value={portfolio.activeDealCount} note="Deals not marked won, lost, or archived" tone="teal" />
          <DashboardMetric label="Review Queue" value={portfolio.reviewDealCount} note="Submission or review attention needed" tone="amber" />
          <DashboardMetric label="Submit Ready" value={portfolio.submitReadyCount} note="Watermark already in submit-ready state" tone="indigo" />
          <DashboardMetric label="Avg Readiness" value={`${portfolio.avgReadiness}%`} note="Based on the same deal-card completion logic" tone="blue" />
          <DashboardMetric label="Collaborators" value={portfolio.uniqueCollaboratorCount} note={`${portfolio.avgTowerCoverage.toFixed(1)} towers per deal on average`} tone="teal" />
        </div>

        <div className="deal-portfolio-section-head">
          <div>
            <p className="section-kicker">Action Radar</p>
            <h4>Top 6 live pressure stats</h4>
          </div>
          <span className="section-chip">Auto-derived from bid dates, readiness, updates, staffing, and review posture</span>
        </div>

        <div className="deal-portfolio-kpi-grid is-signals">
          <DashboardMetric label="Due in 7 Days" value={portfolio.dueIn7Count} note={`${portfolio.dueIn30Count} due inside the next 30 days`} tone="amber" />
          <DashboardMetric label="Overdue Bids" value={portfolio.overdueCount} note={portfolio.overdueCount ? "Past bid date but still active in pipeline" : "No active deal is past bid date"} tone="red" />
          <DashboardMetric label="At Risk" value={portfolio.atRiskCount} note="Late, low-readiness, thin staffing, or heavy-scope risk mix" tone="red" />
          <DashboardMetric label="Stale 14+ Days" value={portfolio.staleCount} note="No update for two weeks or more" tone="blue" />
          <DashboardMetric label="Low Readiness" value={portfolio.lowReadinessCount} note="Active deals still below 50% completion" tone="amber" />
          <DashboardMetric label="No Collaborators" value={portfolio.unstaffedCount} note="Active deals with no support team tagged" tone="indigo" />
        </div>

        <div className="deal-portfolio-grid deal-portfolio-grid-top">
          <BarListCard title="Pipeline by status" note="Current portal dealStatus values" rows={portfolio.stageRows} />
          <BarListCard title="Health and submission mix" note="Watermark and review posture" rows={portfolio.watermarkRows} />
          <BarListCard title="Tower scope coverage" note="Deals carrying each tower in scope" rows={portfolio.towerRows} />
        </div>

        <div className="deal-portfolio-grid deal-portfolio-grid-bottom">
          <article className="deal-portfolio-panel deal-portfolio-panel-wide">
            <div className="deal-portfolio-panel-head">
              <div>
                <p className="section-kicker">Live Table</p>
                <h4>Active deal board</h4>
              </div>
              <span className="section-chip">Portal-backed rows</span>
            </div>

            <div className="deal-portfolio-table-wrap">
              <table className="deal-portfolio-table">
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Readiness</th>
                    <th>Towers</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.liveRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="deal-portfolio-deal-cell">
                          <span className="deal-portfolio-avatar" aria-hidden="true">{buildProfileInitials(row.client || row.title)}</span>
                          <div>
                            <strong>{row.title}</strong>
                            <span>{row.client}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="deal-portfolio-status-stack">
                          <StatusPill tone={stageTone(row.status)}>{row.status}</StatusPill>
                          <span className="deal-portfolio-watermark">{row.watermark}</span>
                        </div>
                      </td>
                      <td>{row.owner}</td>
                      <td>
                        <div className="deal-portfolio-readiness-cell">
                          <strong>{row.readiness}%</strong>
                          <span className="deal-portfolio-mini-track" aria-hidden="true">
                            <span style={{ width: `${Math.max(row.readiness, 8)}%` }} />
                          </span>
                        </div>
                      </td>
                      <td>{row.towers}</td>
                      <td><OpenDealButton dealId={row.id} onOpenDeal={onOpenDeal} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="deal-portfolio-side-stack">
            <article className="deal-portfolio-panel">
              <div className="deal-portfolio-panel-head">
                <div>
                  <p className="section-kicker">Milestones</p>
                  <h4>Bid timeline watch</h4>
                </div>
                <span className="section-chip">Bid date from deal master</span>
              </div>

              <div className="deal-portfolio-mini-table">
                {portfolio.milestoneRows.map((row) => (
                  <div key={`${row.id}-milestone`} className="deal-portfolio-mini-row">
                    <div>
                      <strong>{row.title}</strong>
                      <span>{row.client}</span>
                    </div>
                    <div className="deal-portfolio-mini-meta">
                      <strong>{row.dateLabel}</strong>
                      <span>{row.relativeLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="deal-portfolio-panel">
              <div className="deal-portfolio-panel-head">
                <div>
                  <p className="section-kicker">Attention</p>
                  <h4>Priority watchlist</h4>
                </div>
                <span className="section-chip">Derived from readiness and review state</span>
              </div>

              <div className="deal-portfolio-mini-table">
                {portfolio.attentionRows.map((row) => (
                  <div key={`${row.id}-attention`} className="deal-portfolio-mini-row is-attention">
                    <div>
                      <strong>{row.title}</strong>
                      <span>{row.client}</span>
                    </div>
                    <div className="deal-portfolio-mini-meta is-left">
                      <strong>{row.status}</strong>
                      <span>{row.reasons}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <BarListCard title="Owner load" note="Current visible deals by owner" rows={portfolio.ownerRows} emptyText="No owners tagged yet." />
          </div>
        </div>
      </div>
    </section>
  );
}

