# Contabo + Qadbak panel port

## Two firewalls

| Layer | Where | Panel port |
|-------|--------|------------|
| **Cloud** | Contabo → Network Services → Firewall | Inbound **TCP 11000 Accept** (and 22, 80, 443) **before** “Block all” |
| **VPS OS** | iptables / firewalld / UFW (VirtualMin often sets iptables) | `sudo bash /opt/qadbak/scripts/open-host-firewall-port.sh 11000` |

Both must allow the port. SSH (22) from your Mac works → cloud firewall is linked to the VPS; add **11000** the same way.

## Assign firewall to VPS

Firewall detail → tab **Active VPS/VDS** → assign **vmi…** (must show **1**, not 0).

## Fix “Connection refused” on Mac

On the server:

```bash
cd /opt/qadbak
git pull
sudo bash scripts/fix-external-panel-access.sh 11000
```

On your Mac:

```bash
nc -zv YOUR_SERVER_IP 11000
```

Then: `http://YOUR_SERVER_IP:11000/login`

## Install tips

- Panel hostname: use your **VPS FQDN** (e.g. `vps.example.com`) or provider hostname — **not** the bare IP.
- Installer asks for port **11000** by default on Contabo-friendly setups.
