import { parse as parseJavaScript } from "acorn";
import MarkdownIt from "markdown-it";
import { parse as parseHtml } from "parse5";
import { PublishInputError, readPublishFile } from "./file-input.js";

const origin = "https://www.haoyoubox.com";
const configUrl = origin + "/api/config";
const markdown = new MarkdownIt();
const documentDecoder = new TextDecoder();
// Inspect file: targets that the renderer would otherwise ignore.
markdown.validateLink = () => true;

const assetAttributes = new Map([
  ["audio", ["src"]],
  ["embed", ["src"]],
  ["image", ["href", "xlink:href"]],
  ["img", ["src"]],
  ["input", ["src"]],
  ["object", ["data"]],
  ["script", ["src"]],
  ["source", ["src"]],
  ["track", ["src"]],
  ["use", ["href", "xlink:href"]],
  ["video", ["src", "poster"]],
]);
const assetLinks = new Set(["stylesheet", "preload", "modulepreload", "icon", "manifest", "apple-touch-icon"]);

export async function preflightPublish(
  { path, expiryHours },
  { cwd, fetch = globalThis.fetch } = {},
) {
  if (expiryHours !== undefined && !positiveInteger(expiryHours))
    throw new PublishInputError("Expiry must be a positive number of whole hours.", "expiry_invalid");

  const file = await readPublishFile(path, {
    cwd,
    async checkSize({ size, kind }) {
      const limits = await readLimits(fetch);
      const limit = kind === "markdown" ? limits.maxMarkdown : limits.maxUpload;
      if (size > limit)
        throw new PublishInputError(
          "The selected file has " + sizeLabel(size) + ". HaoyouBox accepts up to " +
            sizeLabel(limit) + ". Reduce the file size and retry.",
          "file_too_large",
        );
      if (expiryHours > limits.maxShareHours)
        throw new PublishInputError(
          "Choose an expiry of up to " + limits.maxShareHours + " hours.",
          "expiry_invalid",
        );
    },
  });
  checkPublishDependencies(file);
  return file;
}

async function readLimits(fetch) {
  try {
    const response = await fetch(configUrl, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const limits = await response.json();
      if (
        limits?.uploadProtocol === "staged" &&
        positiveInteger(limits.maxUpload) &&
        positiveInteger(limits.maxMarkdown) &&
        positiveInteger(limits.maxShareHours) &&
        limits.maxMarkdown <= limits.maxUpload
      ) return limits;
    }
  } catch {
    // The same error covers network failure and an unreadable response.
  }
  throw new PublishInputError(
    "HaoyouBox's current publish limits could not be read. Retry when the service is reachable.",
    "limits_unavailable",
  );
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function sizeLabel(bytes) {
  const inMiB = bytes / 1024 ** 2;
  if (inMiB < 1) return bytes + " bytes";
  return Number(inMiB.toFixed(2)) + " MiB (" + bytes + " bytes)";
}

export function checkPublishDependencies(file) {
  const source = decodeDocument(file.bytes);
  const risks = new Set();
  const documentUrl = new URL(encodeURIComponent(file.path), origin);
  if (file.kind === "html") {
    scanHtml(source, risks, documentUrl);
  } else {
    for (const block of markdown.parse(source, {})) {
      for (const token of block.children || []) {
        if (token.type === "image")
          classifyReference(token.attrGet("src"), "asset", risks, documentUrl);
        if (token.type === "link_open")
          classifyReference(token.attrGet("href"), "navigation", risks, documentUrl);
      }
    }
  }
  if (risks.has("backend"))
    throw new PublishInputError(
      "This file appears to depend on an address on your device or an API on its current server. Remove the dependency or use a hosted backend with access controls.",
      "file_backend_dependency",
    );
  if (risks.has("asset"))
    throw new PublishInputError(
      "This file appears to reference a separate local resource. Embed it in the file, or use relative paths and upload a ZIP with its resources in the browser workspace at " + origin + "/upload",
      "file_local_dependency",
    );
}

function decodeDocument(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes);
  return documentDecoder.decode(bytes);
}

