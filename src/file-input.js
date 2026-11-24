import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const FORMATS = new Map([
  [".html", { kind: "html", type: "text/html; charset=utf-8" }],
  [".htm", { kind: "html", type: "text/html; charset=utf-8" }],
  [".md", { kind: "markdown", type: "text/markdown; charset=utf-8" }],
  [".markdown", { kind: "markdown", type: "text/markdown; charset=utf-8" }],
]);

export class PublishInputError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PublishInputError";
    this.code = code;
  }
}

export async function readPublishFile(
  inputPath,
  { cwd = process.cwd(), checkSize } = {},
) {
  if (
    typeof inputPath !== "string" ||
    !inputPath.trim() ||
    inputPath.includes("\0")
  )
    throw new PublishInputError("Choose one HTML or Markdown file.", "file_required");

  const absolutePath = resolve(cwd, inputPath);
  let stat;
  try {
    stat = await lstat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new PublishInputError("The selected file does not exist.", "file_not_found");
    throw error;
  }

  if (stat.isSymbolicLink())
    throw new PublishInputError("Symbolic links cannot be published.", "file_symlink");
  if (!stat.isFile())
    throw new PublishInputError("Choose a regular file, not a directory.", "file_not_regular");

  const name = basename(absolutePath);
  if (name.startsWith("."))
    throw new PublishInputError("Hidden files cannot be published.", "file_hidden");

  const format = FORMATS.get(extname(name).toLowerCase());
  if (!format)
    throw new PublishInputError(
      "HaoyouBox MCP accepts HTML or Markdown files only.",
      "file_type_unsupported",
    );

  if (stat.size === 0)
    throw new PublishInputError("The selected file is empty.", "file_empty");
  await checkSize?.({ size: stat.size, kind: format.kind });

  const changed = () => new PublishInputError(
    "The selected file changed during preflight. Select the file again.",
    "file_changed",
  );
  const handle = await open(
    absolutePath,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0),
  ).catch((error) => {
    if (error?.code === "ELOOP" || error?.code === "ENOENT") throw changed();
    throw error;
  });
  let bytes;
  try {
    const current = await handle.stat();
    if (!current.isFile() || !sameFile(stat, current)) throw changed();
    bytes = Buffer.allocUnsafe(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset);
      if (bytesRead === 0) throw changed();
      offset += bytesRead;
    }
    if (!sameFile(stat, await handle.stat())) throw changed();
  } finally {
    await handle.close();
  }

  return {
    absolutePath,
    path: name,
    name,
    kind: format.kind,
    type: format.type,
    bytes,
    size: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("base64url"),
  };
}

function sameFile(before, after) {
  return before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs;
}
