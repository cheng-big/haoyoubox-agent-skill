import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preflightPublish } from "../src/preflight.js";

const directory = await mkdtemp(join(tmpdir(), "haoyoubox-preflight-"));
after(() => rm(directory, { recursive: true, force: true }));

const limits = {
  uploadProtocol: "staged",
  maxUpload: 10 * 1024 ** 2,
  maxMarkdown: 2 * 1024 ** 2,
  maxShareHours: 72,
};

async function fixture(name, content) {
  const path = join(directory, name);
  await writeFile(path, content);
  return path;
}

async function publicConfig(url, options) {
  assert.equal(String(url), "https://www.haoyoubox.com/api/config");
  assert.equal(options.method, "GET");
  assert.equal(options.redirect, "error");
  assert.equal(options.credentials, "omit");
  assert.equal(options.headers, undefined);
  assert.equal(options.body, undefined);
  return Response.json(limits);
}

test("accepts embedded assets and ordinary links without contacting referenced hosts", async () => {
  const path = await fixture("preview.html", [
    '<!-- <img src="private.png"> -->',
    '<style>/* url(comment.png) */ .icon { background: url(#local-icon) }</style>',
    '<img src="data:image/svg+xml;base64,PHN2Zy8+">',
    '<img src="https://example.test/cover.png">',
    '<a href="https://example.test">Reference</a>',
    '<a href="#heading">Jump to heading</a>',
    '<script>const examples = "fetch(\\"/api/example\\")";</script>',
    '<h1 id="heading">Cover</h1>',
  ].join("\n"));
  const file = await preflightPublish({ path, expiryHours: 72 }, { fetch: publicConfig });
  assert.equal(file.name, "preview.html");
  assert.equal(file.kind, "html");
});

test("uses the live byte and expiry limits before reading the selected file", async () => {
  const config = async () => Response.json({
    ...limits,
    maxUpload: 12,
    maxMarkdown: 4,
  });
  const html = await fixture("large.html", "<h1>Good</h1>");
  const markdown = await fixture("large.md", "# 汉字");
  for (const path of [html, markdown]) {
    await assert.rejects(preflightPublish({ path }, { fetch: config }), error => {
      assert.equal(error.code, "file_too_large");
      assert.match(error.message, /bytes/);
      assert.match(error.message, /Reduce the file size/);
      return true;
    });
  }
  const exact = await fixture("small.md", "1234");
  assert.equal((await preflightPublish({ path: exact }, { fetch: config })).size, 4);
  await assert.rejects(preflightPublish({ path: exact, expiryHours: 73 }, { fetch: config }), {
    code: "expiry_invalid",
    message: "Choose an expiry of up to 72 hours.",
  });
});

test("stops before reading an invalid input or signing in when limits are unavailable", async () => {
  let called = false;
  await assert.rejects(preflightPublish({ path: join(directory, "missing.html") }, {
    fetch: async () => {
      called = true;
      return Response.json(limits);
    },
  }), { code: "file_not_found" });
  assert.equal(called, false);
  const path = await fixture("available.html", "<h1>Hi</h1>");
  for (const fetch of [
    async () => { throw new Error("offline"); },
    async () => Response.json({ ...limits, uploadProtocol: "unknown" }),
    async () => Response.json({ ...limits, maxMarkdown: "2097152" }),
    async () => new Response("503", { status: 503 }),
  ]) {
    await assert.rejects(preflightPublish({ path }, { fetch }), { code: "limits_unavailable" });
  }
});

test("rejects a selected file that was replaced while reading limits", async () => {
  const path = await fixture("replaced.md", "Hello");
  await assert.rejects(preflightPublish({ path }, {
    fetch: async () => {
      await rename(path, path + ".original");
      await writeFile(path, "Other");
      return Response.json(limits);
    },
  }), { code: "file_changed" });
});

test("routes common local HTML and Markdown assets to single-file repair or browser ZIP", async () => {
  const cases = [
    ["styles.html", '<link rel="stylesheet" href="./assets/demo.css">'],
    ["scripts.html", '<script src="bundles/demo.js"></script>'],
    ["file.html", '<img src="file:///docs/cover.png">'],
    ["responsive.html", '<img srcset="data:image/png;base64,AAAA 1x, ./private.png 2x">'],
    ["css.html", "<style>.cover{background: url('private.png')}</style>"],
    ["module.html", '<script type="module">import "./private.js";</script>'],
    ["asset.md", "![Cover][cover]\n\n[cover]: ./private.png"],
  ];
  for (const [name, content] of cases) {
    const path = await fixture(name, content);
    await assert.rejects(preflightPublish({ path }, { fetch: publicConfig }), error => {
      assert.equal(error.code, "file_local_dependency", name);
      assert.match(error.message, /https:\/\/www\.haoyoubox\.com\/upload/);
      assert.doesNotMatch(error.message, /private\.|assets\/|bundles\/|docs\//);
      return true;
    });
  }
});

test("does not mistake Markdown code examples for rendered images", async () => {
  const path = await fixture("notes.md", [
    "# Hello",
    "Write \x60![example](example.png)\x60 to include an image.",
    "",
    "\x60\x60\x60md",
    "![another example](missing.png)",
    "\x60\x60\x60",
    "",
    "![An external image](https://example.test/image.png)",
  ].join("\n"));
  assert.equal((await preflightPublish({ path }, { fetch: publicConfig })).kind, "markdown");
});

test("flags obvious local-only backend dependencies", async () => {
  const cases = [
    ["loopback.html", '<script>window.fetch("http://127.0.0.1:5000/private");</script>'],
    ["socket.html", '<script>new WebSocket("ws://localhost:5000/private");</script>'],
    ["form.html", '<form action="/api/private"></form>'],
    ["post.html", '<form method="POST"></form>'],
    ["relative.html", '<script>fetch("./api/private");</script>'],
    ["api.md", "[Local API](http://localhost:4000/private)"],
  ];
  for (const [name, content] of cases) {
    const path = await fixture(name, content);
    await assert.rejects(preflightPublish({ path }, { fetch: publicConfig }), error => {
      assert.equal(error.code, "file_backend_dependency", name);
      assert.doesNotMatch(error.message, /private|localhost|127\.0\.0\.1/);
      return true;
    });
  }
});
