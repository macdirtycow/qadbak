#!/usr/bin/env bash
# Sync GitHub repository "About" sidebar (description + homepage).
# Requires: gh auth login
set -euo pipefail

REPO="${GITHUB_REPO:-macdirtycow/qadbak}"
DESC="${QADBAK_GITHUB_DESCRIPTION:-Self-hosted hosting panel (Ubuntu) — native mail/DNS/SSL, API v1, WHMCS, WAF, offsite backups. Premium from €2.50.}"
HOME="${QADBAK_GITHUB_HOMEPAGE:-https://qadbak.com}"

# Discoverability — keep concise and SEO-relevant.
TOPICS_DEFAULT="hosting,hosting-panel,control-panel,vps,nginx,mariadb,postfix,dovecot,bind9,ubuntu,self-hosted,nextjs,typescript,cpanel-alternative,plesk-alternative,hestiacp-alternative,php-fpm,lets-encrypt,gdpr,inveil"
TOPICS="${QADBAK_GITHUB_TOPICS:-$TOPICS_DEFAULT}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

gh repo edit "$REPO" --description "$DESC" --homepage "$HOME"

# Apply topics via the GitHub API. PUT /repos/{owner}/{repo}/topics expects
# a JSON body of the shape {"names":["topic1","topic2"]}.
IFS=',' read -ra TOPIC_LIST <<<"$TOPICS"
TOPIC_BODY='{"names":['
for t in "${TOPIC_LIST[@]}"; do
  TOPIC_BODY+="\"$(echo "$t" | tr -d ' ')\","
done
TOPIC_BODY="${TOPIC_BODY%,}]}"
echo "$TOPIC_BODY" | gh api -X PUT "repos/$REPO/topics" \
  -H "Accept: application/vnd.github+json" \
  --input - >/dev/null \
  || echo "  WARN: could not set topics — set them manually in the repo's About sidebar." >&2

echo "OK — GitHub About updated for $REPO"
gh repo view "$REPO" --json description,homepageUrl,repositoryTopics
