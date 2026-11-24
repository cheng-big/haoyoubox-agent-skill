import { randomUUID } from "node:crypto";
import { preflightPublish } from "./preflight.js";
import { selectLocale } from "./locale.js";
import { preparePassword } from "./password.js";
import { completeShareUrl } from "./share-url.js";
import { loadPublishToken } from "./credentials.js";
import { HaoyouBoxClient } from "./haoyoubox-client.js";
import { openRecovery } from "./publish-recovery.js";

const RETRYABLE_ERRORS = new Set([
  "network_unavailable",
  "publish_state_unknown",
  "share_incomplete",
  "agent_operation_invalid",
  "rate_limited",
  "upload_path_conflict",
  "upload_closed",
]);

export async function publishFile(
  { path, locale, expiryHours, password, operationKey },
  {
    token,
    fetch,
    idempotencyKey,
    recoveryDirectory,
    sleep,
    cwd,
  } = {},
) {
  const file = await preflightPublish({ path, expiryHours }, { cwd, fetch });
  const selectedLocale = selectLocale({
    explicit: locale,
    path: file.path,
    bytes: file.bytes,
  });
  const publishToken = token || (await loadPublishToken());
  const key = operationKey ?? idempotencyKey ?? randomUUID();
  const recovery = operationKey || !idempotencyKey
    ? await openRecovery({
        key,
        token: publishToken,
        file,
        locale: selectedLocale,
        expiryHours,
        password,
        directory: recoveryDirectory,
      })
    : null;
  const prepared = recovery?.proof ?? await preparePassword(password);
  const client = new HaoyouBoxClient({
    token: publishToken,
    ...(fetch ? { fetch } : {}),
    ...(sleep ? { sleep } : {}),
  });

  try {
    return await publishOperation({ client, key, file, selectedLocale, expiryHours, prepared, recovery });
  } catch (error) {
    if (recovery && (error.status >= 500 || RETRYABLE_ERRORS.has(error.code)))
      error.operationKey = key;
    throw error;
  }
}

async function publishOperation({ client, key, file, selectedLocale, expiryHours, prepared, recovery }) {
  const reserved = await client.reserve(file, key);
  const { versionId, operationId, state = "uploading", supportsShareReplay } = reserved ?? {};
  if (
    typeof versionId !== "string" ||
    !/^[a-f0-9]{24}$/.test(versionId) ||
    typeof operationId !== "string" ||
    !/^[a-f0-9]{24}$/.test(operationId)
  )
    throw Object.assign(new Error("HaoyouBox returned an invalid upload operation."), {
      code: "agent_operation_invalid",
    });

  if (!["uploading", "draft", "published", "completed"].includes(state))
    throw Object.assign(new Error("Check this operation in the HaoyouBox workspace."), { code: "publish_state_unknown" });
  if (state === "uploading") {
    await client.putOriginal(versionId, operationId, file, key);
    if (file.kind === "markdown")
      await client.putRenderedMarkdown(versionId, operationId, selectedLocale, key);
    else
      await client.putRenderedHtml(versionId, operationId, file, key);
    await client.complete(versionId, operationId, file.path, key);
  }
  if (state === "uploading" || state === "draft")
    await client.publish(versionId, operationId, key);
  const canReplay = supportsShareReplay === true;
  const mayRecover = state !== "completed" || (canReplay && recovery);
  if (!mayRecover || (recovery && !(await recovery.maySendShare(canReplay))))
    throw Object.assign(new Error("Check the existing share in the HaoyouBox workspace."), { code: "share_recovery_unavailable" });
  const result = await client.share(
    versionId,
    operationId,
    {
      mode: "password",
      locale: selectedLocale,
      ...(expiryHours === undefined ? {} : { hours: expiryHours }),
      passwordSalt: prepared.salt,
      passwordIterations: prepared.iterations,
      passwordVerifier: prepared.verifier,
    },
    key,
    { retryNetwork: canReplay },
  );
  if (!result?.share?.url || !Number.isFinite(result?.share?.expires))
    throw Object.assign(new Error("HaoyouBox did not return a completed share."), {
      code: "share_incomplete",
    });

  return {
    shareUrl: completeShareUrl(result.share.url, prepared.password),
    password: prepared.password,
    expiresAt: result.share.expires,
    versionId,
  };
}
