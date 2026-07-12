# Inveil company site

Static marketing site for **https://inveil.net**. **https://inveil.dev** redirects to inveil.net (same VPS).

## Deploy (your main VPS)

```bash
cd /opt/qadbak && git pull
sudo bash inveil-site/ops/deploy-inveil-site.sh
```

Configures nginx + TLS for **inveil.net**, **www.inveil.net**, and **inveil.dev**.

## Cloudflare DNS — two zones

### Zone `inveil.net`

| Name | Type | Content |
|------|------|---------|
| `@` | A | Your main VPS public IP |
| `www` | CNAME | `inveil.net` |

### Zone `inveil.dev` (separate domain in Cloudflare)

| Name | Type | Content |
|------|------|---------|
| `@` | A | Same VPS IP as inveil.net |

Orange cloud (proxy) is OK on both zones if TCP 80/443 are open on the VPS.

**Mail DNS** (same zone `inveil.net`) — **must be DNS only (grey cloud)** for MX and `mail` A:

| Name | Type | Content |
|------|------|---------|
| `@` | MX (pri 10) | `mail.inveil.net` |
| `mail` | A | Your VPS public IP |
| `@` | TXT | `v=spf1 mx a ip4:YOUR_VPS_IP ~all` |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@inveil.net; fo=1` |
| `mail._domainkey` | TXT | From VPS after `setup-mail.sh` |

Disable **Cloudflare Email Routing** for `inveil.net` if enabled (it replaces MX with `_dc-mx…` and breaks VPS mail).

Contabo: set **reverse DNS (PTR)** for the VPS IP to `mail.inveil.net`.

```bash
sudo bash scripts/repair-domain-mail.sh inveil.net info
bash scripts/check-outbound-mail-dns.sh inveil.net YOUR_VPS_IP
```

**Verify web:**

```bash
curl -sI https://inveil.net/ | head -3
curl -sI https://inveil.dev/ | head -3   # HTTP 301 → inveil.net
```

**Error 523:** See [docs/CLOUDFLARE.md](../docs/CLOUDFLARE.md) — A record **Content** must be the VPS IP, not Cloudflare anycast lookup results.

## Build zip

```bash
bash scripts/build-inveil-site-zip.sh
```
