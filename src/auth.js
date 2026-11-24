import { savePublishToken } from "./credentials.js";

const ORIGIN = "https://www.haoyoubox.com";

export async function authorizeDevice({
  fetch = globalThis.fetch,
  write = (line) => process.stderr.write(`${line}\n`),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  saveToken = savePublishToken,
  origin = ORIGIN,
} = {}) {
  const started = await postJson(fetch, origin, "/api/agent/device/start", {
    name: "HaoyouBox MCP",
  });
  validateDeviceStart(started);

  write("Authorize HaoyouBox MCP publishing:");
  write(`URL: ${started.verificationUrl}`);
  write(`Code: ${started.userCode}`);
  write("Waiting for approval...");

  const interval = Math.max(1, Number(started.intervalSeconds) || 3) * 1000;
  while (now() < started.expiresAt) {
    const polled = await postJson(fetch, origin, "/api/agent/device/poll", {
      deviceSecret: started.deviceSecret,
    });
    if (polled.state === "approved") {
      const exchanged = await postJson(
        fetch,
        origin,
        "/api/agent/device/exchange",
        { deviceSecret: started.deviceSecret },
      );
      if (!exchanged?.token)
        throw authError("HaoyouBox did not return a publish token.", "agent_exchange_invalid");
      try {
        await saveToken(exchanged.token);
      } catch {
        throw authError("Device approval succeeded, but this computer could not save the publish token. Check your credential storage or use a manual token.", "agent_credentials_save_failed");
      }
      write("HaoyouBox MCP authorization complete. Return to the original task and continue with the same file.");
      return { authorized: true, expires: exchanged.expires };
    }
    if (polled.state === "denied")
      throw authError("Device authorization was declined. Publishing stopped.", "agent_device_denied");
    if (polled.state === "expired")
      throw authError("The HaoyouBox device request expired. Start a new request when you are ready.", "agent_device_expired");
    if (polled.state !== "pending")
      throw authError("The HaoyouBox device request is no longer active.", "agent_device_unavailable");
    await sleep(interval);
  }
  throw authError("The HaoyouBox device request expired.", "agent_device_expired");
}

async function postJson(fetch, origin, path, body) {
  let response;
  try {
    response = await fetch(new URL(path, origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw authError("Could not reach HaoyouBox during device authorization. Check your connection.", "network_unavailable");
  }
  let result = {};
  try {
    result = await response.json();
  } catch {
    // Use a generic error without reflecting response text.
  }
  if (!response.ok)
    throw authError(
      result.error || "HaoyouBox authorization failed.",
      result.code || "agent_authorization_failed",
      response.status,
    );
  return result;
}

function validateDeviceStart(value) {
  if (
    typeof value?.deviceSecret !== "string" ||
    typeof value?.userCode !== "string" ||
    typeof value?.verificationUrl !== "string" ||
    !Number.isFinite(value?.expiresAt)
  )
    throw authError("HaoyouBox returned an invalid device request.", "agent_device_invalid");
}

function authError(message, code, status) {
  return Object.assign(new Error(message), { code, ...(status ? { status } : {}) });
}
