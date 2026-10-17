import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [skill, english, chinese, security, contributing, license] =
  await Promise.all([
    read("skills/haoyoubox-publish/SKILL.md"),
    read("README.md"),
    read("README.zh-CN.md"),
    read("SECURITY.md"),
    read("CONTRIBUTING.md"),
    read("LICENSE"),
  ]);

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
}
assert.ok(english.includes("README.zh-CN.md"));
assert.ok(chinese.includes("README.md"));
assert.match(security, /private vulnerability report/i);
assert.match(contributing, /npm test/);
assert.match(license, /Apache License/);

console.log("HaoyouBox Agent Skill validation passed.");
