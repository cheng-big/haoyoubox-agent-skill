import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPublishFile } from "../src/file-input.js";
import { selectLocale } from "../src/locale.js";
import { preparePassword } from "../src/password.js";
import { completeShareUrl } from "../src/share-url.js";

const temp = await mkdtemp(join(tmpdir(), "haoyoubox-mcp-local-"));
after(() => rm(temp, { recursive: true, force: true }));

test("reads one regular supported file without exposing its directory", async () => {
  const path = join(temp, "报告.html");
  await writeFile(path, "<!doctype html><h1>你好</h1>");
  const file = await readPublishFile(path);
  assert.deepEqual(Object.keys(file), [
    "absolutePath",
    "path",
    "name",
    "kind",
    "type",
    "bytes",
    "size",
    "sha256",
  ]);
  assert.equal(file.path, "报告.html");
  assert.equal(file.kind, "html");
  assert.equal(file.type, "text/html; charset=utf-8");
  assert.match(file.sha256, /^[A-Za-z0-9_-]{43}$/);
});

test("rejects directories, symlinks, hidden files, empty files and unsupported files", async () => {
  const directory = join(temp, "folder");
  await mkdir(directory);
  const target = join(temp, "target.md");
  await writeFile(target, "# Target");
  const link = join(temp, "link.md");
  await symlink(target, link);
  const cases = [
    [directory, "file_not_regular"],
    [link, "file_symlink"],
    [join(temp, ".env"), "file_hidden"],
    [join(temp, "empty.md"), "file_empty"],
    [join(temp, "image.png"), "file_type_unsupported"],
  ];
  await writeFile(cases[2][0], "SECRET=value");
  await writeFile(cases[3][0], "");
  await writeFile(cases[4][0], "png");
  for (const [path, code] of cases)
    await assert.rejects(readPublishFile(path), { code });
});

test("selects locale from explicit input and visible prose only", () => {
  assert.equal(
    selectLocale({
      explicit: "zh",
      path: "report.md",
      bytes: Buffer.from("English text"),
    }),
    "zh",
  );
  assert.equal(
    selectLocale({
      path: "report.html",
      bytes: Buffer.from(
        "<script>English English English</script><style>.English{}</style><h1>你好世界</h1>",
      ),
    }),
    "zh",
  );
  assert.equal(
    selectLocale({
      path: "report.md",
      bytes: Buffer.from("```js\nconst 中文 = true\n```\nA readable English report"),
    }),
    "en",
  );
  assert.throws(
    () => selectLocale({ explicit: "fr", path: "a.md", bytes: Buffer.from("x") }),
    { code: "locale_invalid" },
  );
});

test("generates and derives passwords locally", async () => {
  const generated = await preparePassword(undefined, {
    randomIntFn: () => 0,
    randomBytesFn: () => Buffer.alloc(16, 7),
  });
  assert.equal(generated.password, "AAAAAA");
  assert.equal(generated.iterations, 600000);
  assert.match(generated.salt, /^[A-Za-z0-9_-]{22}$/);
  assert.match(generated.verifier, /^[A-Za-z0-9_-]{43}$/);

  const supplied = await preparePassword("密码 with spaces", {
    randomBytesFn: () => Buffer.alloc(16, 9),
  });
  assert.equal(supplied.password, "密码 with spaces");
  assert.notEqual(supplied.verifier, generated.verifier);
  await assert.rejects(preparePassword("short"), { code: "password_invalid" });
});

test("adds the password to a validated share fragment", () => {
  const id = "a".repeat(24);
  assert.equal(
    completeShareUrl(
      `https://www.haoyoubox.com/s/${id}?lang=zh#s=secret`,
      "p a&中",
    ),
    `https://www.haoyoubox.com/s/${id}?lang=zh#s=secret&p=p+a%26%E4%B8%AD`,
  );
  assert.throws(
    () => completeShareUrl(`https://example.com/s/${id}#s=secret`, "ABC234"),
    { code: "share_url_invalid" },
  );
});
