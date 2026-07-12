import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  QADBAK_DIR,
} from "./provisioning-common.mjs";
import { assertComposePolicyYaml } from "./compose-policy.mjs";

const exec = promisify(execFile);
const CFG = "runtimes.json";

export async function runtimesGet(domain) {
  await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, CFG, { apps: [], phpNote: "" });
  let phpSocket = "";
  try {
    const { user } = await resolveDomainUser(domain);
    const sock = `/run/php/qadbak-${user}.sock`;
    await access(sock);
    phpSocket = sock;
  } catch {
    phpSocket = "apache-backend";
  }
  emit({ ok: true, runtimes: cfg, phpFpmSocket: phpSocket });
}

export async function runtimesNodeInstall(domain, name, port, subpath) {
  const { user, home } = await resolveDomainUser(domain);
  const appName = String(name || "app").replace(/[^a-z0-9-]/gi, "");
  const listenPort = Number(port) || 3000;
  const appsDir = path.join(home, "apps", appName);
  await mkdir(appsDir, { recursive: true });
  const serverJs = path.join(appsDir, "server.js");
  if (!(await fileExists(serverJs))) {
    await writeFile(
      serverJs,
      `const http = require("http");\nconst port = ${listenPort};\nhttp.createServer((req,res)=>{\n  res.writeHead(200,{"Content-Type":"text/plain"});\n  res.end("Qadbak Node app: ${appName}\\n");\n}).listen(port, "127.0.0.1");\n`,
      "utf8",
    );
  }
  const unit = `qadbak-node-${user}-${appName}.service`;
  const unitPath = `/etc/systemd/system/${unit}`;
  const unitBody = `[Unit]
Description=Qadbak Node ${appName} (${domain})
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${appsDir}
ExecStart=/usr/bin/node ${serverJs}
Restart=on-failure
Environment=PORT=${listenPort}

[Install]
WantedBy=multi-user.target
`;
  await writeFile(`/tmp/${unit}`, unitBody, "utf8");
  await exec("cp", [`/tmp/${unit}`, unitPath]);
  await exec("systemctl", ["daemon-reload"]);
  await exec("systemctl", ["enable", "--now", unit]);
  const loc = String(subpath || "/").trim() || "/";
  await upsertProxy(domain, loc, `http://127.0.0.1:${listenPort}`);
  const cfg = await readDomainConfigJson(domain, CFG, { apps: [] });
  cfg.apps = (cfg.apps || []).filter((a) => a.type !== "node" || a.name !== appName);
  cfg.apps.push({
    type: "node",
    name: appName,
    port: listenPort,
    path: loc,
    unit,
    installedAt: new Date().toISOString(),
  });
  await writeDomainConfigJson(domain, CFG, cfg);
  emit({ ok: true, type: "node", name: appName, port: listenPort, proxyPath: loc });
}

export async function runtimesPythonInstall(domain, name, port) {
  const { user, home } = await resolveDomainUser(domain);
  const appName = String(name || "api").replace(/[^a-z0-9-]/gi, "");
  const listenPort = Number(port) || 8000;
  const appsDir = path.join(home, "apps", appName);
  await mkdir(appsDir, { recursive: true });
  const appPy = path.join(appsDir, "app.py");
  if (!(await fileExists(appPy))) {
    await writeFile(
      appPy,
      `def application(environ, start_response):\n    start_response("200 OK", [("Content-Type", "text/plain")])\n    return [b"Qadbak Python app: ${appName}\\n"]\n`,
      "utf8",
    );
  }
  const unit = `qadbak-python-${user}-${appName}.service`;
  const unitPath = `/etc/systemd/system/${unit}`;
  const unitBody = `[Unit]
Description=Qadbak Python ${appName} (${domain})
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${appsDir}
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:${listenPort} app:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
`;
  await writeFile(`/tmp/${unit}`, unitBody, "utf8");
  await exec("cp", [`/tmp/${unit}`, unitPath]);
  await exec("systemctl", ["daemon-reload"]);
  await exec("systemctl", ["enable", "--now", unit]);
  await upsertProxy(domain, "/", `http://127.0.0.1:${listenPort}`);
  const cfg = await readDomainConfigJson(domain, CFG, { apps: [] });
  cfg.apps.push({
    type: "python",
    name: appName,
    port: listenPort,
    unit,
    installedAt: new Date().toISOString(),
  });
  await writeDomainConfigJson(domain, CFG, cfg);
  emit({ ok: true, type: "python", name: appName, port: listenPort });
}

export async function runtimesDockerInstall(domain, name) {
  const { user, home } = await resolveDomainUser(domain);
  const appName = String(name || "stack").replace(/[^a-z0-9-]/gi, "");
  const appsDir = path.join(home, "apps", appName);
  await mkdir(appsDir, { recursive: true });
  const compose = path.join(appsDir, "docker-compose.yml");
  if (!(await fileExists(compose))) {
    await writeFile(
      compose,
      `services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "127.0.0.1:8088:80"\n    restart: unless-stopped\n`,
      "utf8",
    );
  }
  const composeYaml = await readFile(compose, "utf8");
  assertComposePolicyYaml(composeYaml);
  await exec("sudo", ["-u", user, "docker", "compose", "-f", compose, "up", "-d"], {
    cwd: appsDir,
    timeout: 300_000,
  }).catch(() => {
    fail("Docker compose failed — install docker.io and add user to docker group");
  });
  const cfg = await readDomainConfigJson(domain, CFG, { apps: [] });
  cfg.apps.push({
    type: "docker",
    name: appName,
    compose,
    installedAt: new Date().toISOString(),
  });
  await writeDomainConfigJson(domain, CFG, cfg);
  emit({ ok: true, type: "docker", name: appName, compose });
}

async function upsertProxy(domain, loc, dest) {
  const { user } = await resolveDomainUser(domain);
  let pathKey = String(loc || "/").trim();
  if (!pathKey.startsWith("/")) pathKey = `/${pathKey}`;
  if (pathKey !== "/") pathKey = `${pathKey.replace(/\/+$/, "")}/`;
  const proxies = await readDomainConfigJson(domain, "proxies.json", []);
  const idx = proxies.findIndex((p) => p.path === pathKey);
  const row = { path: pathKey, dest: String(dest).trim(), type: "proxy" };
  if (idx >= 0) proxies[idx] = row;
  else proxies.push(row);
  await writeDomainConfigJson(domain, "proxies.json", proxies);
  await exec("bash", [path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh"), domain, user], {
    timeout: 120_000,
  });
}

export async function runtimesDockerAction(domain, name, action) {
  const { user, home } = await resolveDomainUser(domain);
  const appName = String(name || "stack").replace(/[^a-z0-9-]/gi, "");
  const compose = path.join(home, "apps", appName, "docker-compose.yml");
  const act = String(action || "status").toLowerCase();
  if (act === "start") {
    const composeYaml = await readFile(compose, "utf8");
    assertComposePolicyYaml(composeYaml);
  }
  const args =
    act === "start"
      ? ["compose", "-f", compose, "up", "-d"]
      : act === "stop"
        ? ["compose", "-f", compose, "down"]
        : act === "logs"
          ? ["compose", "-f", compose, "logs", "--tail", "80"]
          : ["compose", "-f", compose, "ps"];
  const { stdout } = await exec("sudo", ["-u", user, "docker", ...args], {
    cwd: path.dirname(compose),
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  emit({ ok: true, action: act, output: stdout.slice(-8000) });
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
