import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

function sqlQuote(id) {
  return `\`${String(id).replace(/`/g, "")}\``;
}

async function mysqlExec(sql) {
  const args = ["-N", "-B", "-e", sql];
  try {
    const { stdout } = await exec("mysql", args, { maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (err.includes("Access denied")) {
      fail("MySQL root access required for native databases (configure root .my.cnf on server)");
    }
    throw e;
  }
}

export async function dbList(domain) {
  const { user } = await resolveDomainUser(domain);
  const prefix = `${user}_`;
  const out = await mysqlExec("SHOW DATABASES");
  const databases = out
    .split("\n")
    .filter((name) => name.startsWith(prefix) || name === user.replace(/-/g, "_"))
    .map((name) => ({ name, type: "mysql", host: "localhost" }));
  emit({ ok: true, databases });
}

export async function dbCreate(domain, name, pass) {
  const { user } = await resolveDomainUser(domain);
  const dbName = sqlQuote(name);
  const dbUser = sqlQuote(`${user}_${name}`.slice(0, 32));
  await mysqlExec(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
  await mysqlExec(
    `CREATE USER IF NOT EXISTS ${dbUser}@'localhost' IDENTIFIED BY '${pass.replace(/'/g, "''")}'`,
  );
  await mysqlExec(`GRANT ALL PRIVILEGES ON ${dbName}.* TO ${dbUser}@'localhost'`);
  await mysqlExec("FLUSH PRIVILEGES");
  emit({ ok: true, name, user: dbUser.replace(/`/g, "") });
}

export async function dbPass(domain, name, pass) {
  const { user } = await resolveDomainUser(domain);
  const dbUser = sqlQuote(`${user}_${name}`.slice(0, 32));
  await mysqlExec(
    `ALTER USER ${dbUser}@'localhost' IDENTIFIED BY '${pass.replace(/'/g, "''")}'`,
  );
  await mysqlExec("FLUSH PRIVILEGES");
  emit({ ok: true });
}
