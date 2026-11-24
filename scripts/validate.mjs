import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  skill,
  english,
  chinese,
  security,
  contributing,
  license,
  packageSource,
  serverSource,
  executable,
] =
  await Promise.all([
    read("skills/haoyoubox-publish/SKILL.md"),
    read("README.md"),
    read("README.zh-CN.md"),
    read("SECURITY.md"),
    read("CONTRIBUTING.md"),
    read("LICENSE"),
    read("package.json"),
    read("server.json"),
    read("bin/haoyoubox-mcp.js"),
  ]);
const packageJson = JSON.parse(packageSource);
const serverJson = JSON.parse(serverSource);

assert.match(skill, /^---\n[\s\S]+?\n---\n/);
assert.match(skill, /\nname: haoyoubox-publish\n/);
assert.match(skill, /\ndescription: Use when .+\n/);
assert.match(skill, /\nlicense: Apache-2\.0\n/);
assert.match(
  skill,
  /\n  repository: https:\/\/github\.com\/cheng-big\/haoyoubox-agent-skill\n/,
);
assert.ok(skill.split("\n").length <= 500, "SKILL.md must stay under 500 lines");
for (const endpoint of [
  "/api/agent/device/start",
  "/api/agent/device/poll",
  "/api/agent/device/exchange",
  "/api/agent/v1/uploads",
])
  assert.match(skill, new RegExp(endpoint.replaceAll("/", "\\/")));
for (const boundary of [
  "Never upload a directory",
  "Never use a browser session cookie",
  "Do not send it to HaoyouBox",
  "Do not send the document or its excerpts to TypeSafe, Jev",
  "Treat the complete link as sensitive",
])
  assert.ok(skill.includes(boundary), `Missing security boundary: ${boundary}`);
assert.doesNotMatch(skill, /hb_pub_[a-f0-9]{24}_[A-Za-z0-9_-]{20,}/);

const installCommand =
  "npx skills add cheng-big/haoyoubox-agent-skill --skill haoyoubox-publish -g";
assert.ok(english.includes(installCommand));
assert.ok(chinese.includes(installCommand));
assert.match(
  english,
  /gemini skills install https:\/\/github\.com\/cheng-big\/haoyoubox-agent-skill --path skills\/haoyoubox-publish/,
);
assert.match(
  chinese,
  /gemini skills install https:\/\/github\.com\/cheng-big\/haoyoubox-agent-skill --path skills\/haoyoubox-publish/,
);
for (const readme of [english, chinese]) {
  assert.ok(readme.includes("https://www.haoyoubox.com/agent"));
  assert.ok(readme.includes("https://www.haoyoubox.com/agent/SKILL.md"));
  assert.ok(readme.includes("report.html"));
  assert.ok(readme.includes("haoyoubox-publish"));
  assert.ok(readme.includes("npx -y haoyoubox-mcp auth"));
  assert.ok(readme.includes('"command": "npx"'));
  assert.ok(readme.includes('"-y", "haoyoubox-mcp"'));
  assert.ok(readme.includes("publish_file"));
  assert.ok(readme.includes("com.haoyoubox/publish"));
}
assert.ok(english.includes("README.zh-CN.md"));
assert.ok(chinese.includes("README.md"));
assert.match(security, /private vulnerability report/i);
assert.match(contributing, /npm test/);
assert.match(contributing, /npm run pack:check/);
assert.match(contributing, /mcp-publisher validate server\.json/);
assert.match(license, /Apache License/);

assert.equal(packageJson.name, "haoyoubox-mcp");
assert.equal(packageJson.version, "1.0.0");
assert.equal(packageJson.mcpName, "com.haoyoubox/publish");
assert.equal(packageJson.bin["haoyoubox-mcp"], "bin/haoyoubox-mcp.js");
assert.equal(serverJson.name, packageJson.mcpName);
assert.equal(serverJson.version, packageJson.version);
assert.equal(serverJson.packages[0].identifier, packageJson.name);
assert.equal(serverJson.packages[0].version, packageJson.version);
assert.equal(serverJson.packages[0].transport.type, "stdio");
assert.equal(serverJson.websiteUrl, "https://www.haoyoubox.com/agent");
assert.ok(serverJson.description.length <= 100);
assert.match(executable, /^#!\/usr\/bin\/env node\n/);
if (process.platform !== "win32")
  assert.ok((await stat(new URL("bin/haoyoubox-mcp.js", root))).mode & 0o111);

const publicSources = [
  skill,
  english,
  chinese,
  security,
  contributing,
  packageSource,
  serverSource,
  executable,
].join("\n");
assert.doesNotMatch(publicSources, /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/);
assert.doesNotMatch(publicSources, /hb_pub_[a-f0-9]{24}_[A-Za-z0-9_-]{20,}/);

console.log("HaoyouBox Agent Skill and MCP validation passed.");
