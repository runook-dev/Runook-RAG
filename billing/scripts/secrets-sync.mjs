/**
 * Sync secret env files <-> AWS SSM Parameter Store (SecureString).
 *
 * SSM is the encrypted, durable source of truth so secrets survive host loss
 * and can be rotated centrally. The running services keep reading the local
 * env files (so a transient SSM failure can never block startup) — this script
 * just backs them up to / restores them from SSM.
 *
 *   node scripts/secrets-sync.mjs push <envfile> <prefix>
 *   node scripts/secrets-sync.mjs pull <envfile> <prefix>
 *
 * Examples (run on the host):
 *   node scripts/secrets-sync.mjs push ../deploy/engine.env /runook/engine
 *   node scripts/secrets-sync.mjs push .env.local          /runook/billing
 *   node scripts/secrets-sync.mjs pull .env.local          /runook/billing   # disaster recovery
 *
 * Uses the EC2 instance-profile role for auth (no static keys). Never prints
 * secret values.
 */
import { promises as fs } from "node:fs";
import {
  SSMClient,
  PutParameterCommand,
  GetParametersByPathCommand,
} from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const ssm = new SSMClient({ region: REGION });

const KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function parseEnv(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.trimStart().startsWith("#")) continue;
    const m = line.match(KEY_RE);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
}

async function push(envfile, prefix) {
  const pairs = parseEnv(await fs.readFile(envfile, "utf8"));
  let n = 0;
  for (const [key, value] of pairs) {
    // SSM SecureString requires a non-empty value; skip blank/unset vars.
    if (value === "") {
      console.log(`  skipped ${prefix}/${key} (empty)`);
      continue;
    }
    await ssm.send(
      new PutParameterCommand({
        Name: `${prefix}/${key}`,
        Value: value,
        Type: "SecureString",
        Overwrite: true,
      })
    );
    n++;
    console.log(`  stored ${prefix}/${key}`); // name only, never the value
  }
  console.log(`push complete: ${n} parameters -> ${prefix}`);
}

async function pull(envfile, prefix) {
  const params = [];
  let token;
  do {
    const r = await ssm.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: false,
        WithDecryption: true,
        NextToken: token,
      })
    );
    for (const p of r.Parameters ?? []) params.push(p);
    token = r.NextToken;
  } while (token);

  if (params.length === 0) {
    console.error(`no parameters found under ${prefix}; aborting (refusing to write empty file)`);
    process.exit(1);
  }
  const lines = params
    .map((p) => `${p.Name.slice(prefix.length + 1)}=${p.Value}`)
    .sort();
  await fs.writeFile(envfile, lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`pull complete: ${params.length} parameters -> ${envfile}`);
}

const [cmd, envfile, prefix] = process.argv.slice(2);
if (!["push", "pull"].includes(cmd) || !envfile || !prefix) {
  console.error("usage: node scripts/secrets-sync.mjs <push|pull> <envfile> <prefix>");
  process.exit(2);
}
(cmd === "push" ? push : pull)(envfile, prefix).catch((e) => {
  console.error(e.name + ": " + e.message);
  process.exit(1);
});
