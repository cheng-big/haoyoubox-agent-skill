export function completeShareUrl(value, password) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Object.assign(new Error("HaoyouBox returned an invalid share URL."), {
      code: "share_url_invalid",
    });
  }
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.haoyoubox.com" ||
    !/^\/s\/[a-f0-9]{24}$/.test(url.pathname) ||
    !fragment.get("s")
  )
    throw Object.assign(new Error("HaoyouBox returned an invalid share URL."), {
      code: "share_url_invalid",
    });
  fragment.set("p", password);
  url.hash = fragment.toString();
  return url.href;
}
