import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadPublishToken,
  savePublishToken,
} from "../src/credentials.js";
import { authorizeDevice } from "../src/auth.js";

const temp = await mkdtemp(join(tmpdir(), "haoyoubox-mcp-auth-"));
after(() => rm(temp, { recursive: true, force: true }));
const token = `hb_pub_${"a".repeat(24)}_${"B".repeat(43)}`;

test("stores a valid publish token atomically with private permissions", async () => {
  const path = join(temp, "credentials", "credentials.json");
  await savePublishToken(token, { path, randomId: () => "fixed" });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { token });
  if (process.platform !== "win32") {
    assert.equal((await stat(join(temp, "credentials"))).mode & 0o777, 0o700);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  }
  assert.equal(await loadPublishToken({ env: {}, path }), token);
});

test("uses the environment token before a credential file", async () => {
  assert.equal(
    await loadPublishToken({
      env: { HAOYOUBOX_TOKEN: token },
      path: join(temp, "missing.json"),
    }),
    token,
  );
  await assert.rejects(
    loadPublishToken({ env: {}, path: join(temp, "missing.json") }),
    { code: "auth_required" },
  );
  await assert.rejects(
    loadPublishToken({ env: { HAOYOUBOX_TOKEN: "bad" } }),
    { code: "agent_token_invalid" },
  );
});

test("completes device approval without printing secrets", async () => {
  const deviceSecret = "device-secret-never-print";
  const requests = [];
  const responses = [
    response({
      deviceSecret,
      userCode: "ABCD2345",
      verificationUrl: "https://www.haoyoubox.com/agent/authorize?code=ABCD2345",
      expiresAt: 10_000,
      intervalSeconds: 1,
    }),
    response({ state: "pending", expiresAt: 10_000 }),
    response({ state: "approved", expiresAt: 10_000 }),
    response({ token, expires: 99_999 }),
  ];
  const output = [];
  let saved;
  const result = await authorizeDevice({
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });
      return responses.shift();
    },
    write: (line) => output.push(line),
    sleep: async () => {},
    now: () => 1,
    saveToken: async (value) => {
      saved = value;
    },
  });
  assert.deepEqual(result, { authorized: true, expires: 99_999 });
  assert.equal(saved, token);
  assert.equal(requests.length, 4);
  assert.match(output.join("\n"), /ABCD2345/);
  assert.match(output.join("\n"), /verification|authorize|URL/i);
  assert.ok(!output.join("\n").includes(deviceSecret));
  assert.ok(!output.join("\n").includes(token));
});

test("stops when the device request is no longer active", async () => {
  const responses = [
    response({
      deviceSecret: "secret",
      userCode: "ABCD2345",
      verificationUrl: "https://www.haoyoubox.com/agent/authorize?code=ABCD2345",
      expiresAt: 10_000,
      intervalSeconds: 1,
    }),
    response({ state: "expired", expiresAt: 10_000 }),
  ];
  await assert.rejects(
    authorizeDevice({
      fetch: async () => responses.shift(),
      write: () => {},
      now: () => 1,
    }),
    { code: "agent_device_expired" },
  );
});

test("declined authorization stops before exchange", async () => {
  const responses = [
    response({
      deviceSecret: "secret",
      userCode: "ABCD2345",
      verificationUrl: "https://www.haoyoubox.com/agent/authorize?code=ABCD2345",
      expiresAt: 10_000,
    }),
    response({ state: "denied", expiresAt: 10_000 }),
  ];
  await assert.rejects(authorizeDevice({
    fetch: async () => responses.shift(),
    write: () => {},
    now: () => 1,
  }), { code: "agent_device_denied" });
  assert.equal(responses.length, 0);
});

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
