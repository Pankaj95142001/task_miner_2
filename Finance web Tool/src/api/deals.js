const EXPLICIT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
const LOCAL_API_BASES = ["http://127.0.0.1:8000/api", "http://localhost:8000/api"];
let resolvedApiBaseUrl = "";

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildApiBaseCandidates() {
  if (resolvedApiBaseUrl) {
    return [resolvedApiBaseUrl];
  }

  if (EXPLICIT_API_BASE_URL) {
    return [EXPLICIT_API_BASE_URL];
  }

  const candidates = [];

  if (typeof window !== "undefined") {
    const { protocol, origin } = window.location;
    if (protocol === "http:" || protocol === "https:") {
      candidates.push(`${origin.replace(/\/$/, "")}/api`);
      candidates.push("/api");
    }

    candidates.push(...LOCAL_API_BASES);
  } else {
    candidates.push(...LOCAL_API_BASES);
  }

  return uniqueValues(candidates.map(normalizeApiBaseUrl));
}

function parsePayload(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function errorMessageFromPayload(payload, status) {
  if (typeof payload === "object" && payload !== null && payload.detail) {
    return payload.detail;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `API request failed with status ${status}.`;
}

async function request(path, options = {}) {
  const { headers = {}, userId, ...rest } = options;
  const candidateBases = buildApiBaseCandidates();
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  let lastHttpError = null;
  let lastNetworkError = null;

  for (const apiBaseUrl of candidateBases) {
    let response;

    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(userId ? { "X-User-Id": userId } : {}),
          ...headers,
        },
        ...rest,
      });
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    const raw = await response.text();
    const payload = parsePayload(raw);

    if (response.ok) {
      resolvedApiBaseUrl = apiBaseUrl;
      return payload;
    }

    const canTryNextBase =
      !EXPLICIT_API_BASE_URL &&
      candidateBases.length > 1 &&
      (response.status === 404 || response.status >= 500);

    if (canTryNextBase) {
      lastHttpError = { apiBaseUrl, payload, status: response.status };
      continue;
    }

    throw new Error(errorMessageFromPayload(payload, response.status));
  }

  if (lastHttpError) {
    throw new Error(errorMessageFromPayload(lastHttpError.payload, lastHttpError.status));
  }

  if (lastNetworkError) {
    throw new Error(
      `Unable to reach the API. Tried ${candidateBases.join(", ")}. Start the backend on port 8000 or set VITE_API_BASE_URL.`,
    );
  }

  throw new Error("Unable to reach the API.");
}

export function signup(payload) {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchUsers() {
  return request("/users");
}

export function fetchMeSummary(userId) {
  return request("/me", { userId });
}

export function fetchDeals(userId) {
  return request("/deals", { userId });
}

export function fetchDeal(dealId, userId) {
  return request(`/deals/${dealId}`, { userId });
}

export function createDeal(payload, userId) {
  return request("/deals", {
    method: "POST",
    body: JSON.stringify(payload),
    userId,
  });
}

export function renderFpaWorkbookSheet(sheetName, deal, userId) {
  return request("/fpa/workbook/render", {
    method: "POST",
    body: JSON.stringify({ sheetName, deal }),
    userId,
  });
}

export function renderP2pWorkbookSheet(sheetName, deal, userId) {
  return request("/p2p/workbook/render", {
    method: "POST",
    body: JSON.stringify({ sheetName, deal }),
    userId,
  });
}

export function updateDeal(dealId, payload, userId) {
  return request(`/deals/${dealId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    userId,
  });
}

export function setCurrentDeal(dealId, userId) {
  return request(`/deals/current/${dealId}`, {
    method: "POST",
    userId,
  });
}

export function duplicateDeal(dealId, userId) {
  return request(`/deals/${dealId}/duplicate`, {
    method: "POST",
    userId,
  });
}

export function deleteDeal(dealId, userId) {
  return request(`/deals/${dealId}`, {
    method: "DELETE",
    userId,
  });
}

export function extractDealDocuments(dealId, files, userId) {
  const body = new FormData();
  Array.from(files || []).forEach((file) => {
    if (file) {
      body.append("files", file);
    }
  });

  return request(`/deals/${dealId}/documents/extract`, {
    method: "POST",
    body,
    userId,
  });
}
export function fetchDealDocumentExtractionStatus(dealId, runId, userId) {
  return request(`/deals/${dealId}/documents/extract/${runId}`, {
    userId,
  });
}

export function deleteDealDocument(dealId, documentId, userId) {
  return request(`/deals/${dealId}/documents/${documentId}`, {
    method: "DELETE",
    userId,
  });
}


export function fetchDealCopilotSession(dealId, userId) {
  return request(`/deals/${dealId}/copilot/session`, {
    userId,
  });
}

export function askDealCopilot(dealId, message, userId) {
  return request(`/deals/${dealId}/copilot/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
    userId,
  });
}

export function fetchDealKnowledge(dealId, userId) {
  return request(`/deals/${encodeURIComponent(dealId)}/knowledge`, { userId });
}

export function importDealKnowledge(dealId, extraction, original, replaceDocumentId, userId) {
  const body = new FormData();
  body.append("extraction", extraction);
  if (original) body.append("original", original);
  if (replaceDocumentId) body.append("replace_document_id", replaceDocumentId);
  return request(`/deals/${encodeURIComponent(dealId)}/knowledge/import`, { method: "POST", body, userId });
}

export function rebuildDealKnowledge(dealId, userId) {
  return request(`/deals/${encodeURIComponent(dealId)}/knowledge/reindex`, { method: "POST", userId });
}

export function removeDealKnowledge(dealId, documentId, userId) {
  return request(`/deals/${encodeURIComponent(dealId)}/knowledge/${encodeURIComponent(documentId)}`, { method: "DELETE", userId });
}

export function fetchKnowledgeExtraction(dealId, documentId, userId) {
  return request(`/deals/${encodeURIComponent(dealId)}/knowledge/${encodeURIComponent(documentId)}/extraction`, { userId });
}

export function clearDealCopilotSession(dealId, userId) {
  return request(`/deals/${dealId}/copilot/session`, {
    method: "DELETE",
    userId,
  });
}

export function fetchPortfolioCopilotSession(userId) {
  return request(`/deals/copilot/session`, {
    userId,
  });
}

export function askPortfolioCopilot(message, userId) {
  return request(`/deals/copilot/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
    userId,
  });
}

export function clearPortfolioCopilotSession(userId) {
  return request(`/deals/copilot/session`, {
    method: "DELETE",
    userId,
  });
}
