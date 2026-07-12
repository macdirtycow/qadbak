# Inveil company site

Static marketing site for **https://inveil.net**.

## Deploy

```bash
cd /opt/qadbak && git pull
sudo bash inveil-site/ops/deploy-inveil-site.sh
```

## Cloudflare DNS

| Record | Type | Content | Proxy |
|--------|------|---------|-------|
| `@` | A | Your VPS IP (e.g. `158.220.85.245`) | Orange OK |
| `www` | CNAME | `inveil.net` | Orange OK |
| `inveil.dev` | A | Same VPS IP | Orange OK |

**Error 523:** Cloudflare cannot reach your VPS on ports **80/443**. The A record **Content** in Cloudflare must be your real VPS IP — not the public `104.21.x` / `172.67.x` lookup results. Open TCP 80+443 in Contabo firewall. See [docs/CLOUDFLARE.md](../docs/CLOUDFLARE.md).

Mail (MX, SPF, DKIM): `sudo bash scripts/setup-mail.sh inveil.net`

## Build zip

```bash
bash scripts/build-inveil-site-zip.sh
```
