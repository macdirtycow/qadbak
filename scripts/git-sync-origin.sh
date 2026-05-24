#!/usr/bin/env bash
# Fetch origin and align the VPS checkout with the remote branch.
# Handles: history rewrites (reset --hard), cursor/* → macdirtycow/* rename, QADBAK_GIT_BRANCH.
set -euo pipefail

ROOT="${QADBAK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

if [[ ! -d .git ]]; then
  echo "git-sync-origin: not a git repository: $ROOT" >&2
  exit 1
fi

log() {
  echo "==> git-sync: $*"
}

fix_ownership_if_root() {
  if [[ "$(id -u)" -eq 0 ]] && [[ -f "$ROOT/scripts/fix-qadbak-ownership.sh" ]]; then
    bash "$ROOT/scripts/fix-qadbak-ownership.sh"
  fi
}

read_env_branch() {
  local f="$ROOT/.env.local"
  [[ -f "$f" ]] || return 0
  local line
  line="$(grep -E '^[[:space:]]*QADBAK_GIT_BRANCH=' "$f" | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  local v="${line#*=}"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  v="${v#\"}"; v="${v%\"}"
  v="${v#\'}"; v="${v%\'}"
  printf '%s' "$v"
}

migrate_cursor_branch_name() {
  local name="$1"
  if [[ "$name" == cursor/* ]]; then
    printf 'macdirtycow/%s' "${name#cursor/}"
  else
    printf '%s' "$name"
  fi
}

branch_exists_on_origin() {
  git show-ref --quiet "refs/remotes/origin/$1"
}

resolve_target_branch() {
  local env_branch current migrated

  env_branch="$(read_env_branch || true)"
  if [[ -n "$env_branch" ]]; then
    printf '%s' "$(migrate_cursor_branch_name "$env_branch")"
    return
  fi

  current="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "$current" || "$current" == "HEAD" ]]; then
    printf '%s' "main"
    return
  fi

  migrated="$(migrate_cursor_branch_name "$current")"
  printf '%s' "$migrated"
}

log "fetch origin (prune stale branches)"
git fetch --prune origin

if [[ -f "$ROOT/scripts/reset-git-drift-before-pull.sh" ]]; then
  bash "$ROOT/scripts/reset-git-drift-before-pull.sh"
fi

TARGET="$(resolve_target_branch)"

if ! branch_exists_on_origin "$TARGET"; then
  log "origin/$TARGET not found — trying main"
  TARGET="main"
fi

if ! branch_exists_on_origin "$TARGET"; then
  echo "git-sync-origin: no origin/main or configured branch on remote" >&2
  exit 1
fi

CURRENT="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
if [[ "$CURRENT" == cursor/* ]]; then
  MIGRATED_CURRENT="$(migrate_cursor_branch_name "$CURRENT")"
  if [[ "$CURRENT" != "$MIGRATED_CURRENT" ]]; then
    log "rename local branch $CURRENT → $MIGRATED_CURRENT"
    git branch -m "$CURRENT" "$MIGRATED_CURRENT" 2>/dev/null || true
    CURRENT="$MIGRATED_CURRENT"
  fi
fi

REMOTE_REF="origin/$TARGET"

if [[ "$CURRENT" != "$TARGET" ]]; then
  log "checkout $TARGET from $REMOTE_REF"
  if ! git checkout -B "$TARGET" "$REMOTE_REF" 2>/dev/null; then
    log "local changes blocked checkout — discarding tracked drift on server scripts"
    bash "$ROOT/scripts/reset-git-drift-before-pull.sh" 2>/dev/null || true
    git checkout -f -B "$TARGET" "$REMOTE_REF"
  fi
else
  git branch --set-upstream-to="$REMOTE_REF" "$TARGET" 2>/dev/null || true
fi

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "$REMOTE_REF")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  log "up to date ($TARGET @ ${LOCAL_SHA:0:7})"
  fix_ownership_if_root
  exit 0
fi

if git merge-base --is-ancestor HEAD "$REMOTE_SHA" 2>/dev/null; then
  log "fast-forward $TARGET (${LOCAL_SHA:0:7} → ${REMOTE_SHA:0:7})"
  git merge --ff-only "$REMOTE_REF"
else
  log "diverged history on $TARGET — reset --hard to ${REMOTE_SHA:0:7}"
  git reset --hard "$REMOTE_REF"
fi

log "synced $TARGET @ $(git rev-parse --short HEAD)"

fix_ownership_if_root
