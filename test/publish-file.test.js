import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HaoyouBoxClient } from "../src/haoyoubox-client.js";
import { publishFile } from "../src/publish-file.js";

const temp = await mkdtemp(join(tmpdir(), "haoyoubox-mcp-publish-"));
after(() => rm(temp, { recursive: true, force: true }));
const token = `hb_pub_${"a".repeat(24)}_${"C".repeat(43)}`;
const operationId = "b".repeat(24);
const versionId = "c".repeat(24);
const shareId = "d".repeat(24);

test("publishes HTML through the staged API with one credential and idempotency key", async () => {
  const path = join(temp, "page.html");
  await writeFile(path, "<!doctype html><h1>English report</h1>");
  const requests = [];
  const fetch = stagedFetch(requests);
  const result = await publishFile(
    { path, locale: "en", expiryHours: 24, password: "ABC234" },
    { token, fetch, idempotencyKey: "stable-key" },
  );

  assert.deepEqual(
    requests.map((item) => [item.method, item.path]),
    [
      ["GET", "/api/config"],
      ["POST", "/api/agent/v1/uploads"],
      ["PUT", `/api/agent/v1/uploads/${versionId}/file`],
      ["PUT", `/api/agent/v1/uploads/${versionId}/rendered`],
      ["POST", `/api/agent/v1/uploads/${versionId}/complete`],
      ["POST", `/api/agent/v1/uploads/${versionId}/publish`],
      ["POST", `/api/agent/v1/uploads/${versionId}/share`],
    ],
  );
  assert.equal(requests[0].headers.has("Authorization"), false);
  for (const request of requests.slice(1)) {
    assert.equal(request.headers.get("Authorization"), `Bearer ${token}`);
    assert.equal(request.headers.get("Idempotency-Key"), "stable-key");
    assert.equal(request.headers.has("Cookie"), false);
  }
  const share = requests.at(-1).json;
  assert.equal(share.mode, "password");
  assert.equal(share.locale, "en");
  assert.equal(share.hours, 24);
  assert.equal("password" in share, false);
  assert.match(share.passwordSalt, /^[A-Za-z0-9_-]{22}$/);
  assert.match(share.passwordVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(share.passwordIterations, 600000);
  assert.deepEqual(result, {
    shareUrl: `https://www.haoyoubox.com/s/${shareId}?lang=en#s=secret&p=ABC234`,
    password: "ABC234",
    expiresAt: 1_800_000_000_000,
    versionId,
  });
});

test("asks the server to render Markdown with the locally selected locale", async () => {
  const path = join(temp, "notes.md");
  await writeFile(path, "# 中文说明\n\n这是可读内容。");
  const requests = [];
  await publishFile(
    { path, password: "DEF567" },
    { token, fetch: stagedFetch(requests), idempotencyKey: "markdown-key" },
  );
  const rendered = requests.find(
    (item) => item.path.endsWith("/rendered"),
  );
  assert.equal(rendered.headers.get("Content-Type"), "application/json");
  assert.deepEqual(rendered.json, { locale: "zh" });
  assert.equal(requests.at(-1).json.locale, "zh");
});

test("maps safe API errors and retries one rate limit", async () => {
  const sleeps = [];
  let calls = 0;
  const client = new HaoyouBoxClient({
    token,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    fetch: async () => {
      calls += 1;
      if (calls === 1)
        return jsonResponse(
          { error: "Slow down.", code: "rate_limited" },
          429,
          { "Retry-After": "0" },
        );
      return jsonResponse({ operationId, versionId }, 201);
    },
  });
  assert.deepEqual(
    await client.reserve(
      { path: "a.md", name: "a.md", size: 1, sha256: "x".repeat(43) },
      "retry-key",
    ),
    { operationId, versionId },
  );
  assert.deepEqual(sleeps, [0]);
  assert.equal(calls, 2);

  const denied = new HaoyouBoxClient({
    token,
    fetch: async () =>
      jsonResponse({ error: "Token revoked.", code: "agent_token_revoked" }, 403),
  });
  await assert.rejects(
    denied.reserve(
      { path: "a.md", name: "a.md", size: 1, sha256: "x".repeat(43) },
      "denied-key",
    ),
    { status: 403, code: "agent_token_revoked" },
  );
});

test("queries operation state after repeated ambiguous network failures", async () => {
  let calls = 0;
  const client = new HaoyouBoxClient({
    token,
    fetch: async (url) => {
      calls += 1;
      if (new URL(url).pathname.includes("/operations/"))
        return jsonResponse({ operation: { state: "published" } });
      throw new Error("socket closed");
    },
  });
  await assert.rejects(
    client.publish(versionId, operationId, "network-key"),
    (error) =>
      error.code === "publish_state_unknown" &&
      error.message.includes("published") &&
      !error.message.includes(token),
  );
  assert.equal(calls, 3);
});

function stagedFetch(requests) {
  return async (url, init) => {
    const parsed = new URL(url);
    const headers = new Headers(init.headers);
    let json;
    if (headers.get("Content-Type") === "application/json")
      json = JSON.parse(init.body);
    requests.push({
      method: init.method,
      path: parsed.pathname,
      headers,
      json,
      body: init.body,
    });
    if (parsed.pathname === "/api/config") return jsonResponse(limits);
    if (parsed.pathname === "/api/agent/v1/uploads")
      return jsonResponse({ operationId, versionId }, 201);
    if (parsed.pathname.endsWith("/share"))
      return jsonResponse({
        operationId,
        versionId,
        share: {
          id: shareId,
          url: `https://www.haoyoubox.com/s/${shareId}?lang=${json.locale}#s=secret`,
          expires: 1_800_000_000_000,
        },
      }, 201);
    return jsonResponse({ operationId, versionId }, 200);
  };
}

const limits = { maxUpload: 10 * 1024 ** 2, maxMarkdown: 2 * 1024 ** 2, maxShareHours: 168, uploadProtocol: "staged" };

for (const [stage, firstRequest] of [
  ["uploads", "file"],
  ["file", "file"],
  ["rendered", "file"],
  ["complete", "publish"],
  ["publish", "share"],
]) {
  test(`continues the same operation after losing the ${stage} response`, async () => {
    const path = join(temp, `${stage}-lost.md`);
    const { randomUUID } = await import("node:crypto");
    const operationKey = randomUUID();
    await writeFile(path, "# Interrupted publish fixture");
    let state = "uploading";
    let offline = true;
    const requests = [];
    const fetch = async (url, init) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/config") return jsonResponse(limits);
      const endpoint = pathname.split("/").at(-1);
      requests.push(endpoint);
      assert.equal(init.headers.get("Idempotency-Key"), operationKey);
      if (pathname.includes("/operations/")) return jsonResponse({ operation: { state } });
      if (endpoint === "complete") state = "draft";
      if (endpoint === "publish") state = "published";
      if (endpoint === stage && offline) throw new Error("response lost");
      if (endpoint === "uploads")
        return jsonResponse({ operationId, versionId, state, supportsShareReplay: true });
      if (endpoint === "share")
        return jsonResponse({ share: { url: `https://www.haoyoubox.com/s/${shareId}?lang=en#s=secret`, expires: 1_800_000_000_000 } });
      return jsonResponse({});
    };
    const input = { path, operationKey };
    const options = { token, fetch, recoveryDirectory: join(temp, "operations") };
    await assert.rejects(publishFile(input, options), { operationKey });
    offline = false;
    requests.length = 0;
    const result = await publishFile(input, options);
    assert.equal(result.versionId, versionId);
    assert.deepEqual(requests.slice(0, 2), ["uploads", firstRequest]);
  });
}

