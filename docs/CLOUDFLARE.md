# Cloudflare + Qadbak / VirtualMin

## Error 523 — Origin is unreachable

Cloudflare (orange cloud) proxies visitors but connects to **your VPS** on ports **80** and **443**. Error **523** means that connection failed.

### Fix order (on the VPS)

```bash
cd /opt/qadbak && git pull
sudo bash scripts/configure-domain-repair-sudo.sh   # once
sudo bash scripts/fix-domain-website.sh siccamanagement.nl
```

In **Qadbak** → domain overview → **Website & Cloudflare** → **Repair on server** (admin).

### Cloudflare DNS

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `@` | A | Your VPS public IP (e.g. `173.212.250.158`) | Proxied OK |
| `www` | A or CNAME | Same origin | Proxied OK |

Set in server `.env.local`:

```env
QADBAK_ORIGIN_IP=173.212.250.158
```

(Public DNS may show Cloudflare IPs `104.21.x` / `172.67.x` when proxied — that is normal.)

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
curl -sI -H "Host: siccamanagement.nl" http://127.0.0.1/

# From your Mac — ports open?
nc -zv YOUR_VPS_IP 80 443
```

If local curl works but Cloudflare still shows 523, the origin IP in Cloudflare or the provider firewall is wrong.
