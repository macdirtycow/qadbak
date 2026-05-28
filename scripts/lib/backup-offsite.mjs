import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { readDomainConfigJson } from "./provisioning-common.mjs";
import { cloudCredentialsResolve } from "./cloud-credentials.mjs";

const exec = promisify(execFile);

export async function maybeUploadBackupOffsite(domain, archivePath, archiveName) {
  const policy = await readDomainConfigJson(domain, "backup-policy.json", {
    offsite: false,
    providerId: "default",
  });
  if (!policy.offsite) return { uploaded: false, reason: "offsite disabled" };
  let cred;
  try {
    cred = await cloudCredentialsResolve(policy.providerId || "default");
  } catch {
    return { uploaded: false, reason: "no cloud credentials" };
  }
  const key = `${cred.prefix}/${domain}/${archiveName}`.replace(/\/+/g, "/");
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: cred.accessKey,
    AWS_SECRET_ACCESS_KEY: cred.secretKey,
  };
  if (cred.endpoint) {
    env.AWS_ENDPOINT_URL = cred.endpoint;
  }
  const dest = `s3://${cred.bucket}/${key}`;
  await exec(
    "aws",
    ["s3", "cp", archivePath, dest, "--only-show-errors"],
    { env, timeout: 900_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return { uploaded: true, uri: dest, key };
}
