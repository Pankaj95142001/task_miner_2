from __future__ import annotations

import json
import re
import sys
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.models import DealPayload  # noqa: E402
from backend.app.storage import JsonDealStore  # noqa: E402


DEALS_PATH = ROOT / "backend" / "data" / "deals.json"
USERS_PATH = ROOT / "backend" / "data" / "users.json"
AUTH_PATH = ROOT / "backend" / "data" / "auth.json"

MANAGER_IMPORT_PATH = ROOT / "docs" / "Gaurav" / "kdp-manager-workbook-import.generated.json"
SOURCE_SUMMARY_PATH = ROOT / "docs" / "Gaurav" / "gaurav-source-summary.generated.json"
SCHEMA_PATH = ROOT / "docs" / "Gaurav" / "deal-schema.generated.json"
SCOPE_CONFIG_PATH = ROOT / "src" / "config" / "fpaScope.js"

TARGET_DEAL_ID = "KDP-DVE-RFP-2026"
OWNER_USER_ID = "user-gauravra"
PINNED_USER_IDS = ["user-gauravra", "user-harshsin", "user-vipulra", "user-o2c-lead", "user-p2p-lead"]

SOURCE_CLASS_CODES = {
    "Client-confirmed": "CC",
    "Client-estimated": "CE",
    "Practitioner assumption": "PA",
    "Benchmark": "BM",
    "Market evidence": "MKT",
}

