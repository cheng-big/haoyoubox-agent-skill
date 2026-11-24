import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const TOKEN_PATTERN = /^hb_pub_[a-f0-9]{24}_[A-Za-z0-9_-]{43}$/;

export function credentialPath(env = process.env) {
  const configRoot = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configRoot, "haoyoubox-mcp", "credentials.json");
}

export function validatePublishToken(value) {
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value))
    throw Object.assign(new Error("The HaoyouBox publish token is invalid."), {
      code: "agent_token_invalid",
    });
  return value;
}

export async function loadPublishToken({
  env = process.env,
  path = credentialPath(env),
} = {}) {
  if (env.HAOYOUBOX_TOKEN !== undefined)
    return validatePublishToken(env.HAOYOUBOX_TOKEN);
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT")
      throw Object.assign(
        new Error("Authorize HaoyouBox with: npx -y haoyoubox-mcp auth"),
        { code: "auth_required" },
      );
    throw error;
  }
  try {
    return validatePublishToken(JSON.parse(source).token);
  } catch (error) {
    if (error?.code === "agent_token_invalid") throw error;
    throw Object.assign(new Error("The HaoyouBox credential file is invalid."), {
      code: "credential_invalid",
    });
  }
}

export async function savePublishToken(
  value,
  { path = credentialPath(), randomId = randomUUID } = {},
) {
  const token = validatePublishToken(value);
  const directory = dirname(path);
  const temporary = join(directory, `.credentials.${process.pid}.${randomId()}.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  try {
    await writeFile(temporary, `${JSON.stringify({ token })}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(temporary, 0o600).catch(() => {});
    await rename(temporary, path);
    await chmod(path, 0o600).catch(() => {});
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return { saved: true, path };
}
