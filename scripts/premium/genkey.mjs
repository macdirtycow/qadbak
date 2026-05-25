#!/usr/bin/env node
/**
 * Generate an Ed25519 keypair for signing Qadbak Premium artifacts.
 *
 *   node scripts/premium/genkey.mjs [output-dir]
 *
 * Writes:
 *   <out>/qadbak-license-ed25519.pem      (private key, chmod 600)
 *   <out>/qadbak-license-ed25519.pub.pem  (public key — ship to panels as config/license-public.pem)
 *
 * Refuses to overwrite existing files.
 *
 * Recommended:
 *  - Store the .pem private key in a password manager / 1Password / vault.
 *    Reference it from $QADBAK_LICENSE_SIGNING_KEY during build only.
 *  - Commit the .pub.pem into the panel as config/license-public.pem so
 *    every customer panel can verify signatures locally.
 */

import { generateKeyPairSync } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function main() {
  const out = path.resolve(process.argv[2] || "./keys");
  await mkdir(out, { recursive: true });
  const priv = path.join(out, "qadbak-license-ed25519.pem");
  const pub = path.join(out, "qadbak-license-ed25519.pub.pem");

  if (existsSync(priv) || existsSync(pub)) {
    console.error(`error: keypair already exists at ${out}. Refusing to overwrite.`);
    process.exit(2);
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" });

  await writeFile(priv, privPem, { mode: 0o600 });
  await writeFile(pub, pubPem, { mode: 0o644 });
  await chmod(priv, 0o600);

  console.log(
    JSON.stringify(
      {
        ok: true,
        privateKey: priv,
        publicKey: pub,
        next: [
          "Set QADBAK_LICENSE_SIGNING_KEY=" + priv + " in your build env.",
          "Copy " +
            pub +
            " to config/license-public.pem in the public qadbak repo so customer panels can verify signatures.",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
