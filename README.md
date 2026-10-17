# HaoyouBox Agent Skill

[中文说明](README.zh-CN.md)

Publish one local HTML or Markdown file to [HaoyouBox](https://www.haoyoubox.com/agent) from a compatible AI agent. The Skill creates an expiring, password-protected browser link and returns the complete link, visible password, and actual expiry.

This repository contains the open Agent Skill and its documentation. The hosted HaoyouBox service and server source are not part of this repository.

## Install

### Codex, Claude Code, Cursor, and other supported agents

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

## Use

Ask your agent:

```text
Publish report.html to HaoyouBox and create a password-protected link that expires in 24 hours. Use English for the receiver page. Return the complete link, password, and actual expiry together.
```

For a Chinese receiver page:

```text
把 report.html 发布到好友盒，生成 24 小时密码保护链接。接收页使用中文。请一起返回完整链接、密码和实际到期时间。
```

On first use, the agent opens a HaoyouBox device approval flow. You sign in to HaoyouBox and approve the device. The agent then stores the publish token in its private credential store.

## What It Publishes

- One explicit `.html`, `.htm`, `.md`, or `.markdown` file.
- A fixed browser-ready version on HaoyouBox.
- A password-protected link with a server-enforced expiry.
- A Chinese or English receiver interface.

The Skill does not upload directories, ZIP files, hidden files, environment files, keys, symlinks, or an entire workspace. It does not read upload history, delete pages, revoke links, or manage accounts.

## Security

- Review the Skill before installation.
- Device approval always requires an explicit user action.
- The publish token must stay in the agent's private credential store.
- The raw share password is derived locally. HaoyouBox receives a salt and verifier, not the raw password.
- The complete share link includes the password for convenient prefill. Treat the complete link as one sensitive access credential.
- Do not publish files that contain secrets, personal data, private keys, or environment variables.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and token-response steps.

## Product

- [Agent access and installation](https://www.haoyoubox.com/agent)
- [中文 Agent 接入说明](https://www.haoyoubox.com/zh/agent)
- [Upload from the browser](https://www.haoyoubox.com/upload?lang=en)
- [Security boundaries](https://www.haoyoubox.com/security)

Recipients open the generated link in a browser. They do not need to install this Skill or create a HaoyouBox account.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm test` before opening a pull request.

## License

The files in this repository are licensed under the [Apache License 2.0](LICENSE). Use of the hosted HaoyouBox service remains subject to the product's published terms and policies.
