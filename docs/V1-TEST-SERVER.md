# v1 test server — step by step

Use a **dedicated** VPS. Do **not** install Qadbak on mareades or any server with live customer sites.

**Goal:** prove v1 on Ubuntu 22.04 + VirtualMin 8 with `VIRTUALMIN_MOCK=false`, then sign off [E2E-CHECKLIST.md](./E2E-CHECKLIST.md).

**Time:** ~1–2 hours first time (VirtualMin install is slow).

---

## Before you start

| Requirement | Notes |
|-------------|--------|
| VPS | Ubuntu **22.04**, 2 GB+ RAM, root SSH |
| DNS | Subdomain → VPS IP, e.g. `panel-test.yourdomain.com` |
| Access | SSH key, no production data on this box |

Pick:

- `PANEL_HOST` = your test subdomain (e.g. `panel-test.yourdomain.com`)
- `TEST_DOMAIN` = one **fake** domain you create in VirtualMin (e.g. `v1test.example.com`)

---

## Step 1 — Rent and log in

1. Create the VPS (Hetzner, DigitalOcean, OVH, etc.).
2. Point `PANEL_HOST` A-record to the VPS IP.
3. `ssh root@VPS_IP`

---

## Step 2 — Install (one script)

```bash
apt-get update && apt-get install -y git
git clone https://github.com/macdirtycow/qadbak.git /opt/qadbak
cd /opt/qadbak
sudo bash install/qadbak-install.sh
```

When prompted:

| Prompt | What to enter |
|--------|----------------|
| Panel hostname | `panel-test.yourdomain.com` (your test subdomain) |
| Also HTTPS for server FQDN? | **Y** (hostname from `hostname -f`) |
| Webmin root password | New or existing root password for **this test box only** |
| Qadbak admin user/password | e.g. `admin` + strong password |
| Certbot email | Your email |

Wait until the script finishes. VirtualMin install can take 15–40 minutes.

The installer also installs **Node.js 20, npm, and pm2** — you do not need to run `apt install npm` separately.

---

## Step 3 — API smoke test

```bash
sudo -u qadbak bash -c 'cd /opt/qadbak && npm run test-api'
```

You must see JSON from `list-domains` (may be empty `[]` on a fresh server).

If TLS errors to `127.0.0.1:10000`:

```bash
# Already set by installer; if needed:
grep NODE_TLS /opt/qadbak/.env.local
```

---

## Step 4 — Front door (Qadbak, not Webmin)

On your laptop browser:

| URL | Expected |
|-----|----------|
| `http://VPS_IP/` | Qadbak marketing / home (not Webmin) |
| `https://PANEL_HOST/` | Same |
| `https://PANEL_HOST/login` | Qadbak login page |
| `https://PANEL_HOST:10000` | Classic Webmin (engine only — do not give to clients) |

If `http://VPS_IP` shows Apache/default: re-run nginx step from [FRONT-DOOR.md](./FRONT-DOOR.md).

### Provider firewall blocks port 80?

Use an extra panel port (default **11000** — not Webmin’s **10000**):

```bash
sudo bash /opt/qadbak/scripts/enable-panel-port.sh 11000
```

Open **TCP 11000** in the Contabo (or other) firewall panel, then open  
`http://VPS_IP:11000/login` on your Mac.

---

## Step 5 — Automated preflight (on VPS)

```bash
cd /opt/qadbak
sudo -u qadbak bash scripts/v1-test-preflight.sh
```

Fix anything marked FAIL before continuing.

---

## Step 6 — Create a test virtual server

In VirtualMin (via `https://PANEL_HOST:10000` **only for this step**, or embed after login):

1. Create domain `v1test.example.com` (or your `TEST_DOMAIN`).
2. Note the exact domain name.

Optional — client role test:

```bash
# Set client to only see that domain
sudo -u qadbak nano /opt/qadbak/data/users.json
# Under role "client", set "domains": ["v1test.example.com"]
HASH=$(sudo -u qadbak node /opt/qadbak/scripts/hash-password.mjs 'ClientTest123!')
# Set client passwordHash, pm2 restart qadbak
sudo -u qadbak bash -c 'cd /opt/qadbak && pm2 restart qadbak'
```

Add to `/opt/qadbak/.env.local`:

```env
TEST_DOMAIN=v1test.example.com
```

---

## Step 7 — Sign in as admin

1. Open `https://PANEL_HOST/login`
2. Log in with installer admin credentials.
3. Dashboard → **Domains** list must match VirtualMin (including `v1test.example.com`).

---

## Step 8 — v1 admin flows (E2E part 1)

Check each (see [E2E-CHECKLIST.md](./E2E-CHECKLIST.md)):

- [ ] `/domains/new` — create another test domain (or skip if Step 6 enough)
- [ ] `/domains/new?type=sub` — sub-server (optional)
- [ ] `/domains/new?type=alias` — alias (optional)
- [ ] `/admin/status` — dashboard embed loads
- [ ] `/admin/system-menu` — open one embed module
- [ ] `/admin/resellers`, `/admin/plans`, `/admin/cloud`, `/admin/license` — pages load

---

## Step 9 — v1 per-domain flows (E2E part 2)

Open `https://PANEL_HOST/domains/v1test.example.com` and test:

- [ ] Overview
- [ ] Email — list; create one mailbox
- [ ] DNS — view; add one record
- [ ] SSL — list certificates
- [ ] Files — file manager embed opens
- [ ] Terminal — terminal embed opens
- [ ] Backups — list schedules
- [ ] Lifecycle — **do not** delete production; only disable a **disposable** test domain if needed

---

## Step 10 — Client role (E2E part 3)

- [ ] Log out; log in as `client` user (after Step 6 users.json)
- [ ] Only `v1test.example.com` visible
- [ ] `/admin` blocked or forbidden

---

## Step 11 — Record results

Copy checklist to your notes:

```bash
# On VPS — optional API retest with domain
sudo -u qadbak bash -c 'cd /opt/qadbak && TEST_DOMAIN=v1test.example.com npm run test-api'
```

Mark [E2E-CHECKLIST.md](./E2E-CHECKLIST.md) complete in git or project wiki when all boxes pass.

---

## Step 12 — v1 signed off

When Steps 7–10 pass:

- **v1 code** is validated for real VirtualMin.
- Safe to plan production panel host (still **not** mareades unless you migrate deliberately).
- v2+ (native System/Servers UI) can continue in repo; not required for v1 exit.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `test-api` 401 | Wrong `VIRTUALMIN_PASS` in `.env.local` |
| Empty domain list in Qadbak but domains in VM | Restart `pm2 restart qadbak`; check `VIRTUALMIN_URL` |
| Embed blank | `WEBMIN_UI_URL` must be reachable from **your browser** (use `https://PANEL_HOST:10000` or server FQDN) |
| Login 500 | `SESSION_SECRET` set; `data/users.json` exists |
| Still land on Webmin at port 80 | nginx default site; see [FRONT-DOOR.md](./FRONT-DOOR.md) |

---

## Local development (no VPS)

For UI work only:

```bash
cp .env.example .env.local
# VIRTUALMIN_MOCK=true
npm install && npm run dev
```

This does **not** replace Steps 1–10 for v1 sign-off.
