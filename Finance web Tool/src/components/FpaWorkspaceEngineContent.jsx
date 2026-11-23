import {
  countCompletedFpaGovernanceChecks,
  createDefaultFpaWorkspace,
  FPA_APPROVAL_STAGE_OPTIONS,
  FPA_BENCHMARK_OPTIONS,
  FPA_PERSONAS,
  normalizeFpaWorkspace,
} from "../config/fpaWorkspace";
import { deriveFpaEngine } from "../config/fpaEngine";

const PERSONA_OPTIONS = FPA_PERSONAS.map((persona) => ({ value: persona.id, label: persona.label }));

const BENCHMARK_FIELD_DEFS = [
  { label: "Benchmark Percentile", name: "benchmarkPercentile", type: "select", options: FPA_BENCHMARK_OPTIONS.benchmarkPercentile },
  { label: "Benchmark Region", name: "benchmarkRegion", type: "select", options: FPA_BENCHMARK_OPTIONS.benchmarkRegion },
  { label: "Workload Confidence", name: "workloadConfidence", type: "select", options: FPA_BENCHMARK_OPTIONS.workloadConfidence },
  { label: "Evidence Mode", name: "evidenceMode", type: "select", options: FPA_BENCHMARK_OPTIONS.evidenceMode },
  { label: "Planning Cycles / Year", name: "planningCyclesPerYear", type: "number", step: "1" },
  { label: "Forecast Cycles / Year", name: "forecastCyclesPerYear", type: "number", step: "1" },
  { label: "Management Reports / Month", name: "managementReportsPerMonth", type: "number", step: "1" },
  { label: "Scenario Bursts / Quarter", name: "scenarioBurstsPerQuarter", type: "number", step: "1" },
  { label: "Benchmark Adjustment %", name: "benchmarkAdjustmentPct", type: "number", step: "0.1" },
  { label: "Productivity Floor %", name: "productivityFloorPct", type: "number", step: "1" },
];

const AI_BENEFIT_FIELD_DEFS = [
  { label: "Addressable Automation %", name: "addressableAutomationPct", type: "number", step: "1" },
  { label: "GenAI Narrative %", name: "genAiNarrativePct", type: "number", step: "1" },
  { label: "Self-Service Shift %", name: "selfServiceShiftPct", type: "number", step: "1" },
  { label: "Control Residual %", name: "controlResidualPct", type: "number", step: "1" },
  { label: "Adoption Ramp Months", name: "adoptionRampMonths", type: "number", step: "1" },
  { label: "Business Partner Acceleration %", name: "businessPartnerAccelerationPct", type: "number", step: "1" },
];

const OPS_MODEL_FIELD_DEFS = [
  { label: "Selected Persona", name: "selectedPersonaId", type: "select", options: PERSONA_OPTIONS },
  { label: "Delivery Shape", name: "deliveryShape", type: "select", options: FPA_BENCHMARK_OPTIONS.deliveryShape },
  { label: "Onshore %", name: "onshorePct", type: "number", step: "1" },
  { label: "Nearshore %", name: "nearshorePct", type: "number", step: "1" },
  { label: "Offshore %", name: "offshorePct", type: "number", step: "1" },
  { label: "Manager Span", name: "managerSpan", type: "number", step: "1" },
  { label: "Utilisation %", name: "utilisationPct", type: "number", step: "1" },
  { label: "Retained Org %", name: "retainedOrgPct", type: "number", step: "1" },
  { label: "Quality Buffer %", name: "qualityBufferPct", type: "number", step: "1" },
];

const RATE_CARD_FIELD_DEFS = [
  { label: "Analyst Rate / Hour", name: "analystRateUsd", type: "number", step: "0.1" },
  { label: "Senior Analyst Rate / Hour", name: "seniorRateUsd", type: "number", step: "0.1" },
  { label: "Tower Lead Rate / Hour", name: "leadRateUsd", type: "number", step: "0.1" },
  { label: "Solution Architect Rate / Hour", name: "architectRateUsd", type: "number", step: "0.1" },
  { label: "Transition Rate Multiplier", name: "transitionRateMultiplier", type: "number", step: "0.01" },
  { label: "Transformation Pod Cost", name: "transformationPodCostUsd", type: "number", step: "1000" },
];

const PRICING_FIELD_DEFS = [
  { label: "Target Margin %", name: "targetMarginPct", type: "number", step: "0.5" },
  { label: "Floor Margin %", name: "floorMarginPct", type: "number", step: "0.5" },
  { label: "Strategic Discount %", name: "strategicDiscountPct", type: "number", step: "0.5" },
  { label: "Gainshare %", name: "gainsharePct", type: "number", step: "0.5" },
  { label: "Volume Risk Buffer %", name: "volumeRiskBufferPct", type: "number", step: "0.5" },
];

const TRANSITION_FIELD_DEFS = [
  { label: "Transition Months", name: "transitionMonths", type: "number", step: "1" },
  { label: "Knowledge Transfer Weeks", name: "knowledgeTransferWeeks", type: "number", step: "1" },
  { label: "Stabilization Weeks", name: "stabilizationWeeks", type: "number", step: "1" },
  { label: "Digital Sprints", name: "digitalSprints", type: "number", step: "1" },
  { label: "Travel & Enablement", name: "travelEnablementUsd", type: "number", step: "1000" },
];

const GOVERNANCE_FIELD_DEFS = [
  { label: "Approval Stage", name: "approvalStage", type: "select", options: FPA_APPROVAL_STAGE_OPTIONS },
  { label: "Evidence Coverage %", name: "evidenceCoveragePct", type: "number", step: "1" },
  { label: "Benchmark Corroboration %", name: "benchmarkCorroborationPct", type: "number", step: "1" },
  { label: "Override Count", name: "overrideCount", type: "number", step: "1" },
  { label: "Governance Notes", name: "changeNote", type: "textarea" },
];

const GOVERNANCE_CHECK_FIELDS = [
  {
    name: "qaReviewComplete",
    label: "QA review complete",
    detail: "Sizing logic, assumptions, and workbook parity have been internally checked.",
  },
  {
    name: "financeLeadershipReview",
    label: "Finance leadership review",
    detail: "Tower economics and operating posture have been reviewed by finance leadership.",
  },
  {
    name: "clientEvidenceValidated",
    label: "Client evidence validated",
    detail: "Client data points, proxy assumptions, and discovery signals have been validated.",
  },
  {
    name: "benchmarkPackReady",
    label: "Benchmark pack ready",
    detail: "Peer benchmark references and commentary are ready for governance and client review.",
  },
  {
    name: "calibrationComplete",
    label: "Calibration complete",
    detail: "Modeled FTE and cost outputs have been calibrated against the current-state baseline.",
  },
];

const CHANGE_LOG_FIELD_DEFS = [
  { label: "Latest Change Summary", name: "latestChangeSummary", type: "textarea" },
  { label: "Last Reviewer", name: "lastReviewer", type: "text" },
  { label: "Last Decision", name: "lastDecision", type: "text" },
  { label: "Version Note", name: "versionNote", type: "textarea" },
];

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
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

