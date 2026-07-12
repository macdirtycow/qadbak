#!/usr/bin/env node
/** Write data/domain-config/DOMAIN/website.json (canonical web root for nginx). */
import { writeDomainConfigJson } from "./provisioning-common.mjs";

const args = process.argv.slice(2);
const domain = args[0]?.trim().toLowerCase();
if (!domain) {
  process.stderr.write(
    "Usage: node write-website-config.mjs DOMAIN --webRoot PATH [--mode static|php] [--wwwRedirect apex|none]\n",
  );
  process.exit(1);
}

let webRoot = "";
let mode = "php";
let wwwRedirect = "none";
let cacheStaticAssets = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "--webRoot" && args[i + 1]) {
    webRoot = args[++i];
  } else if (a === "--mode" && args[i + 1]) {
    mode = args[++i];
  } else if (a === "--wwwRedirect" && args[i + 1]) {
    wwwRedirect = args[++i];
  } else if (a === "--cacheStaticAssets") {
    cacheStaticAssets = true;
  }
}

if (!webRoot && mode !== "php") {
  process.stderr.write("--webRoot is required for non-default website config\n");
  process.exit(1);
}

const data = {
  ...(webRoot ? { webRoot } : {}),
  mode,
  wwwRedirect,
  ...(cacheStaticAssets ? { cacheStaticAssets: true } : {}),
};

const path = await writeDomainConfigJson(domain, "website.json", data);
process.stdout.write(`${JSON.stringify({ ok: true, path, ...data })}\n`);
