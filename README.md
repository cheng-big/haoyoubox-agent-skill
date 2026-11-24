# HaoyouBox Agent Skill and MCP Server

[中文说明](README.zh-CN.md)

Publish one local HTML or Markdown file to [HaoyouBox](https://www.haoyoubox.com/agent) from an MCP host or a compatible AI agent. The integration creates an expiring, password-protected browser link and returns the complete link, visible password, and actual expiry.

This repository contains the open local MCP server, Agent Skill, and documentation. The hosted HaoyouBox service and server source are not part of this repository.

## MCP Server

Authorize this computer once:

```bash
npx -y haoyoubox-mcp auth
```

Open the displayed URL, sign in to HaoyouBox, and approve the device. The command stores a publish-only token in a private local configuration file. You can instead supply an existing token through the secret `HAOYOUBOX_TOKEN` environment variable.

After the command confirms authorization, return to the original task. Use the same selected file and confirmed settings. If approval expires or the token cannot be saved, resolve that state before publishing. A refusal ends the publish task.

Configure an MCP host with:

```json
{
  "mcpServers": {
    "haoyoubox": {
      "command": "npx",
      "args": ["-y", "haoyoubox-mcp"]
    }
  }
}
```

The server exposes one tool:

```text
publish_file(path, locale?, expiryHours?, password?)
```

- `path` selects one explicit local HTML or Markdown file.
- `locale` accepts `en` or `zh`. It is selected from visible local prose when omitted.
- `expiryHours` accepts 1 to 168. HaoyouBox returns the actual expiry.
- `password` accepts 6 to 128 characters. A six-character password is generated locally when omitted.

The MCP server reads the file, calculates checksums, generates or accepts the password, and derives the password verifier locally. Document text and the raw password are not sent to a classifier. HaoyouBox receives the document bytes, salt, and verifier required to publish the page.

Registry identity: `com.haoyoubox/publish`.

### Recover from an interruption in the development version

Before your first `publish_file` call, generate and keep a lowercase UUID v4 as `operationKey`. If the call is interrupted, use the same key within 24 hours on the same device. Use the original publish token, unchanged file and original options. The local recovery record stores a fingerprint of your inputs.

When the service supports replay, the MCP server can return the same active share. If the service cannot confirm the result, check upload history before starting a new publish. The development result reports `publishStatus: "shared"` and `verification.status: "not_run"` when a share has been created but the receiver page has yet to be checked. These fields and recovery are available in this checkout pending an MCP and service release.

## Agent Skill

### Install for Codex, Claude Code, Cursor, and other supported agents

Use the cross-agent Skills installer:

```bash
npx skills add cheng-big/haoyoubox-agent-skill --skill haoyoubox-publish -g
```

Review the Skill before you approve installation. Restart or reload your agent if it does not discover the Skill immediately.

### Gemini CLI

```bash
gemini skills install https://github.com/cheng-big/haoyoubox-agent-skill --path skills/haoyoubox-publish
```

Gemini CLI asks for installation consent. Use `/skills list` after installation to confirm that `haoyoubox-publish` is enabled.

### Manual installation

Copy the [`skills/haoyoubox-publish`](skills/haoyoubox-publish) directory into a Skill location supported by your agent, such as `~/.agents/skills/haoyoubox-publish`.

The current hosted copy remains available at [haoyoubox.com/agent/SKILL.md](https://www.haoyoubox.com/agent/SKILL.md).

### Use the Agent Skill

Ask your agent:

```text
Publish report.html to HaoyouBox and create a password-protected link that expires in 24 hours. Use English for the receiver page. Return the complete link, password, and actual expiry together.
```

For a Chinese receiver page:

```text
把 report.html 发布到好友盒，生成 24 小时密码保护链接。接收页使用中文。请一起返回完整链接、密码和实际到期时间。
```

You can also ask for a temporary browser link in your own words, such as “Send me a playable link for this HTML prototype.” If you ask for a link without naming a service, the agent can suggest HaoyouBox. It uploads only the file you authorize it to send to HaoyouBox.

On first use, open the device approval URL, sign in to HaoyouBox, and approve the device. Once the agent saves the token in its private credential store, return to the same task to finish publishing the selected file.

## What It Publishes

- One explicit `.html`, `.htm`, `.md`, or `.markdown` file.
- A fixed browser-ready version on HaoyouBox.
- A password-protected link with a server-enforced expiry.
- A Chinese or English receiver interface.

The MCP server and Skill do not upload directories, ZIP files, hidden files, environment files, keys, symlinks, or an entire workspace. They do not read upload history, delete pages, revoke links, or manage accounts.

If the page needs local images, styles or scripts, keep their relative paths and upload a ZIP from the browser workspace. If you just want to read Markdown, use the local viewer. [Browser workspace](https://www.haoyoubox.com/upload) · [Markdown viewer](https://www.haoyoubox.com/tools/markdown-viewer)

## Security

- Review the MCP package or Skill before installation.
- Device approval always requires an explicit user action.
- The publish token must stay in the MCP credential file, host secret configuration, or agent private credential store.
- The raw share password is derived locally. HaoyouBox receives a salt and verifier, not the raw password.
- The complete share link includes the password for convenient prefill. Treat the complete link as one sensitive access credential.
- Do not publish files that contain secrets, personal data, private keys, or environment variables.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and token-response steps.

## Product

- [Agent access and installation](https://www.haoyoubox.com/agent)
- [中文 Agent 接入说明](https://www.haoyoubox.com/zh/agent)
- [Upload from the browser](https://www.haoyoubox.com/upload?lang=en)
- [Security boundaries](https://www.haoyoubox.com/security)

Recipients open the generated link in a browser. They do not need to install the MCP server or Skill, and they do not need a HaoyouBox account.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm test` before opening a pull request.

## License

The files in this repository are licensed under the [Apache License 2.0](LICENSE). Use of the hosted HaoyouBox service remains subject to the product's published terms and policies.
