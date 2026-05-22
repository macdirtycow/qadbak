const fs = require("fs");
const path = require("path");

/** Load .env.local so pm2 always has VIRTUALMIN_* (Next.js also reads it, but pm2 env must match). */
function loadEnvFile(filePath) {
  const env = {
    NODE_ENV: "production",
    PORT: "3000",
  };
  if (!fs.existsSync(filePath)) return env;
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
    env[key] = val;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "qadbak",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: loadEnvFile(path.join(__dirname, ".env.local")),
    },
  ],
};
