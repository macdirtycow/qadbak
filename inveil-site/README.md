# Inveil company site

Static marketing site for **https://inveil.net**. **https://inveil.dev** redirects to inveil.net (same VPS).

## Deploy (main VPS, e.g. 158.220.85.245)

```bash
cd /opt/qadbak && git pull
sudo bash inveil-site/ops/deploy-inveil-site.sh
```

Configures nginx + TLS for **inveil.net**, **www.inveil.net**, and **inveil.dev**.

## Cloudflare DNS — two zones

### Zone `inveil.net`

| Name | Type | Content |
|------|------|---------|
| `@` | A | `158.220.85.245` (your main VPS IP) |
| `www` | CNAME | `inveil.net` |

### Zone `inveil.dev` (separate domain in Cloudflare)

| Name | Type | Content |
|------|------|---------|
| `@` | A | `158.220.85.245` (same VPS as inveil.net) |

Orange cloud (proxy) is OK on both zones if TCP 80/443 are open on the VPS.

**Verify:**

```bash
curl -sI https://inveil.net/ | head -3
curl -sI https://inveil.dev/ | head -3   # HTTP 301 → inveil.net
```

**Error 523:** See [docs/CLOUDFLARE.md](../docs/CLOUDFLARE.md) — A record **Content** must be the VPS IP, not Cloudflare anycast lookup results.

Mail: `sudo bash scripts/setup-mail.sh inveil.net`

If the domain still uses legacy unix user `omiiba`:

```bash
sudo bash scripts/rename-domain-unix-user.sh omiiba inveil inveil.net
```

## Build zip

```bash
bash scripts/build-inveil-site-zip.sh
```
