# 好友盒 Agent Skill

[English README](README.md)

通过兼容的 AI Agent，把一个本地 HTML 或 Markdown 文件发布到[好友盒](https://www.haoyoubox.com/zh/agent)。Skill 会生成有有效期的密码保护网页链接，并返回完整链接、可见密码和实际到期时间。

本仓库只开源 Agent Skill 和配套文档。好友盒托管服务及服务端源代码不包含在本仓库中。

## 安装

### Codex、Claude Code、Cursor 及其他受支持 Agent

使用跨 Agent 的 Skills 安装器：

```bash
npx skills add cheng-big/haoyoubox-agent-skill --skill haoyoubox-publish -g
```

授权安装前请先查看 Skill 内容。如果 Agent 没有立即发现 Skill，请重启 Agent 或刷新 Skills 列表。

### Gemini CLI

```bash
gemini skills install https://github.com/cheng-big/haoyoubox-agent-skill --path skills/haoyoubox-publish
```

Gemini CLI 会要求确认安装。安装后使用 `/skills list`，确认 `haoyoubox-publish` 已启用。

### 手动安装

把 [`skills/haoyoubox-publish`](skills/haoyoubox-publish) 目录复制到 Agent 支持的 Skill 目录，例如 `~/.agents/skills/haoyoubox-publish`。

好友盒仍保留直接托管版本：[haoyoubox.com/agent/SKILL.md](https://www.haoyoubox.com/agent/SKILL.md)。

## 使用

对 Agent 说：

```text
把 report.html 发布到好友盒，生成 24 小时密码保护链接。接收页使用中文。请一起返回完整链接、密码和实际到期时间。
```

英文接收页示例：

```text
Publish report.html to HaoyouBox and create a password-protected link that expires in 24 hours. Use English for the receiver page. Return the complete link, password, and actual expiry together.
```

首次使用时，Agent 会启动好友盒设备授权。你需要登录好友盒并明确确认设备。之后，Agent 把发布令牌保存在自己的私密凭据存储中。

## 可以发布什么

- 一个明确的 `.html`、`.htm`、`.md` 或 `.markdown` 文件。
- 一个固定的、浏览器可直接打开的好友盒版本。
- 一个有服务端有效期的密码保护链接。
- 中文或英文接收页面。

Skill 不会上传目录、ZIP、隐藏文件、环境文件、密钥、符号链接或整个工作区。它不能读取上传历史、删除页面、撤销链接或管理账号。

## 安全说明

- 安装前先检查 Skill 内容。
- 设备授权始终需要用户明确确认。
- 发布令牌必须保存在 Agent 的私密凭据存储中。
- 原始分享密码在本地处理。好友盒只接收 salt 和 verifier，不接收原始密码。
- 完整分享链接包含用于预填的密码。它是一个敏感的完整访问凭证。
- 不要发布包含密码、个人信息、私钥或环境变量的文件。

漏洞报告和令牌泄漏处理方法见 [SECURITY.md](SECURITY.md)。

## 好友盒产品入口

- [中文 Agent 接入说明](https://www.haoyoubox.com/zh/agent)
- [Agent access and installation](https://www.haoyoubox.com/agent)
- [从浏览器上传](https://www.haoyoubox.com/upload?lang=zh)
- [安全边界](https://www.haoyoubox.com/zh/security)

接收人只需要在浏览器中打开生成的链接。他们不需要安装本 Skill，也不需要注册好友盒账号。

## 参与贡献

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 Pull Request 前运行 `npm test`。

## 许可证

本仓库文件使用 [Apache License 2.0](LICENSE)。好友盒托管服务仍适用产品公开的服务条款和政策。
