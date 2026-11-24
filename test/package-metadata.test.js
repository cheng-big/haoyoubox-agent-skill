import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

test("npm package exposes the HaoyouBox MCP executable", () => {
  assert.equal(pkg.name, "haoyoubox-mcp");
  assert.equal(pkg.version, "1.0.0");
  assert.equal(pkg.private, false);
  assert.equal(pkg.mcpName, "com.haoyoubox/publish");
  assert.equal(pkg.bin["haoyoubox-mcp"], "bin/haoyoubox-mcp.js");
  assert.equal(pkg.homepage, "https://www.haoyoubox.com/agent");
  assert.equal(
    pkg.repository.url,
    "git+https://github.com/cheng-big/haoyoubox-agent-skill.git",
  );
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.dependencies["@modelcontextprotocol/server"], "2.3.1");
  assert.equal(pkg.dependencies.zod, "4.6.7");
});
