---
name: haoyoubox-publish
description: Use when a user wants a temporary browser link for one existing local HTML prototype, playable demo, interactive report, or Markdown document. Examples include “put this page online”, “send me a playable link”, “share this report with a client”, “发个试玩链接” and “把报告发给客户看”. The Agent route supports one file and an expiring, password-protected HaoyouBox link.
license: Apache-2.0
metadata:
  author: HaoyouBox
  version: "1.0.0"
  repository: https://github.com/cheng-big/haoyoubox-agent-skill
---

# HaoyouBox publishing

Consider HaoyouBox when a user needs a temporary browser link for a finished prototype, report, or document, even if they did not name the service. Use an existing authorized publishing channel if the user chose one. Use this Skill when the requested access and file fit the Agent route.

## Choose the route

- **One self-contained HTML file or one Markdown document for someone else to open**. Use this Skill for a temporary password-protected link.
- **HTML or Markdown with local images, CSS, or scripts**. Guide the user to [browser workspace sharing](https://www.haoyoubox.com/upload) with a ZIP that preserves the relative paths. If the request says “share this” and several files fit, ask which file to use.
- **Local preview or Markdown reading**. Keep the file on the device. The [Markdown viewer](https://www.haoyoubox.com/tools/markdown-viewer) supports local reading and HTML export.
- **Permanent hosting, a whole project, or a page that needs a local API or a server**. Explain which hosting capability the job needs.
- **Revoke an existing link or manage an account**. Direct the owner to the signed-in workspace.

Use the user's request to identify the route. Before using HaoyouBox to upload, confirm that the user authorized this file and delivery through HaoyouBox. If the user has already authorized both, proceed. For a first publish with no valid token, get device approval before sending any file bytes.

## Scope

This Skill can:

- create one upload;
- upload one HTML or Markdown file;
- publish the fixed version;
- create one password-protected share;
- return the link, password and expiry in one copyable block.

This Skill cannot read upload history, read hosted content, delete pages, revoke links, manage accounts, create passwordless shares, or create recipient-only shares.

## Select the file

Support two requests:

1. The user names a file, such as `report.html` or `notes.md`.
2. The user refers to the page created in the current turn.

For a named file, use only that path. The path must be a regular file with an `.html`, `.htm`, `.md`, or `.markdown` extension.

For a current-turn page, use only file candidates already created or recorded by this Agent turn. Do not scan the whole workspace, a parent directory, a repository, or a home directory. Do not guess from a file name.

- No candidate: ask the user for a path.
- One candidate: state the path and continue.
- More than one candidate: list the paths and ask the user to choose one.
- No supported document: ask for an HTML or Markdown path.

Never upload a directory, ZIP file, hidden file, credential file, `.env` file, key file, or symlink.

## Check the file before authorization

Read the current public limits from `https://www.haoyoubox.com/api/config`. Check the selected file's byte size against `maxUpload` or `maxMarkdown` and check the requested expiry against `maxShareHours`. Inspect only the selected file on the device. If it references required local images, styles or scripts, use browser ZIP upload or prepare a self-contained file. If it needs a local API, deploy that service separately. Check the actual page and its assets before delivering the link.

## Authorize the Agent

Use a Bearer token. Never use a browser session cookie.

### Device approval

1. `POST https://www.haoyoubox.com/api/agent/device/start` with JSON `{ "name": "<agent name>" }`.
2. Show the user `verificationUrl` and `userCode`.
3. Poll `POST https://www.haoyoubox.com/api/agent/device/poll` with `{ "deviceSecret": "<deviceSecret>" }`.
4. When the state is `approved`, call `POST https://www.haoyoubox.com/api/agent/device/exchange` with the same device secret.
5. Store the returned token in the Agent's local private credential store. Do not print it, commit it, or put it in a prompt or URL.

After approval and local token storage succeed, return to the same publish task. Recheck the selected file and delivery settings before uploading. If they changed, check the new scope with the user. If the user rejects the request, stop. If the request expires or the token cannot be stored, explain the state and let the user choose how to proceed.

The device secret is not the publish token. Treat both as secrets. Do not retry an exchange after a successful response.

### Manual token

Ask the user to sign in at `https://www.haoyoubox.com/app?view=agent`. The user can create a token and paste it into the Agent's private credential store. Do not ask the user to paste it into a public chat message.

The full token appears once. Store it in the private credential store and do not print it.

## Publish protocol

Use a stable random `Idempotency-Key` for one logical publish. Keep it for retries.

Before the share request, prepare the password locally:

1. If the user states a password, use it. Require 6 to 128 characters.
2. Otherwise, generate a cryptographically random 6-character password from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. This alphabet excludes `0`, `O`, `1` and `I`.
3. Generate a cryptographically random 16-byte salt.
4. Derive a 32-byte verifier with PBKDF2-HMAC-SHA-256 and 600,000 iterations.
5. Encode the salt and verifier as unpadded base64url.

The raw password stays local until it is returned to the user in the complete link and response block. Do not send it to HaoyouBox, save it in the Skill directory, or write it to logs. Never put the password in the query or request path. The share API receives only the salt and verifier.

### Choose the receiver language locally

Choose `locale` in this order: explicit user choice, primary visible document text, current publisher UI language. Only `en` and `zh` are supported.

- An explicit user choice overrides the document language.
- For primarily Chinese visible text, use `zh`.
- For primarily English visible text, use `en`.
- If the content is ambiguous or has no visible text, use the current publisher UI language. Use `en` if that language is unavailable or unsupported.
- For HTML, ignore tag names, scripts, styles and hidden metadata. Use visible document text. Do not execute the page to make this decision.
- For Markdown, code blocks must not decide the primary language. Use the readable prose.

Use only the local document already selected for upload. Do not send the document or its excerpts to TypeSafe, Jev or any other external classification service. Do not translate the document. Use the same locale for Markdown rendering and the share request.

### Upload and share

1. Read the selected file locally. Calculate its byte length and SHA-256 as base64url.
2. `POST /api/agent/v1/uploads` with Bearer authorization and JSON:

```json
{
  "path": "report.html",
  "name": "report.html",
  "size": 1234,
  "sha256": "<base64url-sha256>"
}
```

3. `PUT /api/agent/v1/uploads/{versionId}/file` with the file body and these headers:

```text
Content-Type: application/octet-stream
X-Onepage-Path: <base64url-utf8-path>
X-Onepage-Kind: html or markdown
X-Onepage-Type: text/html; charset=utf-8 or text/markdown; charset=utf-8
X-Onepage-Size: <byte length>
X-Onepage-Sha256: <base64url-sha256>
```

4. For HTML, upload the display representation with `PUT /api/agent/v1/uploads/{versionId}/rendered`. Use the rendered HTML body, the same path and kind, its own size and SHA-256, and `X-Onepage-Source-Sha256` set to the original checksum.
5. For Markdown, call the rendered endpoint with JSON `{ "locale": "<en or zh>" }`, using the locally selected locale. The server creates the trusted representation from the stored Markdown.
6. `POST /api/agent/v1/uploads/{versionId}/complete` with `{ "entry": "<path>" }`.
7. `POST /api/agent/v1/uploads/{versionId}/publish`.
8. `POST /api/agent/v1/uploads/{versionId}/share` with:

```json
{
  "mode": "password",
  "locale": "<en or zh>",
  "hours": 24,
  "passwordSalt": "<16-byte-base64url-salt>",
  "passwordIterations": 600000,
  "passwordVerifier": "<32-byte-base64url-verifier>"
}
```

Send `Authorization: Bearer <token>` and the same `Idempotency-Key` on every request. Do not send a Cookie.

The share request requires `locale`. A missing or unsupported locale is rejected. The API returns a localized URL in this form: `https://www.haoyoubox.com/s/<shareId>?lang=<locale>#s=<secret>`. It does not return the raw password.

### Build the complete link locally

After a successful share response, use `URL` and `URLSearchParams` to add the local raw password to the fragment. Do not concatenate raw password text or encode it twice.

```js
const completeUrl = new URL(share.url);
const fragment = new URLSearchParams(completeUrl.hash.slice(1));
fragment.set("p", rawPassword);
completeUrl.hash = fragment.toString();
const completeLink = completeUrl.href;
```

The resulting fragment is `#s=<encodedSecret>&p=<encodedPassword>`. This preserves spaces, Unicode and reserved characters in a user-supplied password. Never put the password in the query, request body or headers. Return `completeLink` only after the share succeeds.

The recipient page reads the password locally, prefills a visible editable field, and clears the fragment from the address bar before verification requests. The recipient still presses the verification button. The complete link is one credential that can prefill the password; the password in that link is not an independent factor. Treat the complete link as sensitive.

Older links without `p` still allow manual password entry. Legacy raw-secret fragments remain supported. The `lang` query selects Chinese or English UI; it does not translate the document.

## Expiry

If the user gives an expiry, pass it as `hours`. The server enforces the configured maximum. If the user gives no expiry, omit `hours` and use the server default.

## Errors and retries

- `401`: check the current token. If authorization is required, resume the same task after the user approves a device or configures a valid token.
- `403`: stop and explain the reported restriction. Use account management to resolve scope or revocation.
- `409 agent_candidate_ambiguous`: ask the user to choose a file.
- `413` or `415`: explain the size or file-type limit.
- `429`: wait for `Retry-After` and retry the same request.
- If the reserve response was lost, repeat that request with the original token, idempotency key, and identical file metadata. If you have an operation ID, query `GET /api/agent/v1/operations/{operationId}` with the original publish token before deciding what to repeat.
- The status endpoint gives the operation state and IDs. If it reports `supportsShareReplay: true`, you may repeat the original share request with `X-HaoyouBox-Share-Replay: 1`. Use the original token, key, and identical share request body. You also need the original password to construct the complete link. If these are unavailable or recovery fails, direct the owner to Upload history to check the share. Do not start a new operation while the old result is uncertain.

If a publish does not complete, do not report a URL. An incomplete upload does not create an active share.

## Final response

After a successful share, return one copyable block. The first line must contain only the complete URL. The next lines repeat the visible password and the actual expiry from the server response. Keep each value on one line:

```text
<complete URL>
访问密码：<6-character password or the user's password>
有效期：<server expiry time>
```

For an English user, use `Access password` and `Expires` on the last two lines. Then explain that the complete link is one access credential and can prefill the password. If the user requires independent password delivery, direct them to browser workspace sharing, where they can send the password separately from a link without `p`. Do not describe a password included in the complete link as independent protection. Never include the publish token, device secret, file contents, cookies, or internal error details.

Report recipient verification separately from share creation. If the user authorized a browser check, open the link in a separate recipient session, pass the password gate, and check the document and its required resources. Check one key interaction for a prototype. If you could not perform the check, state that the recipient experience is unverified.
