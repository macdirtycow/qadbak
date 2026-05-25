#!/usr/bin/env node
/**
 * Smoke-loader for the terminal WS deps — runs as the EXACT
 * resolution context that scripts/domain-terminal-ws.mjs uses.
 *
 * Mirrors the createRequire trick from domain-terminal-ws.mjs so this
 * smoke catches the same ERR_MODULE_NOT_FOUND / corrupt-install states
 * that the real pm2 spawn hits at startup. Anything that loads here
 * will load in the real terminal launcher.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const require = createRequire(path.join(ROOT, "package.json"));

await import("jose");
require("ws");
require("node-pty");

console.log("OK — ws + node-pty + jose load cleanly from scripts/ context");
