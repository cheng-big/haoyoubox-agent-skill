import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  Client,
  InMemoryTransport,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createServer } from "../src/server.js";

const published = {
  shareUrl:
    `https://www.haoyoubox.com/s/${"a".repeat(24)}?lang=zh#s=secret&p=ABC234`,
  password: "ABC234",
  expiresAt: 1_800_000_000_000,
  versionId: "b".repeat(24),
};

test("lists and calls the publish_file tool over MCP", async () => {
  const calls = [];
  const server = createServer({
    publish: async (input) => {
      calls.push(input);
      return published;
    },
  });
  const client = new Client({ name: "haoyoubox-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ["publish_file"]);
    const tool = listed.tools[0];
    assert.ok(tool.inputSchema.required.includes("path"));
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.destructiveHint, true);
    assert.ok(tool.outputSchema);

    const result = await client.callTool({
      name: "publish_file",
      arguments: { path: "report.html", locale: "zh", expiryHours: 24 },
    });
    assert.deepEqual(calls, [
      { path: "report.html", locale: "zh", expiryHours: 24 },
    ]);
    assert.deepEqual(result.structuredContent, { ...published, publishStatus: "shared", verification: { status: "not_run" } });
    assert.match(result.content[0].text, /^https:\/\/www\.haoyoubox\.com/);
    assert.match(result.content[0].text, /Access password: ABC234/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("returns safe actionable tool errors", async () => {
  const server = createServer({
    publish: async () => {
      throw Object.assign(
        new Error("Authorize HaoyouBox with: npx -y haoyoubox-mcp auth"),
        { code: "auth_required" },
      );
    },
  });
  const client = new Client({ name: "haoyoubox-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const result = await client.callTool({
      name: "publish_file",
      arguments: { path: "report.md" },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /haoyoubox-mcp auth/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("initializes the real stdio executable without corrupting stdout", async () => {
  const executable = fileURLToPath(
    new URL("../bin/haoyoubox-mcp.js", import.meta.url),
  );
  const client = new Client({ name: "haoyoubox-stdio-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [executable],
      stderr: "pipe",
    }),
  );
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ["publish_file"]);
  } finally {
    await client.close();
  }
});
