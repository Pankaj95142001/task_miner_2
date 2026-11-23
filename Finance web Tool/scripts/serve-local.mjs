import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const host = String(process.env.HOST || process.env.BIND_HOST || "127.0.0.1");
const port = Number(process.env.PORT || 4173);
const apiTarget = new URL(process.env.API_PROXY_TARGET || "http://127.0.0.1:8000");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function shouldProxy(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/") || pathname === "/health";
}

function safeResolveDistPath(pathname) {
  const cleanPath = pathname.replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(distDir, cleanPath);
  if (!resolved.startsWith(distDir)) {
    return null;
  }
  return resolved;
}

function serveFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
}

function serveFrontend(request, response, pathname) {
  const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = safeResolveDistPath(requestedPath);

  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(response, filePath);
    return;
  }

  const fallbackPath = path.join(distDir, "index.html");
  if (!fs.existsSync(fallbackPath)) {
    sendJson(response, 500, {
      detail: "Frontend build not found. Run npm run build first.",
    });
    return;
  }

  serveFile(response, fallbackPath);
}

function proxyRequest(request, response, pathname, search) {
  const client = apiTarget.protocol === "https:" ? https : http;
  const headers = { ...request.headers, host: apiTarget.host };
  const options = {
    protocol: apiTarget.protocol,
    hostname: apiTarget.hostname,
    port: apiTarget.port,
    method: request.method,
    path: `${pathname}${search}`,
    headers,
  };

  const proxy = client.request(options, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxy.on("error", (error) => {
    sendJson(response, 502, {
      detail: `Unable to reach backend at ${apiTarget.origin}: ${error.message}`,
    });
  });

  request.pipe(proxy);
}

const server = http.createServer((request, response) => {
  const origin = request.headers.host || `${host}:${port}`;
  const url = new URL(request.url || "/", `http://${origin}`);

  if (shouldProxy(url.pathname)) {
    proxyRequest(request, response, url.pathname, url.search);
    return;
  }

  serveFrontend(request, response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`Local portal server running at http://${host}:${port}`);
  console.log(`Proxying API requests to ${apiTarget.origin}`);
});