test("recovers the same completed share after a lost response across publish calls", async () => {
  const path = join(temp, "recover.md");
  const operationKey = "a9cd1221-9537-4cbe-a8c8-9d17a23741e2";
  const recoveryDirectory = join(temp, "operations");
  await writeFile(path, "# Recovery fixture");
  let state = "uploading";
  let requestShare;
  let offline = true;
  let creations = 0;
  const fetch = async (url, init) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/config") return jsonResponse(limits);
    assert.equal(init.headers.get("Idempotency-Key"), operationKey);
    if (pathname.endsWith("/uploads"))
      return jsonResponse({ operationId, versionId, state, supportsShareReplay: true });
    if (pathname.includes("/operations/")) return jsonResponse({ operation: { state } });
    if (state === "completed") assert.ok(pathname.endsWith("/share"));
    if (pathname.endsWith("/complete")) state = "draft";
    if (pathname.endsWith("/publish")) state = "published";
    if (pathname.endsWith("/share")) {
      if (!requestShare) {
        requestShare = init.body;
        state = "completed";
        creations++;
      }
      assert.equal(init.body, requestShare);
      if (offline) throw new Error("response lost");
      return jsonResponse({ share: { url: `https://www.haoyoubox.com/s/${shareId}?lang=en#s=secret`, expires: 1_800_000_000_000 } });
    }
    return jsonResponse({});
  };
  const input = { path, operationKey };
  const options = { token, fetch, recoveryDirectory };
  await assert.rejects(publishFile(input, options), { code: "publish_state_unknown", operationKey });
  offline = false;
  const result = await publishFile(input, options);
  assert.equal(creations, 1);
  assert.match(result.shareUrl, new RegExp(`#s=secret&p=${result.password}$`));
  const recordPath = join(recoveryDirectory, `${operationKey}.json`);
  const record = await readFile(recordPath, "utf8");
  assert.equal((await stat(recordPath)).mode & 0o777, 0o600);
  for (const confidential of [token, result.password, result.shareUrl, path])
    assert.ok(!record.includes(confidential));

  await writeFile(path, "# Changed fixture");
  await assert.rejects(publishFile(input, options), { code: "publish_inputs_changed" });
});

test("stops after an uncertain share on a server without replay support", async () => {
  const path = join(temp, "legacy.md");
  const operationKey = "d752ab17-90ce-49bd-8711-1d2026ae0eb1";
  await writeFile(path, "# Legacy server fixture");
  let shares = 0;
  const fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/config") return jsonResponse(limits);
    if (pathname.endsWith("/uploads")) return jsonResponse({ operationId, versionId, state: "published" });
    if (pathname.endsWith("/share")) {
      shares++;
      throw new Error("response lost");
    }
    return jsonResponse({ operation: { state: "published" } });
  };
  const input = { path, operationKey };
  const options = { token, fetch, recoveryDirectory: join(temp, "operations") };
  await assert.rejects(publishFile(input, options), { code: "publish_state_unknown", operationKey });
  await assert.rejects(publishFile(input, options), { code: "share_recovery_unavailable" });
  assert.equal(shares, 1);
});

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
