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

### Contabo firewall

In the Contabo panel, allow **inbound TCP 80 and 443** (same as 22 and 11000). See [CONTABO-FIREWALL.md](./CONTABO-FIREWALL.md).

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
