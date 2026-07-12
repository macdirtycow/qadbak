# Docker admin (panel)

Qadbak can manage Docker on the **same host** as the panel when an admin opens **Server → Docker** (`/admin/docker`).

## What it does

- Lists containers, images, volumes, and networks via `docker` CLI (`execFile`, no shell).
- Starts, stops, restarts, and removes containers (with typed confirmation for remove).
- Pulls and removes images; removes unused volumes (with confirmation).
- Validates and deploys Compose projects from pasted YAML (temp file + `docker compose config` / `up` / `down`).

Domain-level Docker (per-client compose under `~/apps/`) remains in **Domains → Runtimes** and uses a separate provisioning path.

## Security

- **Admin only.** All routes use `requireAdmin()`; clients cannot call Docker APIs.
- **No shell interpolation.** Arguments are passed as argv to `docker`; user input is validated with strict allow-lists (container IDs, image refs, volume names, project names).
- **Compose YAML** is size-limited (256 KB) and validated with `docker compose config` before deploy.
- **Audit log.** Destructive actions (remove container/image/volume, compose up/down) are written to the activity log.
- **Docker socket.** The panel process must be able to talk to the local Docker daemon. Do not expose the Docker TCP socket to the internet. Prefer rootless Docker or group membership (`docker` group) with least privilege.
- **Host compromise.** Container management on the panel host is equivalent to root on that host. Treat Docker admin access like SSH root access.

## Requirements

- Docker Engine and Compose plugin installed (`scripts/lib/ensure-docker.sh` during Jellyfin/runtime provisioning).
- `docker` on PATH for the user running the Qadbak process (often `qadbak` via sudo or group membership).

## Limitations (MVP)

- No per-domain Docker RBAC in this screen (use domain runtimes for tenant-scoped stacks).
- No built-in registry credentials UI (pull public images or pre-login on the host).
- Compose deploy uses pasted YAML, not Git or file upload yet.
