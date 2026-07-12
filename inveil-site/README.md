# Inveil company site

Static marketing site for **https://inveil.net** — company home, product links, and license portal CTAs.

## Deploy on license VPS

Bundled in `qadbak-premium/inveil-site` and deployed automatically by:

```bash
sudo bash /opt/qadbak-premium/ops/migrate-to-inveil.sh
```

Manual deploy only:

```bash
sudo INVEIL_SITE_SRC=/opt/qadbak-premium/inveil-site bash inveil-site/ops/deploy-vps.sh
sudo bash /opt/qadbak-premium/ops/configure-inveil-site-nginx.sh
```

## Build zip (static host)

```bash
bash scripts/build-inveil-site-zip.sh
# → dist/inveil-site-upload.zip
```

## Structure

```
inveil-site/
  index.html
  assets/css/site.css
  assets/js/main.js
  assets/img/logo.svg
  ops/deploy-vps.sh
```

Also mirrored in `qadbak-premium/inveil-site` for license-server VPS deploys.
