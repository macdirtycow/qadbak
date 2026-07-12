#!/usr/bin/env bash
# Render a Qadbak-branded landing page for a customer domain's public_html/index.html.
# Usage:  write_qadbak_landing "$PUB" "$DOMAIN" "$OWNER"
#   PUB    - absolute path to the public_html directory (must exist)
#   DOMAIN - domain name (e.g. example.com)
#   OWNER  - "USER:GROUP" for chown (optional; defaults to leaving permissions alone)
#
# Only writes index.html when neither index.html nor index.php exists, so
# customer-uploaded content is never overwritten.

write_qadbak_landing() {
  local pub="$1"
  local domain="$2"
  local owner="${3:-}"

  [[ -d "$pub" ]] || return 0
  [[ -f "$pub/index.html" || -f "$pub/index.php" || -f "$pub/index.htm" ]] && return 0

  cat >"$pub/index.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${domain} — hosted on Qadbak</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1419;
      --surface: #1a2332;
      --border: #2d3a4f;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #e8ecf4;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(ellipse 80% 50% at 50% -8%, #1a2030 0%, transparent 58%), var(--bg);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 560px;
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
    }
    .mark {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.25rem;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      font-weight: 700;
      font-size: 1.4rem;
      color: #fff;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.4rem;
      word-break: break-all;
    }
    p { color: var(--muted); line-height: 1.55; margin: 0.5rem 0; }
    code {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 0.85em;
      padding: 0.1em 0.4em;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
    }
    .row { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
    a.btn {
      display: inline-block;
      padding: 0.55rem 1rem;
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    a.btn.ghost {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }
    .foot { margin-top: 1.5rem; font-size: 0.78rem; color: var(--muted); }
    .foot a { color: var(--muted); }
  </style>
</head>
<body>
  <main class="card">
    <div class="mark">Q</div>
    <h1>${domain}</h1>
    <p>This site is live and ready. Upload your files to <code>public_html</code> via the Qadbak file manager to replace this page.</p>
    <div class="row">
      <a class="btn" href="https://qadbak.com" rel="noopener">Get Qadbak</a>
      <a class="btn ghost" href="https://inveil.net" rel="noopener">By Inveil</a>
    </div>
    <p class="foot">
      Hosted on <a href="https://qadbak.com" rel="noopener">Qadbak</a> · open-source hosting panel by
      <a href="https://inveil.net" rel="noopener">Inveil</a>.
    </p>
  </main>
</body>
</html>
HTML

  if [[ -n "$owner" ]]; then
    chown "$owner" "$pub/index.html" 2>/dev/null || true
  fi
}
