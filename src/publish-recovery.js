import { createHmac, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { credentialPath } from "./credentials.js";
import { preparePassword } from "./password.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const OPERATION_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function recoveryError(code, message) {
  return Object.assign(new Error(message), { code });
}

async function createRecord(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    await link(temporary, path);
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function openRecovery({ key, token, file, locale, expiryHours, password, directory }) {
  if (!OPERATION_KEY.test(key))
    throw recoveryError("operation_key_invalid", "Use a lowercase random UUID v4 for operationKey.");
  const folder = directory ?? join(dirname(credentialPath()), "publish-operations");
  const path = join(folder, `${key}.json`);
  const hmac = (label, fields = []) => createHmac("sha256", token)
    .update(JSON.stringify([label, key, ...fields])).digest();
  const fingerprint = hmac("publish-input-v1", [
    file.absolutePath, file.sha256, locale, expiryHours, password,
  ]).toString("base64url");

  await mkdir(folder, { recursive: true, mode: 0o700 });
  await createRecord(path, { fingerprint, openedAt: Date.now() });
  const record = JSON.parse(await readFile(path, "utf8"));
  if (record.fingerprint !== fingerprint)
    throw recoveryError("publish_inputs_changed", "This operation belongs to different input or authorization. Use the original file and settings to recover it.");
  if (!Number.isFinite(record.openedAt) || Date.now() - record.openedAt > RETRY_WINDOW_MS)
    throw recoveryError("publish_recovery_expired", "The 24-hour recovery window ended. Check upload history for this operation.");

  const salt = hmac("publish-salt-v1").subarray(0, 16);
  const generatedPassword = Array.from(hmac("publish-password-v1").subarray(0, 6),
    (value) => ALPHABET[value % ALPHABET.length]).join("");
  const proof = await preparePassword(password ?? generatedPassword, { randomBytesFn: () => salt });

  return {
    proof,
    async maySendShare(canReplay) {
      const marker = `${path}.sharing`;
      if (await createRecord(marker, { canReplay })) return true;
      const previousAttempt = JSON.parse(await readFile(marker, "utf8"));
      return canReplay && previousAttempt.canReplay === true;
    },
  };
}
