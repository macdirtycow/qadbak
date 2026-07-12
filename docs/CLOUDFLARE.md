# Cloudflare + Qadbak / legacy hosting API

## Error 523 — Origin is unreachable

Cloudflare (orange cloud) proxies visitors but connects to **your VPS** on ports **80** and **443**. Error **523** means that connection failed.

### Fix order (on the VPS)

```bash
cd /opt/qadbak && git pull
sudo bash scripts/configure-domain-repair-sudo.sh   # once
sudo bash scripts/fix-domain-website.sh example.com
```

In **Qadbak** → domain overview → **Website & Cloudflare** → **Repair on server** (admin).

### Cloudflare DNS

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `@` | A | Your VPS public IP | Proxied OK |
| `www` | A or CNAME | Same origin | Proxied OK |

The **Content** column in Cloudflare must be your VPS public IP. Public `dig` may show Cloudflare anycast IPs when proxied — that is normal. Error **523** = Cloudflare cannot reach that origin IP on **80/443** (fix IP in Cloudflare or open Contabo firewall).

Set in server `.env.local`:

```env
QADBAK_ORIGIN_IP=YOUR_VPS_PUBLIC_IP
```

### Contabo firewall (Inbound Rules)

Rules are evaluated **top to bottom**. **Accept rules for 80 and 443 must sit above** “Block all traffic”.

| Rule | Required |
|------|----------|
| TCP **80** ACCEPT | **Yes** — Cloudflare Flexible uses HTTP to origin |
| TCP **443** ACCEPT | Yes — for HTTPS / Full SSL |
| TCP 11000 | Qadbak panel only |

Your screenshot had **443** and **11000**, but **no dedicated TCP 80** rule. A broad “ssh / Any port” rule may cover IPv4, but add an explicit rule to be safe:

- **Action:** ACCEPT · **Protocol:** TCP · **Port:** 80 · **Source:** Any  
- Place it **above** “Block all traffic”.

Also open port 80 on the **VPS OS** firewall:

```bash
sudo bash /opt/qadbak/scripts/open-host-firewall-port.sh 80
sudo bash /opt/qadbak/scripts/open-host-firewall-port.sh 443
```

See [CONTABO-FIREWALL.md](./CONTABO-FIREWALL.md).

### SSL mode

| Origin HTTPS | Cloudflare SSL |
|--------------|----------------|
| Not yet (HTTP only) | **Flexible** |
| Let's Encrypt on server | **Full** |

Generate SSL in Qadbak → domain → **SSL** (Let's Encrypt).

### Diagnose

```bash
# On VPS — must return HTTP headers
curl -sI -H "Host: example.com" http://127.0.0.1/

# From your Mac — ports open?
nc -zv YOUR_VPS_IP 80 443
```

If local curl works but Cloudflare still shows 523, the origin IP in Cloudflare or the provider firewall is wrong.

## Error 520 — Web server returned an unknown error

Cloudflare reaches your VPS but the origin returns an **empty or invalid** response. Common after `update-qadbak.sh` / phase-8 nginx changes when `panel.<domain>` vhosts were not re-applied.

### Fix on the VPS (root)

```bash
cd /opt/qadbak
sudo bash scripts/fix-panel-now.sh
# or one customer domain:
sudo bash scripts/fix-panel-now.sh siccamanagement.nl
```

(`fix-panel-now.sh` is the same as `repair-panel-access.sh`.)

This script checks pm2 + `:3000/api/health`, recreates `panel.<domain>` nginx vhosts, refreshes the main panel on `:11000`, opens firewall ports 80/443, and restarts pm2.

`update-qadbak.sh` runs the same repair automatically at the end of each update.

### Cloudflare SSL

**Important for `panel.<domain>`:** the panel vhost serves **HTTP on port 80** to the app (no forced redirect). That is required when Cloudflare SSL is **Flexible** (Cloudflare talks HTTP to your server). If you use **Full**, HTTPS on port 443 also works after Let's Encrypt.

Same as [502](#error-502--bad-gateway): use **Flexible** if the origin has no cert on `panel.<domain>` yet; use **Full** after Let's Encrypt (the repair script runs certbot when DNS points at the server). Avoid **Full (strict)** until the origin certificate is valid.

### HTTP works but HTTPS does not (or the opposite)

| What you see | Typical cause | Fix |
|--------------|---------------|-----|
| `http://panel.example.com` OK, `https://` fails | Cloudflare **Flexible** + origin had only HTTP, or no LE cert on `:443` yet | Run `sudo bash scripts/fix-panel-now.sh example.com`; set CF SSL to **Flexible** until certbot succeeds |
| `https://` OK after repair, earlier only HTTP worked | LE cert issued on origin `:443`; CF mode **Full** now valid | Set Cloudflare SSL to **Full** (not strict until cert is valid) |
| Both fail via Cloudflare, origin OK locally | Wrong DNS, blocked port 80/443, or stale 520 from old redirect | [fix-panel-now.sh](../scripts/fix-panel-now.sh), open ports 80+443, `diagnose-panel-access.sh` |

Re-apply vhosts after pull:

```bash
cd /opt/qadbak && sudo bash scripts/git-sync-origin.sh
sudo bash scripts/fix-panel-now.sh YOUR-DOMAIN.TLD
sudo bash scripts/diagnose-panel-access.sh panel.YOUR-DOMAIN.TLD
```

### Diagnose only

```bash
sudo bash scripts/repair-panel-access.sh --check-only
curl -sI -H "Host: panel.example.com" http://127.0.0.1/login | head -8
```

## Error 502 — Bad gateway

Cloudflare **does** reach your VPS, but the response from the origin is invalid (often nginx cannot proxy to Apache, or Cloudflare uses **HTTPS** to the origin while only HTTP on port 80 is configured).

### Fix on the VPS

```bash
cd /opt/qadbak && git pull
sudo bash scripts/fix-origin-502.sh example.com
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run build'
sudo bash scripts/pm2-restart-qadbak.sh
```

### Cloudflare SSL

If the origin has **no** Let's Encrypt certificate yet, set **SSL/TLS → Overview → Flexible** (Cloudflare talks HTTP to your server on port 80). **Full** without a cert on the VPS often causes **502**.

### Diagnose

```bash
curl -sI -H "Host: example.com" http://127.0.0.1/    # must not be 502
curl -sI -H "Host: example.com" http://127.0.0.1:8080/  # Apache backend
sudo tail -20 /var/log/nginx/error.log
```
