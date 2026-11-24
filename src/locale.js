const decoder = new TextDecoder("utf-8");

export function selectLocale({ explicit, path, bytes }) {
  if (explicit !== undefined) {
    if (explicit !== "en" && explicit !== "zh")
      throw Object.assign(new Error("Locale must be en or zh."), {
        code: "locale_invalid",
      });
    return explicit;
  }

  const source = decoder.decode(bytes);
  const visible = /\.(?:html?|HTML?)$/.test(path)
    ? visibleHtml(source)
    : visibleMarkdown(source);
  const chinese = visible.match(/[\p{Script=Han}]/gu)?.length ?? 0;
  const latinWords = visible.match(/[\p{Script=Latin}]+/gu)?.length ?? 0;
  return chinese > latinWords ? "zh" : "en";
}

function visibleHtml(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template|noscript|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(
      /<([a-z][\w:-]*)\b[^>]*(?:\shidden(?:\s|=|>)|aria-hidden\s*=\s*["']?true)[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|ensp|emsp);/gi, " ")
    .replace(/&#(?:x[0-9a-f]+|\d+);/gi, " ");
}

function visibleMarkdown(source) {
  return source
    .replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
}
