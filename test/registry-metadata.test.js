import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [pkg, server] = await Promise.all(
  ["package.json", "server.json"].map(async (path) =>
    JSON.parse(await readFile(new URL(path, root), "utf8")),
  ),
);

test("Registry metadata matches the npm package", () => {
  assert.equal(server.$schema, "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json");
  assert.equal(server.name, "com.haoyoubox/publish");
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.version, pkg.version);
  assert.equal(server.websiteUrl, "https://www.haoyoubox.com/agent");
  assert.equal(server.repository.url, "https://github.com/cheng-big/haoyoubox-agent-skill");
  assert.equal(server.packages.length, 1);
  assert.equal(server.packages[0].identifier, pkg.name);
  assert.equal(server.packages[0].version, pkg.version);
  assert.equal(server.packages[0].transport.type, "stdio");
  assert.equal(server.packages[0].environmentVariables[0].name, "HAOYOUBOX_TOKEN");
  assert.ok(server.description.length <= 100);
});
