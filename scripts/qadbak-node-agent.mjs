#!/usr/bin/env node
/**
 * Qadbak node agent (phase 7) — local legacy hosting API proxy + health for multi-server panel.
 * Bind 127.0.0.1 only; panel reaches remote nodes via SSH tunnel or private network + firewall.
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));

const PORT = Number(process.env.QADBAK_NODE_AGENT_PORT ?? "9100");
const HOST = process.env.QADBAK_NODE_AGENT_HOST ?? "127.0.0.1";
const TOKEN = process.env.QADBAK_NODE_AGENT_TOKEN?.trim() ?? "";
const NODE_ID = process.env.QADBAK_NODE_ID?.trim() || "local";
const VM_URL = process.env.QADBAK_LEGACY_API_URL?.trim();
const VM_USER = process.env.QADBAK_LEGACY_API_USER?.trim();
const VM_PASS = process.env.QADBAK_LEGACY_API_PASS?.trim();

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function safeErrorMessage(err) {
  if (!(err instanceof Error)) return String(err);
  return err.message || "Internal error";
}

function unauthorized(res) {
  json(res, 401, { ok: false, error: "Unauthorized" });
}

function checkAuth(req, res) {
  if (!TOKEN) {
    json(res, 503, { ok: false, error: "QADBAK_NODE_AGENT_TOKEN not configured" });
    return false;
  }
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${TOKEN}`) {
    unauthorized(res);
    return false;
  }
  return true;
}

function vmTlsInsecure(url) {
  const flag = process.env.QADBAK_LEGACY_API_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

async function legacyApiCall(program, params = {}) {
  if (!VM_URL || !VM_USER || !VM_PASS) {
    throw new Error("QADBAK_LEGACY_API_URL/USER/PASS missing in .env.local");
  }
  const body = new URLSearchParams({ program, ...params });
  const isList = program.startsWith("list-");
  if (isList) {
    body.set("json", "1");
    body.set("multiline", "");
  } else {
    body.set("json", "1");
    body.set("simple-multiline", "");
  }
  const insecure = vmTlsInsecure(VM_URL);
  const target = new URL(VM_URL);
  if (insecure) {
    const host = target.hostname;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      throw new Error("Insecure TLS is only allowed for localhost legacy API URLs.");
    }
  }
  const payload = body.toString();
  const headers = {
    Authorization: `Basic ${Buffer.from(`${VM_USER}:${VM_PASS}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": String(Buffer.byteLength(payload)),
  };
  const mod = target.protocol === "https:" ? https : http;
  const agent =
    insecure && mod === https
      // lgtm[js/disabling-certificate-validation] localhost self-signed legacy API only
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

  const { status, text } = await new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers,
        agent,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 500, text: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
  return { status, text };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const vmOk = !!(VM_URL && VM_USER && VM_PASS);
      json(res, 200, {
        ok: true,
        node: NODE_ID,
        agent: "qadbak-node-agent",
        provisioner: "legacy-remote",
        legacyApiConfigured: vmOk,
      });
      return;
    }

    if (!checkAuth(req, res)) return;

    if (req.method === "GET" && url.pathname === "/v1/ping") {
      json(res, 200, { ok: true, node: NODE_ID });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/legacy-api/call") {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const program = String(payload.program ?? "").trim();
      if (!program) {
        json(res, 400, { ok: false, error: "program required" });
        return;
      }
      const params = payload.params && typeof payload.params === "object" ? payload.params : {};
      const out = await legacyApiCall(program, params);
      json(res, 200, { ok: true, status: out.status, body: out.text });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/provision/domain") {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const domain = String(payload.domain ?? "").trim();
      const user = String(payload.user ?? domain.split(".")[0] ?? "").trim();
      const plan = String(payload.plan ?? "Default").trim();
      if (!domain) {
        json(res, 400, { ok: false, error: "domain required" });
        return;
      }
      const { spawn } = await import("node:child_process");
      const helper = path.join(ROOT, "scripts", "provisioning-helper.mjs");
      const pass = payload.pass || `Qd${Math.random().toString(36).slice(2, 10)}!`;
      const child = spawn(process.execPath, [
        helper,
        "domain-create",
        domain,
        user,
        plan,
        pass,
      ]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (c) => { stdout += c; });
      child.stderr.on("data", (c) => { stderr += c; });
      const code = await new Promise((resolve) => child.on("close", resolve));
      let parsed = {};
      try {
        parsed = JSON.parse(stdout.trim().split("\n").pop() || "{}");
      } catch {
        /* */
      }
      if (code !== 0 || !parsed.ok) {
        json(res, 500, {
          ok: false,
          error: safeErrorMessage(new Error(parsed.error || stderr || `domain-create exit ${code}`)),
        });
        return;
      }
      json(res, 200, { ok: true, domain, user, plan, result: parsed });
      return;
    }

    json(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    json(res, 500, { ok: false, error: safeErrorMessage(e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`qadbak-node-agent listening on http://${HOST}:${PORT} (node=${NODE_ID})`);
});
