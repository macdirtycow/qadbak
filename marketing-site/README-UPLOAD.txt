Nexmin marketing site — static zip (optional)
=============================================

RECOMMENDED: Deploy the full Nexmin Next.js app on nexmin.net instead of
uploading this zip. That gives you:
  • Marketing homepage at https://nexmin.net/
  • Working “Open panel” at https://nexmin.net/login

See the main repo README (Production section) and deploy/nginx-nexmin.conf.

If you still use this static zip (no Node app):
  • Upload all files to public_html.
  • “Open panel” links to https://nexmin.net/login — that only works if the
    Nexmin app is running on the same domain (reverse proxy to port 3000).
  • Edit index.html panel URLs if your panel lives elsewhere.

Rebuild zip: bash scripts/build-marketing-zip.sh
