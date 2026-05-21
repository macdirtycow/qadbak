Nexmin marketing site — upload package
======================================

Upload everything in this folder to your web root for nexmin.net
(cPanel "public_html", Plesk httpdocs, or /var/www/nexmin.net).

Folder structure after upload:
  index.html
  assets/css/style.css
  assets/js/main.js
  assets/img/favicon.svg

Before going live
-----------------
1. Edit assets/js/main.js — set PANEL_URL to your live panel URL
   (e.g. https://app.nexmin.net/login or https://nexmin.net:3000/login).

2. Enable HTTPS (Let's Encrypt) in your hosting panel.

3. If the Nexmin Next.js app runs on the SAME domain, either:
   - host this site at nexmin.net and the app on app.nexmin.net, OR
   - put this site in a subdirectory and the app at /login (adjust links).

Optional
--------
- Point DNS A/AAAA for nexmin.net (and www) to your server.
- Add www → apex redirect in hosting or use the nginx example in the main repo.

Support: info@mareades.com · Omiiba: https://omiiba.dev
