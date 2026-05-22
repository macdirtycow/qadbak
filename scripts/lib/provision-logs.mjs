import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, resolveDomainUser, fileExists } from "./provisioning-common.mjs";

const exec = promisify(execFile);

export async function logsTail(domain, logType) {
  const { user, home } = await resolveDomainUser(domain);
  const kind = logType === "error" ? "error" : "access";
  const candidates = [
    `/var/log/apache2/domains/${domain}.${kind}_log`,
    `/var/log/apache2/${domain}-${kind}.log`,
    `/var/log/apache2/${user}-${kind}.log`,
    `${home}/logs/${kind}.log`,
    `${home}/log/${kind}.log`,
  ];
  if (kind === "error") {
    candidates.unshift(`/var/log/nginx/error.log`);
  } else {
    candidates.unshift(`/var/log/nginx/access.log`);
  }

  for (const file of candidates) {
    if (!(await fileExists(file))) continue;
    try {
      const { stdout } = await exec("tail", ["-n", "120", file], {
        maxBuffer: 2 * 1024 * 1024,
      });
      const lines = stdout.split("\n").filter((l) => l.includes(domain) || file.includes(domain));
      const log = lines.length ? lines.join("\n") : stdout;
      emit({ ok: true, log, file, source: "native-tail" });
      return;
    } catch {
      /* */
    }
  }

  try {
    const text = await readFile("/var/log/nginx/error.log", "utf8");
    const tail = text.split("\n").slice(-80).join("\n");
    emit({ ok: true, log: tail, file: "/var/log/nginx/error.log", source: "native-tail" });
  } catch {
    emit({ ok: true, log: "(no log file found for this domain)", source: "native-tail" });
  }
}
