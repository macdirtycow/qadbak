#!/usr/bin/env node
/**
 * WebSocket terminals for Qadbak:
 *   /ws/domain-terminal — domain unix user (customer scope)
 *   /ws/admin-terminal  — root bash for panel admins only
 */
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { jwtVerify } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const require = createRequire(path.join(ROOT, "package.json"));
const { WebSocketServer } = require("ws");
const pty = require("node-pty");

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const PORT = Number(process.env.QADBAK_TERMINAL_WS_PORT || "3001");
const HOST = process.env.QADBAK_TERMINAL_WS_HOST || "127.0.0.1";
const DOMAIN_RUNNER =
  process.env.QADBAK_TERMINAL_RUNNER ||
  path.join(ROOT, "scripts/run-domain-terminal.sh");
const ADMIN_RUNNER =
  process.env.QADBAK_ADMIN_TERMINAL_RUNNER ||
  path.join(ROOT, "scripts/run-admin-terminal.sh");
const MOCK = process.env.QADBAK_LEGACY_API_MOCK === "true";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET missing or too short.");
  }
  return new TextEncoder().encode(secret);
}

async function verifyDomainToken(token) {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== "terminal-ws") {
    throw new Error("Invalid token purpose.");
  }
  const domain = String(payload.domain || "");
  const unixUser = String(payload.unixUser || "");
  if (!domain || !unixUser) throw new Error("Invalid token payload.");
  return unixUser;
}

async function verifyAdminToken(token) {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== "admin-terminal-ws") {
    throw new Error("Invalid token purpose.");
  }
  return true;
}

function spawnDomainShell(unixUser) {
  if (MOCK) {
    return pty.spawn("/bin/bash", ["-l"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || "/tmp",
      env: {
        ...process.env,
        TERM: "xterm-256color",
        PS1: `\\u@mock-${unixUser}:\\w\\$ `,
      },
    });
  }
  return pty.spawn("sudo", ["-n", DOMAIN_RUNNER, unixUser], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: "/tmp",
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  });
}

function spawnAdminShell() {
  if (MOCK) {
    return pty.spawn("/bin/bash", ["-l"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || "/tmp",
      env: {
        ...process.env,
        TERM: "xterm-256color",
        PS1: "\\u@mock-root:\\w\\$ ",
      },
    });
  }
  return pty.spawn("sudo", ["-n", ADMIN_RUNNER], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: "/tmp",
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  });
}

function attachPty(ws, term) {
  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  term.onExit(({ exitCode, signal }) => {
    if (ws.readyState === ws.OPEN) {
      const reason =
        exitCode === 0
          ? "Shell exited"
          : `Shell exited (code ${exitCode}${signal ? `, signal ${signal}` : ""})`;
      ws.close(1000, reason);
    }
  });

  ws.on("message", (raw) => {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    try {
      if (text.startsWith("{")) {
        const msg = JSON.parse(text);
        if (msg.t === "resize" && msg.cols && msg.rows) {
          term.resize(
            Math.min(500, Math.max(2, Number(msg.cols))),
            Math.min(200, Math.max(2, Number(msg.rows))),
          );
          return;
        }
      }
    } catch {
      /* plain input */
    }
    term.write(text);
  });

  ws.on("close", () => {
    try {
      term.kill();
    } catch {
      /* ignore */
    }
  });
}

const TERMINAL_WS_PROTOCOL = "qadbak-terminal";

function extractWsToken(req) {
  const raw = req.headers["sec-websocket-protocol"];
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  const idx = parts.indexOf(TERMINAL_WS_PROTOCOL);
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  for (const p of parts) {
    if (p.split(".").length === 3 && p.length > 40) return p;
  }
  return null;
}

function bindTerminalWss(wss, openSession) {
  wss.on("connection", async (ws, req) => {
    const token = extractWsToken(req);
    if (!token) {
      ws.close(4401, "Missing token");
      return;
    }

    let term;
    try {
      term = await openSession(token);
    } catch (err) {
      ws.close(4403, err instanceof Error ? err.message : "Session failed");
      return;
    }

    attachPty(ws, term);
  });
}

const server = http.createServer((_req, res) => {
  res.writeHead(426, { "Content-Type": "text/plain" });
  res.end("WebSocket upgrade required.");
});

const wssDomain = new WebSocketServer({ noServer: true });
const wssAdmin = new WebSocketServer({ noServer: true });

bindTerminalWss(wssDomain, async (token) => {
  const unixUser = await verifyDomainToken(token);
  return spawnDomainShell(unixUser);
});

bindTerminalWss(wssAdmin, async (token) => {
  await verifyAdminToken(token);
  return spawnAdminShell();
});

server.on("upgrade", (request, socket, head) => {
  const host = request.headers.host || "localhost";
  const pathname = new URL(request.url || "/", `http://${host}`).pathname;

  const route = (wss) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  };

  if (pathname === "/ws/domain-terminal") {
    route(wssDomain);
    return;
  }
  if (pathname === "/ws/admin-terminal") {
    route(wssAdmin);
    return;
  }
  socket.destroy();
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `Qadbak terminal WS on ${HOST}:${PORT} — /ws/domain-terminal + /ws/admin-terminal (mock=${MOCK})\n`,
  );
});

process.on("uncaughtException", (err) => {
  process.stderr.write(`qadbak-terminal fatal: ${err.stack || err}\n`);
  process.exit(1);
});