function TextField({ label, name, value, onChange, type = "text", step, disabled = false }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <input name={name} type={type} step={step} value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, name, value, onChange, disabled = false }) {
  return (
    <label className="field-block field-block-full">
      <span>{label}</span>
      <textarea name={name} value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)} />
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

function ToggleCardField({ label, detail, checked, onChange, disabled = false }) {
  return (
    <label className={`fpa-toggle-card ${checked ? "is-checked" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </label>
  );
}

function SectionCard({ badge, title, note, status, statusTone = "info", children }) {
  return (
    <article className="compact-card fpa-subpanel">
      <div className="step-header">
        <div>
          <span className="step-badge">{badge}</span>
          <h4>{title}</h4>
          {note ? <p className="section-note">{note}</p> : null}
        </div>
        {status ? <StatusPill tone={statusTone}>{status}</StatusPill> : null}
      </div>
      {children}
    </article>
  );
}

function KpiGrid({ items }) {
  return (
    <div className="fpa-kpi-grid">
      {items.map((item) => (
        <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
      ))}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="fpa-bullet-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function DataTable({ rows, columns, emptyMessage = "No records available yet." }) {
  if (!rows.length) {
    return <p className="section-note">{emptyMessage}</p>;
  }

  return (
    <div className="fpa-table-wrap">
      <table className="fpa-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={column.align === "right" ? "is-number" : ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowKey = row.id || row.label || row.item || row.phase || row.output || row.scenario || row.when || index;
            return (
              <tr key={`${rowKey}-${index}`}>
                {columns.map((column) => (
                  <td key={column.label} className={column.align === "right" ? "is-number" : ""}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return numeric.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  const absolute = formatNumber(Math.abs(numeric), 0);
  return numeric < 0 ? `-USD ${absolute}` : `USD ${absolute}`;
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function formatFactor(value) {
  return formatNumber(value, 3);
}

function formatMaybe(value, fallback = "-") {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  if (value === 0) {
    return "0";
  }

  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

function formatDateLike(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskTone(severity) {
  if (severity === "High") {
    return "warning";
  }

  if (severity === "Medium") {
    return "info";
  }

  return "success";
}

function confidenceTone(score) {
  if (score >= 75) {
    return "success";
  }

  if (score >= 55) {
    return "info";
  }

  return "warning";
}

function recommendationTone(stance) {
  if (stance === "Advance") {
    return "success";
  }

  if (stance === "Calibrate") {
    return "info";
  }

  return "warning";
}

function benchmarkPackTone(status) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("corroborated")) {
    return "success";
  }

  if (text.includes("working") || text.includes("partial") || text.includes("build-up")) {
    return "info";
  }

  return "neutral";
}

function formatDashboardCard(card) {
  if (["Annual Run Cost", "Recommended Price", "Annual Savings"].includes(card.label)) {
    return formatCurrency(card.value);
  }

  if (card.label === "Delivery FTE") {
    return formatNumber(card.value, 2);
  }

  return typeof card.value === "number" ? formatNumber(card.value, 0) : formatMaybe(card.value);
}

export default function FpaWorkspaceEngineContent({
  activeTab,
  currentDeal,
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateWorkspace,
}) {
  const workspace = normalizeFpaWorkspace(fpaWorkspace || createDefaultFpaWorkspace());
  const engine = deriveFpaEngine(currentDeal || {}, workspace);
  const governanceChecksCompleted = countCompletedFpaGovernanceChecks(workspace);
  const fieldDisabled = !canEditFpa || isBusy;
  const businessViewRows = [...engine.scopeRows].sort(
    (left, right) => Number(right.selected) - Number(left.selected) || left.family.localeCompare(right.family) || left.label.localeCompare(right.label),
  );

  function updateSectionValue(section, field, value) {
    if (!onUpdateWorkspace) {
      return;
    }

    const nextWorkspace = normalizeFpaWorkspace(workspace);
    nextWorkspace[section] = {
      ...nextWorkspace[section],
      [field]: value,
    };
    onUpdateWorkspace(nextWorkspace);
  }

  function updateSectionFlag(section, field, checked) {
    if (!onUpdateWorkspace) {
      return;
    }

    const nextWorkspace = normalizeFpaWorkspace(workspace);
    nextWorkspace[section] = {
      ...nextWorkspace[section],
      [field]: checked,
    };
    onUpdateWorkspace(nextWorkspace);
  }

  function renderField(section, field) {
    const value = workspace[section]?.[field.name] ?? "";

    if (field.type === "textarea") {
      return <TextAreaField key={field.name} label={field.label} name={field.name} value={value} disabled={fieldDisabled} onChange={(name, nextValue) => updateSectionValue(section, name, nextValue)} />;
    }

    if (field.type === "select") {
      return <SelectField key={field.name} label={field.label} name={field.name} value={value} disabled={fieldDisabled} options={field.options} onChange={(name, nextValue) => updateSectionValue(section, name, nextValue)} />;
    }

    return <TextField key={field.name} label={field.label} name={field.name} type={field.type} step={field.step} value={value} disabled={fieldDisabled} onChange={(name, nextValue) => updateSectionValue(section, name, nextValue)} />;
  }

  const benchmarkPackColumns = [
    { label: "Item", key: "item" },
    {
      label: "Status",
      key: "status",
      render: (row) => <StatusPill tone={benchmarkPackTone(row.status)}>{row.status}</StatusPill>,
    },
    { label: "Note", key: "note" },
  ];

  const roleRateColumns = [
    { label: "Role", key: "roleLabel" },
    { label: "Share %", key: "sharePct", align: "right", render: (row) => formatPercent(row.sharePct, 1) },
    { label: "Hourly Rate", key: "hourlyRate", align: "right", render: (row) => formatCurrency(row.hourlyRate) },
    { label: "Annual Cost", key: "annualCost", align: "right", render: (row) => formatCurrency(row.annualCost) },
  ];

  const roleFteColumns = [
    { label: "Role", key: "roleLabel" },
    { label: "Hours", key: "hours", align: "right", render: (row) => formatNumber(row.hours, 0) },
    { label: "FTE", key: "fte", align: "right", render: (row) => formatNumber(row.fte, 2) },
    { label: "Share %", key: "sharePct", align: "right", render: (row) => formatPercent(row.sharePct, 1) },
  ];

  const costBreakdownRows = [
    { id: "run", layer: "Annual Run Cost", amount: engine.annualRunCost, detail: "Role-based delivery cost inclusive of quality buffer." },
    { id: "quality", layer: "Quality Buffer", amount: engine.qualityBufferCost, detail: "Embedded quality, governance, and coverage overlay." },
    { id: "transition", layer: "Transition Cost", amount: engine.transitionCost, detail: "Mobilization, knowledge transfer, stabilization, and travel." },
    { id: "transform", layer: "Transformation Cost", amount: engine.transformationCost, detail: "Digital sprint pods and transformation capacity." },
    { id: "year1", layer: "First Year Cost", amount: engine.firstYearCost, detail: "Run + transition + transformation for year zero and year one entry." },
  ];

  switch (activeTab.id) {
    case "fpa-04-benchmarks":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Benchmarks"
            title="Reference norms and workload controls"
            note="These settings reproduce the benchmark posture before workload demand is built from selected FP&A scope."
            status={`${engine.resolvedBenchmarkPolicy} anchor`}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{BENCHMARK_FIELD_DEFS.map((field) => renderField("benchmarks", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Resolved Policy", value: engine.resolvedBenchmarkPolicy, note: "Uses Deal Master policy when the tab stays on deal policy." },
              { label: "Benchmark Factor", value: formatFactor(engine.benchmarkFactor), note: "Combined percentile, region, confidence, and manual benchmark adjustment." },
              { label: "Business Scale Units", value: formatNumber(engine.businessScaleUnits, 1), note: "Composite workload scale synthesized from discovery proxies." },
              { label: "Productivity Floor", value: formatPercent(workspace.benchmarks.productivityFloorPct, 0), note: "Minimum sustainable productivity anchor used in the benchmark pack." },
            ]}
          />

          <SectionCard
            badge="Pack"
            title="Benchmark pack readiness"
            note="This pack becomes the defensibility narrative for the workload engine and commercial review."
            status={`${governanceChecksCompleted}/5 governance checks`}
            statusTone={governanceChecksCompleted >= 3 ? "success" : "info"}
          >
            <DataTable rows={engine.benchmarkPack} columns={benchmarkPackColumns} />
          </SectionCard>
        </div>
      );

    case "fpa-05-workload":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Benchmark Hours", value: formatNumber(engine.totalBenchmarkHours, 0), note: "Raw benchmark demand before complexity and AI treatment." },
              { label: "Gross Hours", value: formatNumber(engine.totalGrossHours, 0), note: "Benchmark demand after complexity loading." },
              { label: "AI Hours Saved", value: formatNumber(engine.totalAiHoursSaved, 0), note: "Hours removed through automation, narrative generation, and self-service." },
              { label: "Net Hours", value: formatNumber(engine.totalNetHours, 0), note: "Demand that converts into delivery FTE and run-state cost." },
            ]}
          />

          <SectionCard
            badge="Families"
            title="Family-level workload build"
            note="Each process family rolls up selected L2 processes into benchmark, gross, AI-adjusted, and final net hours."
            status={`${engine.scopeCount} selected L2 processes`}
            statusTone={engine.scopeCount > 0 ? "success" : "warning"}
          >
            <DataTable
              rows={engine.familyBreakdown}
               emptyMessage="Select at least one source-backed L2 or L3 scope process to build the family workload view."
              columns={[
                { label: "Family", key: "family" },
                { label: "Scope Count", key: "scopeCount", align: "right", render: (row) => formatNumber(row.scopeCount, 0) },
                { label: "Benchmark Hours", key: "benchmarkHours", align: "right", render: (row) => formatNumber(row.benchmarkHours, 0) },
                { label: "Gross Hours", key: "grossHours", align: "right", render: (row) => formatNumber(row.grossHours, 0) },
                { label: "AI Saved", key: "aiHoursSaved", align: "right", render: (row) => formatNumber(row.aiHoursSaved, 0) },
                { label: "Net Hours", key: "netHours", align: "right", render: (row) => formatNumber(row.netHours, 0) },
              ]}
            />
          </SectionCard>

          <SectionCard
            badge="Detail"
            title="L3 workload detail"
            note="These rows mirror the workbook accumulation by FP&A process line."
            status={`${engine.selectedScopeRows.length} workload rows`}
            statusTone={engine.selectedScopeRows.length > 0 ? "success" : "info"}
          >
            <DataTable
              rows={engine.selectedScopeRows}
               emptyMessage="No activity-level L3 scope lines are selected yet. The tower may still be running on L2-backed scope only."
              columns={[
                { label: "Process", key: "label" },
                { label: "Family", key: "family" },
                { label: "Benchmark Hours", key: "benchmarkHours", align: "right", render: (row) => formatNumber(row.benchmarkHours, 0) },
                { label: "Gross Hours", key: "grossHours", align: "right", render: (row) => formatNumber(row.grossHours, 0) },
                { label: "AI Reduction", key: "aiReductionPct", align: "right", render: (row) => formatPercent(row.aiReductionPct, 1) },
                { label: "Net Hours", key: "netHours", align: "right", render: (row) => formatNumber(row.netHours, 0) },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-06-complexity":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Complexity Multiplier", value: formatFactor(engine.complexityMultiplier), note: "Applied to benchmark workload before AI savings are modeled." },
              { label: "Complexity Score", value: formatNumber(engine.complexityScore, 1), note: "Summed from the current structural, platform, and commercial drivers." },
              { label: "Complexity Band", value: engine.complexityCategory, note: "Low through Very High band used for transition and risk posture." },
              { label: "Business Scale Units", value: formatNumber(engine.businessScaleUnits, 1), note: "Scale of the client footprint feeding the workload engine." },
            ]}
          />

          <SectionCard
            badge="Drivers"
            title="Complexity scoring drivers"
            note="These are the workbook-equivalent drivers raising or lowering the effective workload multiplier."
            status={engine.topComplexityDrivers[0]?.label || "Working"}
            statusTone="info"
          >
            <DataTable
              rows={engine.complexityDrivers}
              columns={[
                { label: "Driver", key: "label" },
                { label: "Score", key: "score", align: "right", render: (row) => formatNumber(row.score, 1) },
                { label: "Detail", key: "detail" },
              ]}
            />
          </SectionCard>

          <div className="review-grid">
            <article className="review-panel">
              <h4>Top three complexity drivers</h4>
              <SummaryList rows={engine.topComplexityDrivers.map((driver) => ({ label: driver.label, value: `${formatNumber(driver.score, 1)} | ${driver.detail}` }))} />
            </article>
            <article className="review-panel">
              <h4>Captured operating posture</h4>
              <SummaryList
                rows={[
                  { label: "Close Complexity", value: formatMaybe(workspace.discovery.monthlyCloseComplexity) },
                  { label: "ERP Landscape", value: formatMaybe(workspace.discovery.erpLandscape) },
                  { label: "EPM Tool in Place", value: formatMaybe(workspace.discovery.epmPlatform) },
                  { label: "Master Data Management", value: formatMaybe(workspace.discovery.governanceMode) },
                  { label: "Competitive Intensity", value: formatMaybe(workspace.discovery.competitiveIntensity) },
                ]}
              />
            </article>
          </div>
        </div>
      );

    case "fpa-07-personas":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Persona"
            title="Delivery persona comparison"
            note="Use this tab to choose the target operating stance before finalizing the run-state mix."
            status={engine.selectedPersona.label}
            statusTone="success"
          >
            <div className="field-grid">{renderField("opsModel", OPS_MODEL_FIELD_DEFS[0])}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Productivity Uplift", value: formatPercent(engine.selectedPersona.productivityUpliftPct, 0), note: "Selected persona productivity posture applied in the FTE engine." },
              { label: "Automation Reach", value: formatPercent(engine.selectedPersona.automationReachPct, 0), note: "Expected automation contribution for the chosen persona." },
              { label: "Retained Org", value: formatPercent(engine.selectedPersona.retainedOrgPct, 0), note: "Retained client oversight share carried in the operating model." },
              { label: "Utilisation Target", value: formatPercent(engine.selectedPersona.utilizationPct, 0), note: "Reference utilization point packaged with the persona." },
            ]}
          />

          <div className="fpa-persona-grid">
            {engine.personaComparisons.map((persona) => {
              const isActive = persona.id === engine.selectedPersona.id;
              return (
                <article key={persona.id} className={`fpa-persona-card ${isActive ? "is-active" : ""}`}>
                  <div className="step-header">
                    <div>
                      <span className="step-badge">{isActive ? "Active" : "Scenario"}</span>
                      <h4>{persona.label}</h4>
                    </div>
                    <StatusPill tone={isActive ? "success" : "neutral"}>{isActive ? "Selected" : "Compare"}</StatusPill>
                  </div>
                  <SummaryList
                    rows={[
                      { label: "Delivery FTE", value: formatNumber(persona.deliveryFte, 2) },
                      { label: "Annual Run Cost", value: formatCurrency(persona.annualRunCostUsd) },
                      { label: "Automation Reach", value: formatPercent(persona.automationReachPct, 0) },
                      { label: "Retained Org", value: formatPercent(persona.retainedOrgPct, 0) },
                    ]}
                  />
                  <p className="section-note">{persona.note}</p>
                  {canEditFpa ? (
                    <button type="button" className={`btn ${isActive ? "btn-secondary" : "btn-primary"}`} disabled={fieldDisabled || isActive} onClick={() => updateSectionValue("opsModel", "selectedPersonaId", persona.id)}>
                      {isActive ? "Active Persona" : "Use Persona"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      );

    case "fpa-08-ai-benefit":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="AI Benefit"
            title="AI levers and benefit assumptions"
            note="These inputs tune automation reach, AI narrative productivity, and self-service displacement across the FP&A workload."
            status={`${formatPercent(engine.aiSummary.baseAiReachPct, 1)} modeled AI reach`}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{AI_BENEFIT_FIELD_DEFS.map((field) => renderField("aiBenefit", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Modeled AI Reach", value: formatPercent(engine.aiSummary.baseAiReachPct, 1), note: "Blended AI reach after maturity, ramp, and residual control guardrails." },
              { label: "Addressable Hours", value: formatNumber(engine.aiSummary.addressableHours, 0), note: "Gross hours within the modeled automation addressable envelope." },
              { label: "AI Hours Saved", value: formatNumber(engine.aiSummary.totalAiHoursSaved, 0), note: "Net hours removed annually through the configured AI levers." },
              { label: "Run-Rate Savings", value: formatCurrency(engine.aiSummary.annualRunRateSavingsUsd), note: "Annualized run-rate value of the modeled AI reduction." },
            ]}
          />

          <SectionCard
            badge="Coverage"
            title="AI benefit by process family"
            note="AI benefit distribution varies by process family based on eligible work mix and delivery controls."
            status={`${engine.familyBreakdown.length} families sized`}
            statusTone={engine.familyBreakdown.length > 0 ? "success" : "info"}
          >
            <DataTable
              rows={engine.familyBreakdown}
               emptyMessage="No family workload is available until at least one source-backed L2 or L3 scope process is selected."
              columns={[
                { label: "Family", key: "family" },
                { label: "Gross Hours", key: "grossHours", align: "right", render: (row) => formatNumber(row.grossHours, 0) },
                { label: "AI Saved", key: "aiHoursSaved", align: "right", render: (row) => formatNumber(row.aiHoursSaved, 0) },
                { label: "AI Reduction %", key: "aiReductionPct", align: "right", render: (row) => formatPercent(row.aiReductionPct, 1) },
                { label: "Net Hours", key: "netHours", align: "right", render: (row) => formatNumber(row.netHours, 0) },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-09-ops-model":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Ops Model"
            title="Target delivery operating model"
            note="These settings govern location mix, utilization, retained organization, and operating buffer."
            status={workspace.opsModel.deliveryShape}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{OPS_MODEL_FIELD_DEFS.map((field) => renderField("opsModel", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Manager Count", value: formatNumber(engine.opsModelSummary.managerCount, 2), note: "Modeled managers implied by the chosen delivery span." },
              { label: "Productive Hours / FTE", value: formatNumber(engine.opsModelSummary.productiveHoursPerFte, 0), note: "Annual productive hours after utilization is applied." },
              { label: "Retained Org FTE", value: formatNumber(engine.opsModelSummary.retainedOrgFte, 2), note: "Client-side retained organization carried in the target model." },
              { label: "Managed FTE", value: formatNumber(engine.opsModelSummary.managedFte, 2), note: "Delivery plus retained-organization footprint combined." },
            ]}
          />

          <div className="review-grid">
            <article className="review-panel">
              <h4>Delivery mix</h4>
              <SummaryList
                rows={[
                  { label: "Onshore", value: formatPercent(engine.opsModelSummary.deliveryMixPct.onshore, 1) },
                  { label: "Nearshore", value: formatPercent(engine.opsModelSummary.deliveryMixPct.nearshore, 1) },
                  { label: "Offshore", value: formatPercent(engine.opsModelSummary.deliveryMixPct.offshore, 1) },
                  { label: "Quality Buffer", value: formatPercent(workspace.opsModel.qualityBufferPct, 0) },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Selected operating posture</h4>
              <SummaryList
                rows={[
                  { label: "Persona", value: engine.selectedPersona.label },
                  { label: "Delivery Shape", value: formatMaybe(workspace.opsModel.deliveryShape) },
                  { label: "Utilisation", value: formatPercent(workspace.opsModel.utilisationPct, 0) },
                  { label: "Manager Span", value: formatMaybe(workspace.opsModel.managerSpan) },
                ]}
              />
              <p className="section-note">{engine.selectedPersona.note}</p>
            </article>
          </div>
        </div>
      );

    case "fpa-10-rate-card":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Rate Card"
            title="Role rates and commercial loading"
            note="Base rates are blended with the delivery mix to produce the modeled FP&A run-state cost."
            status={`${formatCurrency(engine.blendedHourlyRate)} blended`}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{RATE_CARD_FIELD_DEFS.map((field) => renderField("rateCard", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Analyst Rate", value: formatCurrency(workspace.rateCard.analystRateUsd), note: "Base hourly rate before delivery mix weighting." },
              { label: "Senior Rate", value: formatCurrency(workspace.rateCard.seniorRateUsd), note: "Base senior-analyst hourly rate." },
              { label: "Lead Rate", value: formatCurrency(workspace.rateCard.leadRateUsd), note: "Tower-lead hourly rate." },
              { label: "Blended Hourly Rate", value: formatCurrency(engine.blendedHourlyRate), note: "Modeled blended run-rate hourly rate after role and location mix." },
            ]}
          />

          <SectionCard
            badge="Role Cost"
            title="Role-based annual cost build"
            note="The engine applies the selected persona mix and delivery shape to the entered rate card."
            status={`${engine.roleRows.length} rate rows`}
            statusTone="success"
          >
            <DataTable rows={engine.roleRows} columns={roleRateColumns} />
          </SectionCard>
        </div>
      );

    case "fpa-11-fte-engine":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Productive Hours / FTE", value: formatNumber(engine.productiveHoursPerFte, 0), note: "Annual productive capacity at the selected utilization level." },
              { label: "Gross FTE", value: formatNumber(engine.grossFte, 2), note: "FTE requirement before AI savings and persona efficiency are applied." },
              { label: "Delivery FTE", value: formatNumber(engine.deliveryFte, 2), note: "Managed-service delivery requirement after AI and persona tuning." },
              { label: "Retained Org FTE", value: formatNumber(engine.retainedOrgFte, 2), note: "Client oversight retained alongside the managed-service footprint." },
              { label: "Managed FTE", value: formatNumber(engine.opsModelSummary.managedFte, 2), note: "Combined delivery and retained-organization requirement." },
            ]}
          />

          <SectionCard
            badge="Distribution"
            title="Role-based FTE distribution"
            note="Hours and FTE are distributed through the selected persona mix."
            status={engine.selectedPersona.label}
            statusTone="info"
          >
            <DataTable rows={engine.roleRows} columns={roleFteColumns} />
          </SectionCard>

          <div className="review-grid">
            <article className="review-panel">
              <h4>Workload conversion</h4>
              <SummaryList
                rows={[
                  { label: "Benchmark Hours", value: formatNumber(engine.totalBenchmarkHours, 0) },
                  { label: "Gross Hours", value: formatNumber(engine.totalGrossHours, 0) },
                  { label: "AI Hours Saved", value: formatNumber(engine.totalAiHoursSaved, 0) },
                  { label: "Net Hours", value: formatNumber(engine.totalNetHours, 0) },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Baseline comparison</h4>
              <SummaryList
                rows={[
                  { label: "Current Tower Staff", value: formatMaybe(workspace.discovery.currentTowerStaff) },
                  { label: "Modeled Delivery FTE", value: formatNumber(engine.deliveryFte, 2) },
                  { label: "Retained Org FTE", value: formatNumber(engine.retainedOrgFte, 2) },
                  { label: "Selected Persona", value: engine.selectedPersona.label },
                ]}
              />
            </article>
          </div>
        </div>
      );

    case "fpa-12-cost":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Annual Run Cost", value: formatCurrency(engine.annualRunCost), note: "Modeled steady-state managed-services cost." },
              { label: "Quality Buffer", value: formatCurrency(engine.qualityBufferCost), note: "Governance and delivery buffer carried in the run-state cost." },
              { label: "Transition Cost", value: formatCurrency(engine.transitionCost), note: "Mobilization and stabilization cost before business-as-usual handover." },
              { label: "Transformation Cost", value: formatCurrency(engine.transformationCost), note: "Digital sprint and transformation investment layer." },
              { label: "First Year Cost", value: formatCurrency(engine.firstYearCost), note: "Run plus transition plus transformation in the first year view." },
            ]}
          />

          <SectionCard
            badge="Cost Stack"
            title="Cost stack summary"
            note="This stack explains how the annual FP&A solution cost builds from run-state economics and one-time investment layers."
            status={formatCurrency(engine.firstYearCost)}
            statusTone="info"
          >
            <DataTable
              rows={costBreakdownRows}
              columns={[
                { label: "Layer", key: "layer" },
                { label: "Amount", key: "amount", align: "right", render: (row) => formatCurrency(row.amount) },
                { label: "Detail", key: "detail" },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-13-pricing":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Pricing"
            title="Commercial levers and pricing posture"
            note="These settings control floor, target, discount pressure, and gainshare on top of the modeled run-state cost."
            status={formatCurrency(engine.recommendedPrice)}
            statusTone="success"
          >
            <div className="field-grid field-grid-4">{PRICING_FIELD_DEFS.map((field) => renderField("pricing", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Price Floor", value: formatCurrency(engine.priceFloor), note: "Walk-away price based on the configured floor margin." },
              { label: "Price Target", value: formatCurrency(engine.priceTarget), note: "Target economics before risk buffer and discount are applied." },
              { label: "Recommended Price", value: formatCurrency(engine.recommendedPrice), note: "Target price after risk buffer and commercial discount." },
              { label: "Modeled Margin", value: formatPercent(engine.marginPct, 1), note: "Resulting annual run-state margin at the recommended price point." },
              { label: "Gainshare Upside", value: formatCurrency(engine.gainshareUpside), note: "Potential upside based on the configured gainshare percentage." },
            ]}
          />

          <div className="review-grid">
            <article className="review-panel">
              <h4>Commercial settings</h4>
              <SummaryList
                rows={[
                  { label: "Target Margin", value: formatPercent(workspace.pricing.targetMarginPct, 1) },
                  { label: "Floor Margin", value: formatPercent(workspace.pricing.floorMarginPct, 1) },
                  { label: "Strategic Discount", value: formatPercent(workspace.pricing.strategicDiscountPct, 1) },
                  { label: "Volume Risk Buffer", value: formatPercent(workspace.pricing.volumeRiskBufferPct, 1) },
                  { label: "Gainshare", value: formatPercent(workspace.pricing.gainsharePct, 1) },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Commercial summary</h4>
              <SummaryList
                rows={[
                  { label: "Annual Run Cost", value: formatCurrency(engine.annualRunCost) },
                  { label: "Current Baseline", value: formatCurrency(engine.currentBaselineCost) },
                  { label: "Annual Savings", value: formatCurrency(engine.annualSavings) },
                  { label: "Recommendation", value: engine.recommendationStance },
                ]}
              />
            </article>
          </div>
        </div>
      );

    case "fpa-14-outcome":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Annual Savings", value: formatCurrency(engine.annualSavings), note: "Modeled annual savings versus the captured current-state baseline." },
              { label: "Savings %", value: formatPercent(engine.savingsPct, 1), note: "Savings percentage versus current-state baseline cost." },
              { label: "Productivity Gain %", value: formatPercent(engine.productivityGainPct, 1), note: "Modeled productivity improvement created by the target operating model." },
              { label: "Close Acceleration", value: `${formatNumber(engine.closeAccelerationDays, 1)} days`, note: "Indicative monthly close acceleration from the modeled posture." },
              { label: "Insight Cycle Reduction", value: formatPercent(engine.insightCycleReductionPct, 1), note: "Reduction in reporting and insight turnaround time." },
              { label: "Forecast Accuracy Uplift", value: formatPercent(engine.forecastAccuracyUpliftPct, 1), note: "Modeled uplift in forecast quality and business planning confidence." },
            ]}
          />

          <SectionCard
            badge="Outcomes"
            title="Outcome narrative"
            note="Use this narrative to summarize the commercial and operational impact for deal reviews and client storyline build-up."
            status={engine.recommendationStance}
            statusTone={recommendationTone(engine.recommendationStance)}
          >
            <BulletList items={engine.valueNarrative} />
          </SectionCard>
        </div>
      );

    case "fpa-15-transition":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Transition"
            title="Transition inputs and ramp shape"
            note="These assumptions define ramp length, stabilization effort, and transformation intensity before steady-state handover."
            status={`${workspace.transition.transitionMonths} months`}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{TRANSITION_FIELD_DEFS.map((field) => renderField("transition", field))}</div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Transition Months", value: formatMaybe(workspace.transition.transitionMonths), note: "Overall transition duration used for cost and risk posture." },
              { label: "KT Weeks", value: formatMaybe(workspace.transition.knowledgeTransferWeeks), note: "Knowledge transfer duration before stabilization ramps down." },
              { label: "Stabilization Weeks", value: formatMaybe(workspace.transition.stabilizationWeeks), note: "Stabilization coverage before the run-state is normalized." },
              { label: "Digital Sprints", value: formatMaybe(workspace.transition.digitalSprints), note: "Transformation sprint pods carried in the transition design." },
              { label: "Transition Cost", value: formatCurrency(engine.transitionCost), note: "Modeled transition cost created by the configured ramp assumptions." },
            ]}
          />

          <SectionCard
            badge="Plan"
            title="Transition phase plan"
            note="The transition plan is derived from the configured transition inputs and current solution complexity."
            status={`${engine.transitionPlan.length} phases`}
            statusTone="success"
          >
            <DataTable
              rows={engine.transitionPlan}
              columns={[
                { label: "Phase", key: "phase" },
                { label: "Duration", key: "duration" },
                { label: "Focus", key: "focus" },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-16-business-case":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Year 0", value: formatCurrency(engine.businessCase.year0), note: "Upfront investment profile after transition and transformation funding." },
              { label: "Year 1", value: formatCurrency(engine.businessCase.year1), note: "First year value creation after partial realization." },
              { label: "Year 2", value: formatCurrency(engine.businessCase.year2), note: "Steady-state value realization in year two." },
              { label: "Year 3", value: formatCurrency(engine.businessCase.year3), note: "Extended run-state value in year three." },
            ]}
          />

          <div className="review-grid">
            <article className="review-panel">
              <h4>Investment case</h4>
              <SummaryList
                rows={[
                  { label: "NPV", value: formatCurrency(engine.businessCase.npv) },
                  { label: "Payback", value: `${formatNumber(engine.businessCase.paybackMonths, 1)} months` },
                  { label: "ROI", value: formatPercent(engine.businessCase.roiPct, 1) },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Commercial bridge</h4>
              <SummaryList
                rows={[
                  { label: "Current Baseline", value: formatCurrency(engine.currentBaselineCost) },
                  { label: "Recommended Price", value: formatCurrency(engine.recommendedPrice) },
                  { label: "First Year Cost", value: formatCurrency(engine.firstYearCost) },
                  { label: "Annual Savings", value: formatCurrency(engine.annualSavings) },
                ]}
              />
            </article>
          </div>
        </div>
      );

    case "fpa-17-sensitivity":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Base Delivery FTE", value: formatNumber(engine.deliveryFte, 2), note: "Current base-case delivery FTE before scenario overlays." },
              { label: "Base Run Cost", value: formatCurrency(engine.annualRunCost), note: "Current base-case steady-state cost baseline." },
              { label: "Base Recommended Price", value: formatCurrency(engine.recommendedPrice), note: "Current commercial recommendation before scenario movement." },
              { label: "Base Annual Savings", value: formatCurrency(engine.annualSavings), note: "Current savings outcome before scenario movement." },
            ]}
          />

          <SectionCard
            badge="Scenarios"
            title="Sensitivity scenarios"
            note="Downside, base, and upside views adjust volume, AI realization, and commercial stance together."
            status={`${engine.scenarioRows.length} scenarios`}
            statusTone="info"
          >
            <DataTable
              rows={engine.scenarioRows}
              columns={[
                { label: "Scenario", key: "scenario" },
                { label: "Net Hours", key: "netHours", align: "right", render: (row) => formatNumber(row.netHours, 0) },
                { label: "Delivery FTE", key: "deliveryFte", align: "right", render: (row) => formatNumber(row.deliveryFte, 2) },
                { label: "Annual Cost", key: "annualCost", align: "right", render: (row) => formatCurrency(row.annualCost) },
                { label: "Annual Price", key: "annualPrice", align: "right", render: (row) => formatCurrency(row.annualPrice) },
                { label: "Annual Savings", key: "annualSavings", align: "right", render: (row) => formatCurrency(row.annualSavings) },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-18-risk":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Aggregate Risk", value: formatNumber(engine.riskScore, 0), note: "Average risk posture across benchmark, data, transition, commercial, and governance dimensions." },
              { label: "Confidence Score", value: formatNumber(engine.confidenceScore, 0), note: engine.confidenceLabel },
              { label: "Top Risk Severity", value: engine.riskRows[0]?.severity || "-", note: engine.riskRows[0]?.label || "No risk rows available." },
              { label: "Recommendation", value: engine.recommendationStance, note: "Current go-forward stance after balancing confidence, risk, and economics." },
            ]}
          />

          <SectionCard
            badge="Risk"
            title="FP&A risk register"
            note="These risks are generated directly from discovery completeness, benchmark posture, transition shape, and pricing settings."
            status={`${engine.riskRows.length} tracked risks`}
            statusTone={riskTone(engine.riskRows[0]?.severity)}
          >
            <DataTable
              rows={engine.riskRows}
              columns={[
                { label: "Risk", key: "label" },
                { label: "Score", key: "score", align: "right", render: (row) => formatNumber(row.score, 0) },
                { label: "Severity", key: "severity", render: (row) => <StatusPill tone={riskTone(row.severity)}>{row.severity}</StatusPill> },
                { label: "Driver", key: "driver" },
                { label: "Mitigation", key: "mitigation" },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-19-deal-risks":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Deal Risks"
            title="Top deal risks for leadership review"
            note="This shortlist is the executive cut of the highest FP&A risks in the current solution posture."
            status={`${engine.dealRisks.length} priority items`}
            statusTone={riskTone(engine.dealRisks[0]?.severity)}
          >
            <div className="fpa-risk-grid">
              {engine.dealRisks.map((risk, index) => (
                <article key={`${risk.headline}-${index}`} className="fpa-risk-card">
                  <div className="step-header">
                    <div>
                      <span className="step-badge">Risk {index + 1}</span>
                      <h4>{risk.headline}</h4>
                    </div>
                    <StatusPill tone={riskTone(risk.severity)}>{risk.severity}</StatusPill>
                  </div>
                  <p className="section-note">{risk.summary}</p>
                  <strong>Action</strong>
                  <p className="section-note">{risk.action}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      );

    case "fpa-20-recommend":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Recommendation"
            title="Tower recommendation"
            note="The recommendation balances evidence quality, solution risk, and modeled economics for the FP&A tower."
            status={engine.recommendationStance}
            statusTone={recommendationTone(engine.recommendationStance)}
          >
            <p className="section-note fpa-callout-copy">{engine.recommendationNarrative}</p>
          </SectionCard>

          <div className="review-grid">
            <article className="review-panel">
              <h4>Decision signals</h4>
              <SummaryList
                rows={[
                  { label: "Confidence", value: `${formatNumber(engine.confidenceScore, 0)} | ${engine.confidenceLabel}` },
                  { label: "Risk", value: `${formatNumber(engine.riskScore, 0)} | ${engine.riskRows[0]?.severity || "Working"}` },
                  { label: "Margin", value: formatPercent(engine.marginPct, 1) },
                  { label: "Annual Savings", value: formatCurrency(engine.annualSavings) },
                  { label: "Approval Stage", value: formatMaybe(workspace.governance.approvalStage) },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Action list</h4>
              <BulletList items={engine.recommendationActions.length ? engine.recommendationActions : ["No corrective actions are required at the current posture."]} />
            </article>
          </div>
        </div>
      );

    case "fpa-21-client-value":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Annual Savings", value: formatCurrency(engine.annualSavings), note: "Modeled annual client value versus the captured current-state baseline." },
              { label: "AI Hours Saved", value: formatNumber(engine.totalAiHoursSaved, 0), note: "Annual delivery hours released by the configured AI and automation levers." },
              { label: "Retained Org FTE", value: formatNumber(engine.retainedOrgFte, 2), note: "Client-side oversight team expected in the target operating model." },
              { label: "Forecast Accuracy Uplift", value: formatPercent(engine.forecastAccuracyUpliftPct, 1), note: "Indicative improvement in planning reliability and decision support quality." },
            ]}
          />

          <SectionCard
            badge="Client Value"
            title="Client-facing value narrative"
            note="Use these points as the storyline for value creation, operating leverage, and run-state modernization."
            status={engine.recommendationStance}
            statusTone={recommendationTone(engine.recommendationStance)}
          >
            <BulletList items={engine.valueNarrative} />
          </SectionCard>
        </div>
      );

    case "fpa-29-l3-business-view":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Business View"
            title="L3 process business view"
            note="This view translates the technical workload model into business-facing process outcomes for each FP&A line."
            status={`${engine.scopeCount}/${engine.scopeRows.length} selected`}
            statusTone={engine.scopeCount > 0 ? "success" : "info"}
          >
            <DataTable
              rows={businessViewRows}
              columns={[
                { label: "Status", key: "selected", render: (row) => <StatusPill tone={row.selected ? "success" : "neutral"}>{row.selected ? "Selected" : "Out"}</StatusPill> },
                { label: "Process", key: "label" },
                { label: "Family", key: "family" },
                { label: "Value Lever", key: "valueLever" },
                { label: "Benchmark Hours", key: "benchmarkHours", align: "right", render: (row) => formatNumber(row.benchmarkHours, 0) },
                { label: "AI Reduction", key: "aiReductionPct", align: "right", render: (row) => formatPercent(row.aiReductionPct, 1) },
                { label: "Net Hours", key: "netHours", align: "right", render: (row) => formatNumber(row.netHours, 0) },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-22-dashboard":
      return (
        <div className="fpa-form-stack">
          <KpiGrid items={engine.dashboardCards.map((card) => ({ label: card.label, value: formatDashboardCard(card), note: card.note }))} />

          <SectionCard
            badge="Dashboard"
            title="Tower dashboard summary"
            note="This is the condensed scorecard for the current FP&A solution posture."
            status={engine.recommendationStance}
            statusTone={recommendationTone(engine.recommendationStance)}
          >
            <SummaryList
              rows={[
                { label: "Confidence", value: `${formatNumber(engine.confidenceScore, 0)} | ${engine.confidenceLabel}` },
                { label: "Risk", value: `${formatNumber(engine.riskScore, 0)} | ${engine.riskRows[0]?.severity || "Working"}` },
                { label: "Selected Persona", value: engine.selectedPersona.label },
                { label: "Scope Processes", value: `${engine.scopeCount} of ${engine.scopeRows.length}` },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-23-trace-log":
      return (
        <div className="fpa-trace-grid">
          {engine.traceLog.map((item, index) => (
            <article key={`${item.output}-${index}`} className="review-panel compact-card">
              <div className="step-header">
                <div>
                  <span className="step-badge">Trace {index + 1}</span>
                  <h4>{item.output}</h4>
                </div>
                <StatusPill tone="info">{item.sources.length} sources</StatusPill>
              </div>
              <SummaryList rows={[{ label: "Sources", value: item.sources.join(", ") }]} />
              <p className="section-note">{item.explanation}</p>
            </article>
          ))}
        </div>
      );

    case "fpa-24-governance":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Governance"
            title="Approval and evidence controls"
            note="These controls turn the FP&A draft into a reviewable, evidence-backed submission."
            status={workspace.governance.approvalStage}
            statusTone={confidenceTone(engine.confidenceScore)}
          >
            <div className="field-grid field-grid-4">{GOVERNANCE_FIELD_DEFS.slice(0, 4).map((field) => renderField("governance", field))}</div>
            {renderField("governance", GOVERNANCE_FIELD_DEFS[4])}
          </SectionCard>

          <SectionCard
            badge="Checks"
            title="Review gates"
            note="Mark each governance step complete as the tower moves toward submission readiness."
            status={`${governanceChecksCompleted}/5 complete`}
            statusTone={governanceChecksCompleted >= 3 ? "success" : "info"}
          >
            <div className="fpa-toggle-grid">
              {GOVERNANCE_CHECK_FIELDS.map((field) => (
                <ToggleCardField
                  key={field.name}
                  label={field.label}
                  detail={field.detail}
                  checked={Boolean(workspace.governance[field.name])}
                  disabled={fieldDisabled}
                  onChange={(checked) => updateSectionFlag("governance", field.name, checked)}
                />
              ))}
            </div>
          </SectionCard>

          <KpiGrid
            items={[
              { label: "Completed Gates", value: `${governanceChecksCompleted}/5`, note: "Governance gates completed on the current draft." },
              { label: "Confidence Score", value: formatNumber(engine.confidenceScore, 0), note: engine.confidenceLabel },
              { label: "Evidence Coverage", value: formatPercent(workspace.governance.evidenceCoveragePct, 0), note: "Proportion of model inputs supported by evidence or validated proxies." },
              { label: "Corroboration", value: formatPercent(workspace.governance.benchmarkCorroborationPct, 0), note: "Benchmark corroboration carried into the pack." },
              { label: "Overrides", value: formatMaybe(workspace.governance.overrideCount), note: "Number of documented manual overrides in the current version." },
            ]}
          />
        </div>
      );

    case "fpa-25-confidence":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Confidence Score", value: formatNumber(engine.confidenceScore, 0), note: engine.confidenceLabel },
              { label: "Discovery Fill", value: formatPercent(engine.discoveryFillPct, 1), note: `${engine.discoveryCount}/${engine.discoveryFieldCount} discovery fields captured.` },
              { label: "Scope Coverage", value: formatPercent(engine.scopeCoveragePct, 1), note: `${engine.scopeCount} selected L2 scope processes.` },
              { label: "Evidence Coverage", value: formatPercent(workspace.governance.evidenceCoveragePct, 0), note: "Evidence coverage carried from governance inputs." },
              { label: "Benchmark Corroboration", value: formatPercent(workspace.governance.benchmarkCorroborationPct, 0), note: "Cross-check level between market and delivery evidence." },
            ]}
          />

          <div className="review-grid">
            <article className="review-panel">
              <h4>Confidence diagnostics</h4>
              <SummaryList
                rows={[
                  { label: "Confidence Label", value: engine.confidenceLabel },
                  { label: "Approval Stage", value: formatMaybe(workspace.governance.approvalStage) },
                  { label: "Governance Gates", value: `${governanceChecksCompleted}/5` },
                  { label: "Top Risk", value: engine.riskRows[0]?.label || "-" },
                ]}
              />
            </article>
            <article className="review-panel">
              <h4>Next lift actions</h4>
              <BulletList items={engine.recommendationActions.length ? engine.recommendationActions : ["Confidence inputs are healthy at the current posture."]} />
            </article>
          </div>
        </div>
      );

    case "fpa-26-calibration":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Current Staff", value: formatNumber(engine.calibration.currentStaff, 0), note: "Current-state FP&A staffing captured in discovery." },
              { label: "Modeled Delivery FTE", value: formatNumber(engine.calibration.modeledDeliveryFte, 2), note: "Engine-sized delivery FTE after AI and persona normalization." },
              { label: "Staff Gap", value: formatPercent(engine.calibration.staffGapPct, 1), note: "Gap between current staffing and the modeled delivery requirement." },
              { label: "Current Baseline Cost", value: formatCurrency(engine.calibration.currentCostBaselineUsd), note: "Current-state annual cost baseline used for savings comparisons." },
              { label: "Modeled Run Cost", value: formatCurrency(engine.calibration.modeledRunCostUsd), note: "Engine-sized annual run-state cost." },
              { label: "Cost Gap", value: formatPercent(engine.calibration.costGapPct, 1), note: "Difference between current cost baseline and modeled run-state cost." },
            ]}
          />

          <SectionCard
            badge="Calibration"
            title="Calibration summary"
            note="Calibration explains how the modeled FP&A target state compares with the captured current-state baseline."
            status={`${formatPercent(engine.calibration.benchmarkAdjustmentPct, 1)} benchmark adj.`}
            statusTone="info"
          >
            <SummaryList
              rows={[
                { label: "Benchmark Adjustment", value: formatPercent(engine.calibration.benchmarkAdjustmentPct, 1) },
                { label: "Current Staff", value: formatNumber(engine.calibration.currentStaff, 0) },
                { label: "Modeled Delivery FTE", value: formatNumber(engine.calibration.modeledDeliveryFte, 2) },
                { label: "Current Cost Baseline", value: formatCurrency(engine.calibration.currentCostBaselineUsd) },
                { label: "Modeled Run Cost", value: formatCurrency(engine.calibration.modeledRunCostUsd) },
              ]}
            />
          </SectionCard>
        </div>
      );

    case "fpa-27-benchmark-pack":
      return (
        <div className="fpa-form-stack">
          <KpiGrid
            items={[
              { label: "Resolved Policy", value: engine.resolvedBenchmarkPolicy, note: "Final benchmark anchor after deal-policy inheritance and local overrides." },
              { label: "Benchmark Factor", value: formatFactor(engine.benchmarkFactor), note: "Blended factor carried into the workload engine." },
              { label: "Productivity Floor", value: formatPercent(workspace.benchmarks.productivityFloorPct, 0), note: "Minimum productivity baseline used for pack defensibility." },
              { label: "Corroboration", value: formatPercent(workspace.governance.benchmarkCorroborationPct, 0), note: "Cross-check level between external benchmark and delivery evidence." },
            ]}
          />

          <SectionCard
            badge="Benchmark Pack"
            title="Benchmark pack detail"
            note="This tab packages the benchmark posture into the review-ready status summary."
            status={workspace.governance.benchmarkPackReady ? "Ready" : "Working"}
            statusTone={workspace.governance.benchmarkPackReady ? "success" : "info"}
          >
            <DataTable rows={engine.benchmarkPack} columns={benchmarkPackColumns} />
          </SectionCard>
        </div>
      );

    case "fpa-28-change-log":
      return (
        <div className="fpa-form-stack">
          <SectionCard
            badge="Change Log"
            title="Version notes and decision trail"
            note="Capture who changed the FP&A posture, what moved, and the latest decision signal."
            status={formatMaybe(workspace.changeLog.lastDecision, "Working draft")}
            statusTone="info"
          >
            <div className="field-grid field-grid-4">{CHANGE_LOG_FIELD_DEFS.slice(1, 3).map((field) => renderField("changeLog", field))}</div>
            <div className="field-grid">{CHANGE_LOG_FIELD_DEFS.filter((field) => field.type === "textarea").map((field) => renderField("changeLog", field))}</div>
          </SectionCard>

          <SectionCard
            badge="History"
            title="Saved change history"
            note="The latest saved version plus the original baseline are shown here for quick traceability."
            status={`${engine.changeLogRows.length} entries`}
            statusTone="info"
          >
            <DataTable
              rows={engine.changeLogRows}
              columns={[
                { label: "When", key: "when", render: (row) => formatDateLike(row.when) },
                { label: "Actor", key: "actor" },
                { label: "Summary", key: "summary" },
                { label: "Decision", key: "decision" },
              ]}
            />
          </SectionCard>
        </div>
      );

    default:
      return (
        <SectionCard
          badge="Workbook"
          title={activeTab.title}
          note="This FP&A tab is now connected to the shared engine."
          status="Live"
          statusTone="success"
        >
          <SummaryList
            rows={[
              { label: "Sheet", value: activeTab.sheetName },
              { label: "Kind", value: activeTab.kind },
              { label: "Formula Cells", value: formatNumber(activeTab.formulaCount, 0) },
              { label: "Recommendation", value: engine.recommendationStance },
            ]}
          />
        </SectionCard>
      );
  }
}