function scanHtml(source, risks, documentUrl) {
  const remaining = [parseHtml(source)];
  while (remaining.length) {
    const node = remaining.pop();
    const tag = node.tagName;
    const attributes = new Map(node.attrs?.map(({ name, value, prefix }) => [
      prefix ? prefix + ":" + name : name,
      value,
    ]));
    for (const name of assetAttributes.get(tag) || [])
      classifyReference(attributes.get(name), "asset", risks, documentUrl);
    if (tag === "link" && attributes.get("rel")?.toLowerCase().split(/\s+/).some(rel => assetLinks.has(rel)))
      classifyReference(attributes.get("href"), "asset", risks, documentUrl);
    if (tag === "a" || tag === "base")
      classifyReference(attributes.get("href"), "navigation", risks, documentUrl);
    if (tag === "form") {
      classifyReference(attributes.get("action"), "backend", risks, documentUrl);
      if (attributes.get("method")?.trim().toLowerCase() === "post" && !attributes.get("action")?.trim())
        risks.add("backend");
    }
    if (attributes.has("formaction"))
      classifyReference(attributes.get("formaction"), "backend", risks, documentUrl);
    if (tag === "iframe")
      classifyReference(attributes.get("src"), "asset", risks, documentUrl);
    if (tag === "img" || tag === "source")
      scanSrcset(attributes.get("srcset"), risks, documentUrl);
    if (attributes.has("style"))
      scanCss(attributes.get("style"), risks, documentUrl);
    if (tag === "style")
      scanCss(node.childNodes?.[0]?.value || "", risks, documentUrl);
    if (tag === "script" && !attributes.has("src"))
      scanScript(node.childNodes?.[0]?.value || "", attributes.get("type"), risks, documentUrl);
    for (const child of node.childNodes || []) remaining.push(child);
  }
}

function scanSrcset(srcset, risks, documentUrl) {
  // A data URL can contain commas, so delimit that URL by whitespace.
  const candidates = srcset?.matchAll(/(?:^|,)\s*(data:\S+|[^,\s]+)[^,]*/gi) || [];
  for (const [, candidate] of candidates)
    classifyReference(candidate, "asset", risks, documentUrl);
}

function scanCss(css, risks, documentUrl) {
  const references = css.replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()]*))\s*\)|@import\s+(?:"([^"]+)"|'([^']+)')/gi);
  for (const [, double, single, unquoted, importDouble, importSingle] of references) {
    const target = double ?? single ?? unquoted ?? importDouble ?? importSingle;
    classifyReference(target, "asset", risks, documentUrl);
  }
}

function scanScript(source, type, risks, documentUrl) {
  const mode = type?.toLowerCase().trim();
  if (mode && !["module", "text/javascript", "application/javascript"].includes(mode)) return;
  let tree;
  try {
    tree = parseJavaScript(source, {
      ecmaVersion: "latest",
      sourceType: mode === "module" ? "module" : "script",
    });
  } catch {
    // Static analysis considers only scripts that it can parse as JavaScript.
    return;
  }
  const remaining = [tree];
  while (remaining.length) {
    const node = remaining.pop();
    if (node.type === "CallExpression" || node.type === "NewExpression") {
      const callee = node.callee.name ?? node.callee.property?.name;
      if (["fetch", "WebSocket", "EventSource"].includes(callee))
        classifyReference(stringLiteral(node.arguments[0]), "backend", risks, documentUrl);
      if (callee === "open" && /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(stringLiteral(node.arguments[0]) || ""))
        classifyReference(stringLiteral(node.arguments[1]), "backend", risks, documentUrl);
    }
    if (["ImportDeclaration", "ImportExpression", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)) {
      const target = stringLiteral(node.source);
      if (/^(?:[./]|[a-z]+:)/i.test(target || ""))
        classifyReference(target, "asset", risks, documentUrl);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const entry of child) if (entry?.type) remaining.push(entry);
      } else if (child?.type) {
        remaining.push(child);
      }
    }
  }
}

function stringLiteral(node) {
  if (typeof node?.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
}

function classifyReference(reference, kind, risks, documentUrl) {
  if (!reference?.trim()) return;
  const target = reference.trim();
  if (/^(?:file:|[a-z]:[\\/]|\\\\)/i.test(target)) {
    risks.add("asset");
    return;
  }
  if (target.startsWith("#") || /^(?:data|blob):/i.test(target)) return;
  let url;
  try {
    url = new URL(target.replaceAll("\\", "/"), documentUrl);
  } catch {
    return;
  }
  const host = url.hostname.replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") ||
      /^127\./.test(host) || ["[::1]", "0.0.0.0"].includes(host)) {
    risks.add("backend");
    return;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return;
  if (kind === "navigation") return;
  if (kind === "asset" && url.pathname === documentUrl.pathname) return;
  risks.add(kind);
}