SCOPE_L2_MODEL = {
    "strategicLongRangePlanning": ("Y", "1"),
    "budgetingPlanning": ("Y", "1"),
    "rollingForecastingIbp": ("Y", "1"),
    "commercialForecasting": ("Partial", "0.6"),
    "costProductivityMarginManagement": ("Y", "1"),
    "workforceCapacityPlanning": ("N", "0"),
    "cashFlowCapitalPlanning": ("Partial", "0.5"),
    "variancePerformanceManagement": ("Y", "1"),
    "managementReportingDecisionSupport": ("Y", "1"),
    "scenarioRiskModeling": ("Y", "1"),
    "profitabilityPricingBusinessCases": ("N", "0"),
    "governanceMasterDataBusinessPartnering": ("Y", "1"),
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def maybe_fix_mojibake(value):
    if isinstance(value, dict):
        return {key: maybe_fix_mojibake(item) for key, item in value.items()}
    if isinstance(value, list):
        return [maybe_fix_mojibake(item) for item in value]
    if not isinstance(value, str):
        return value

    markers = ("â€”", "â€“", "â†’", "·", "Ã", "â€™", "â€œ", "â€", "")
    text = value.strip()
    if any(marker in text for marker in markers):
        try:
            return text.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return text
    return text


def set_path(target: dict, dotted_path: str, value) -> None:
    parts = dotted_path.split(".")
    node = target
    for part in parts[:-1]:
        if part not in node or not isinstance(node[part], dict):
            node[part] = {}
        node = node[part]
    node[parts[-1]] = value


def build_scope_seed() -> dict[str, dict[str, str]]:
    source = SCOPE_CONFIG_PATH.read_text(encoding="utf-8")
    pattern = re.compile(
        r'\{ id: "(?P<id>[^"]+)", row: \d+, l2Id: "(?P<l2>[^"]+)", activity: "(?P<activity>[^"]+)"(?:, cluster: "(?P<cluster>[^"]+)")? \}'
    )
    rows = pattern.findall(source)
    scope_seed: dict[str, dict[str, str]] = {}

    for row_id, l2_id, _activity, _cluster in rows:
        status, partial = SCOPE_L2_MODEL.get(l2_id, ("Y", "1"))
        if status == "Y":
            scope_seed[row_id] = {
                "status": "Y",
                "partialPct": "1",
                "retainedToo": "N",
                "disposition": "Transfer",
                "locationIntent": "Follow model",
            }
        elif status == "Partial":
            scope_seed[row_id] = {
                "status": "Partial",
                "partialPct": partial,
                "retainedToo": "Y",
                "disposition": "Hybrid",
                "locationIntent": "Follow model",
            }
        else:
            scope_seed[row_id] = {
                "status": "N",
                "partialPct": "0",
                "retainedToo": "Y",
                "disposition": "Retain",
                "locationIntent": "Follow model",
            }

    return scope_seed


def build_discovery_evidence(row: dict) -> dict:
    source_class = str(row.get("sourceClass") or "").strip()
    raw_date = str(row.get("evidenceDate") or "").strip()
    source = str(row.get("owner") or "").strip() or "KDP source pack"
    return {
        "source": source,
        "confidence": str(row.get("confidence") or "").strip(),
        "owner": source,
        "date": raw_date,
        "fileName": str(row.get("workbookFile") or "").strip(),
        "sheetName": str(row.get("sheetName") or "").strip(),
        "cell": str(row.get("cell") or "").strip(),
        "effectiveCell": str(row.get("effectiveCell") or "").strip(),
        "effectiveValue": "" if row.get("effectiveValue") is None else str(row.get("effectiveValue")),
        "sourceClass": source_class,
        "sourceClassCode": SOURCE_CLASS_CODES.get(source_class, ""),
        "criticality": str(row.get("criticality") or "").strip(),
        "defaultSource": str(row.get("defaultSource") or "").strip(),
        "rawDateLabel": raw_date,
        "defaulted": bool(row.get("defaulted")),
    }


def remove_existing_kdp_deals() -> None:
    workspace = load_json(DEALS_PATH) if DEALS_PATH.exists() else {}
    if not isinstance(workspace, dict):
        workspace = {}

    deals = workspace.get("deals") if isinstance(workspace.get("deals"), list) else []
    kept = [deal for deal in deals if str(deal.get("dealId") or "").strip() != TARGET_DEAL_ID]
    valid_ids = {str(deal.get("id")) for deal in kept if str(deal.get("id") or "").strip()}

    current_by_user = workspace.get("currentByUser") if isinstance(workspace.get("currentByUser"), dict) else {}
    recent_by_user = workspace.get("recentByUser") if isinstance(workspace.get("recentByUser"), dict) else {}

    workspace["deals"] = kept
    workspace["currentId"] = workspace.get("currentId") if workspace.get("currentId") in valid_ids else (kept[0]["id"] if kept else None)
    workspace["currentByUser"] = {
        str(user_id): str(deal_id)
        for user_id, deal_id in current_by_user.items()
        if str(deal_id) in valid_ids
    }
    workspace["recentByUser"] = {
        str(user_id): [str(deal_id) for deal_id in deal_ids if str(deal_id) in valid_ids][:8]
        for user_id, deal_ids in recent_by_user.items()
        if isinstance(deal_ids, list)
    }

    write_json(DEALS_PATH, workspace)


def main() -> None:
    manager_import = maybe_fix_mojibake(load_json(MANAGER_IMPORT_PATH))
    source_summary = maybe_fix_mojibake(load_json(SOURCE_SUMMARY_PATH))
    _schema = maybe_fix_mojibake(load_json(SCHEMA_PATH))

    remove_existing_kdp_deals()

    payload = {
        "draftLabel": "KDP DVE Finance — Fresh Docs Seed",
        "dealId": TARGET_DEAL_ID,
        "clientName": "Keurig Dr Pepper (BevCo) — DVE Finance",
        "programName": "KDP Digital Value Engine (DVE) — Finance: R2R · O2C · S2P · P2P (Plan-to-Perform = FP&A)",
        "dealStatus": "Sizing",
        "watermark": "READY WITH REVIEW ITEMS",
        "notesTag": "Internal",
        "towerStatus_FPA": "In Progress",
        "towerStatus_RTR": "Discovery complete",
        "towerStatus_O2C": "Discovery complete",
        "towerStatus_P2P": "Discovery complete",
        "reviewNotes": (
            "Fresh deal seeded from docs/Gaurav generated extracts. Shared Deal Master plus FP&A Discovery, "
            "Discovery Coverage, and Pain Points are populated from the KDP source pack. KDP P2P / Plan-to-Perform "
            "is mapped to the portal FP&A tower, while KDP S2P is mapped to the portal P2P tower. FP&A Scope L3 is "
            "seeded from the documented baseline themes in the source pack and can be refined row-by-row in the portal."
        ),
        "towerOwnerUserId_FPA": "user-vipulra",
        "towerOwnerUserId_RTR": "user-harshsin",
        "towerOwnerUserId_O2C": "user-o2c-lead",
        "towerOwnerUserId_P2P": "user-p2p-lead",
        "collaborators": [
            {
                "id": "collab-kdp-rtr-harsh",
                "name": "Harsh",
                "email": "harshsin@hcltech.com",
                "towerCode": "RTR",
            },
            {
                "id": "collab-kdp-fpa-vipul",
                "name": "Vipul",
                "email": "vipulra@hcltech.com",
                "towerCode": "FPA",
            },
        ],
        "sourceDocuments": {
            "workbooks": deepcopy(manager_import.get("sourceCoverage", {}).get("docsWorkbooks", [])),
            "pdfBaselinePacks": deepcopy(manager_import.get("sourceCoverage", {}).get("docsPdfPacks", [])),
            "rawExtractReference": "docs/Gaurav/gaurav-source-summary.generated.json",
            "mappingReference": "docs/Gaurav/kdp-manager-workbook-import.generated.json",
            "schemaReference": "docs/Gaurav/deal-schema.generated.json",
        },
        "sourceSummary": {
            "sourcePackName": "Gaurav / KDP finance source pack",
            "workbookCount": len(manager_import.get("sourceCoverage", {}).get("docsWorkbooks", [])),
            "pdfCount": len(manager_import.get("sourceCoverage", {}).get("docsPdfPacks", [])),
            "clientAlias": "KDP",
            "seedMode": "docs/Gaurav generated extraction",
            "mappingRules": [
                "KDP P2P / Plan-to-Perform maps to the portal FP&A tower.",
                "KDP S2P / Source-to-Pay maps to the portal P2P tower.",
                "Portal tower owners are mapped to local user accounts for access control.",
            ],
            "towerInScopeFte": {
                "FPA": 44,
                "RTR": 38,
                "O2C": 102,
                "P2P": 111,
            },
            "keyPlatforms": [
                "IBM Planning Analytics",
                "SAP / ERP estate (from source pack)",
            ],
            "generatedSources": [
                "docs/Gaurav/deal-schema.generated.json",
                "docs/Gaurav/gaurav-source-summary.generated.json",
                "docs/Gaurav/kdp-manager-workbook-import.generated.json",
            ],
        },
        "canonicalSchemaRef": "docs/Gaurav/deal-schema.generated.json",
        "fpaWorkspace": {
            "status": "In Progress",
            "notes": (
                "Seeded from docs/Gaurav. Discovery values come from the KDP extracted workbook mapping. "
                "Scope L3 is expanded from the source pack's P2P / Plan-to-Perform baseline themes into the portal FP&A L3 catalogue."
            ),
            "scopeSeedMethod": {
                "source": "docs/Gaurav source pack",
                "basis": [
                    "Strategy and target setting",
                    "Planning and budgeting",
                    "Forecasting and scenario planning",
                    "Reporting and analytics",
                    "Performance gap management",
                    "Process governance and data management",
                ],
                "partialAreas": [
                    "Revenue and commercial forecasting",
                    "Cash flow and capital planning",
                ],
                "notExplicitlyBacked": [
                    "Workforce and capacity planning",
                    "Profitability, pricing and business cases",
                ],
            },
            "scopeL3": build_scope_seed(),
        },
    }

    for field in manager_import.get("fields", []):
        portal_path = str(field.get("portalPath") or "").strip()
        if not portal_path or portal_path.startswith("collaborators["):
            continue

        portal_value = maybe_fix_mojibake(deepcopy(field.get("portalValue")))
        if portal_path.startswith("fpaWorkspace.discovery."):
            field_id = portal_path.split(".")[-1]
            set_path(payload, portal_path, portal_value)
            evidence = build_discovery_evidence(field)
            payload["fpaWorkspace"].setdefault("discoveryEvidence", {})[field_id] = evidence
            continue

        if portal_path.startswith("fpaWorkspace.discoveryCoverage.") or portal_path.startswith("fpaWorkspace.discoveryPainPoints."):
            set_path(payload, portal_path, portal_value)
            continue

        if portal_path.startswith("towerLead_"):
            workbook_leads = payload.setdefault("sourceSummary", {}).setdefault("workbookTowerLeads", {})
            workbook_leads[portal_path.replace("towerLead_", "")] = str(portal_value or "")
            continue

        if portal_path in {"dealOwnerName", "dealOwnerUserId"}:
            continue

        set_path(payload, portal_path, portal_value)

    payload["sourceSummary"]["workbookFirstRows"] = {
        workbook.get("file"): [sheet.get("name") for sheet in workbook.get("sheets", [])[:2]]
        for workbook in source_summary.get("workbooks", [])[:4]
        if isinstance(workbook, dict)
    }

    store = JsonDealStore(DEALS_PATH, USERS_PATH, AUTH_PATH, legacy_database_path=None)
    store.bootstrap()
    created = store.create_deal(OWNER_USER_ID, DealPayload(**payload))

    for user_id in PINNED_USER_IDS:
        try:
            store.set_current_deal(user_id, created.id)
        except Exception:
            pass

    print(
        json.dumps(
            {
                "createdId": created.id,
                "dealId": created.dealId,
                "draftLabel": created.draftLabel,
                "owner": created.dealOwnerName,
                "collaborators": [item.email for item in created.collaborators],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
