import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const exec = promisify(execFile);
const SENDMAIL = "/usr/sbin/sendmail";

/** Queue mail via Postfix sendmail (run as root). */
export function queueSendmail(from, message, timeoutMs = 25_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(SENDMAIL, ["-f", from, "-t", "-i"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("sendmail timed out — check /var/log/mail.log"));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sendmail exited with code ${code}`));
    });
    proc.stdin.write(message);
    proc.stdin.end();
  });
}

function buildRfc822(from, to, subject, body) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${String(subject).replace(/\r?\n/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    String(body),
    "",
  ].join("\r\n");
}

/** Inject a message via SMTP to localhost:25 (same path as external inbound mail). */
export async function smtpInjectLocal(to, from, subject, body) {
  const msg = buildRfc822(from, to, subject, body);
  const tmp = `/tmp/qadbak-inject-${randomBytes(6).toString("hex")}.eml`;
  await writeFile(tmp, msg, "utf8");
  const script = `
import socket, sys, pathlib
to = sys.argv[1]
from_addr = sys.argv[2]
path = pathlib.Path(sys.argv[3])
raw = path.read_text()
s = socket.create_connection(("127.0.0.1", 25), timeout=15)
def rd():
    return s.recv(8192).decode(errors="replace")
def wr(m):
    s.sendall((m + "\\r\\n").encode())
rd()
wr("HELO qadbak-local-inject")
rd()
wr("MAIL FROM:<" + from_addr + ">")
r = rd()
if not r.startswith("250"):
    print(r.strip()); sys.exit(1)
wr("RCPT TO:<" + to + ">")
r = rd()
if not r.startswith("250"):
    print(r.strip()); sys.exit(1)
wr("DATA")
r = rd()
if not r.startswith("354"):
    print(r.strip()); sys.exit(1)
payload = raw.replace("\\n", "\\r\\n")
if not payload.endswith("\\r\\n"):
    payload += "\\r\\n"
s.sendall(payload.encode())
s.sendall(b".\\r\\n")
r = rd()
wr("QUIT")
if not r.startswith("250"):
    print(r.strip()); sys.exit(1)
print("250 OK")
`;
  try {
    const { stdout, stderr } = await exec(
      "python3",
      ["-c", script, to, from, tmp],
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
    );
    const line = stdout.trim() || stderr.trim();
    if (!line.includes("250")) {
      throw new Error(line || "SMTP inject failed");
    }
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function deliverLocalMessage(to, subject, body, from = "postmaster@localhost") {
  const message = buildRfc822(from, to, subject, body);
  try {
    await smtpInjectLocal(to, from, subject, body);
    return { method: "smtp" };
  } catch (smtpErr) {
    try {
      await queueSendmail(from, message);
      return { method: "sendmail", smtpError: String(smtpErr) };
    } catch (sendmailErr) {
      const a = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      const b = sendmailErr instanceof Error ? sendmailErr.message : String(sendmailErr);
      throw new Error(`Local delivery failed (smtp: ${a}; sendmail: ${b})`);
    }
  }
}
