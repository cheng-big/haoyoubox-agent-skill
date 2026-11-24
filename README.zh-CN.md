# 好友盒 Agent Skill 与 MCP Server

[English README](README.md)

通过 MCP Host 或兼容的 AI Agent，把一个本地 HTML 或 Markdown 文件发布到[好友盒](https://www.haoyoubox.com/zh/agent)。集成会生成有有效期的密码保护网页链接，并返回完整链接、可见密码和实际到期时间。

本仓库开源本地 MCP Server、Agent Skill 和配套文档。好友盒托管服务及服务端源代码不包含在本仓库中。

## MCP Server

先在当前电脑完成一次授权：

```bash
npx -y haoyoubox-mcp auth
```

打开命令显示的网址，登录好友盒并批准设备。命令会把仅有发布权限的令牌保存到本地私密配置文件。也可以通过机密环境变量 `HAOYOUBOX_TOKEN` 提供已有令牌。

命令确认授权完成后，回到原来的任务，使用同一个文件和已确认的设置继续发布。授权过期或令牌保存失败时，先处理对应问题。用户拒绝时，结束发布任务。

在 MCP Host 中配置：

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

服务器只提供一个工具：

```text
publish_file(path, locale?, expiryHours?, password?)
```

- `path` 指向一个明确的本地 HTML 或 Markdown 文件。
- `locale` 只接受 `en` 或 `zh`。省略时只根据本地可见正文选择。
- `expiryHours` 接受 1 到 168。实际到期时间以好友盒返回值为准。
- `password` 接受 6 到 128 个字符。省略时在本地生成 6 位密码。

MCP Server 在本地读取文件、计算校验值、生成或接收密码，并派生密码 verifier。文档内容和原始密码不会发送给分类服务。好友盒只接收发布网页所需的文档字节、salt 和 verifier。

Registry 身份：`com.haoyoubox/publish`。

### 开发版如何继续中断的发布

首次调用 `publish_file` 前，生成并保存一个小写 UUID v4，填入 `operationKey`。如果发布中断，24 小时内可在同一设备上使用原标识继续。请使用原发布令牌、原文件和原设置。本地记录保存输入的校验值。

服务支持重放时，MCP Server 可以返回同一个仍有效的分享链接。服务无法确认结果时，请先在上传历史中查看，再决定是否发起新发布。链接已创建且接收页尚未检查时，开发版返回 `publishStatus: "shared"` 和 `verification.status: "not_run"`。这些字段和恢复流程已在本地开发版实现，待 MCP 和服务端发布。

## Agent Skill

### 安装到 Codex、Claude Code、Cursor 及其他受支持 Agent

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

### 使用 Agent Skill

对 Agent 说：

```text
把 report.html 发布到好友盒，生成 24 小时密码保护链接。接收页使用中文。请一起返回完整链接、密码和实际到期时间。
```

英文接收页示例：

```text
Publish report.html to HaoyouBox and create a password-protected link that expires in 24 hours. Use English for the receiver page. Return the complete link, password, and actual expiry together.
```

也可以直接说「给这个 HTML 原型发个试玩链接」。如果你只说要一个链接，Agent 可以推荐好友盒。只有你授权把指定文件上传到好友盒后，Agent 才会上传。

首次使用时，打开设备授权网址，登录好友盒并批准设备。Agent 将令牌保存到私密凭据存储后，回到同一个任务继续发布所选文件。

## 可以发布什么

- 一个明确的 `.html`、`.htm`、`.md` 或 `.markdown` 文件。
- 一个固定的、浏览器可直接打开的好友盒版本。
- 一个有服务端有效期的密码保护链接。
- 中文或英文接收页面。

MCP Server 和 Skill 不会上传目录、ZIP、隐藏文件、环境文件、密钥、符号链接或整个工作区。它们不能读取上传历史、删除页面、撤销链接或管理账号。

网页依赖本地图片、样式或脚本时，保留相对路径，打成 ZIP 后在浏览器工作台上传。只想阅读 Markdown 时，打开本地阅读器。[浏览器工作台](https://www.haoyoubox.com/zh/upload) · [Markdown 阅读器](https://www.haoyoubox.com/zh/tools/markdown-viewer)

## 安全说明

- 安装前先检查 MCP 包或 Skill 内容。
- 设备授权始终需要用户明确确认。
- 发布令牌必须保存在 MCP 凭据文件、Host 机密配置或 Agent 的私密凭据存储中。
- 原始分享密码在本地处理。好友盒只接收 salt 和 verifier，不接收原始密码。
- 完整分享链接包含用于预填的密码。它是一个敏感的完整访问凭证。
- 不要发布包含密码、个人信息、私钥或环境变量的文件。

漏洞报告和令牌泄漏处理方法见 [SECURITY.md](SECURITY.md)。

## 好友盒产品入口

- [中文 Agent 接入说明](https://www.haoyoubox.com/zh/agent)
- [Agent access and installation](https://www.haoyoubox.com/agent)
- [从浏览器上传](https://www.haoyoubox.com/upload?lang=zh)
- [安全边界](https://www.haoyoubox.com/zh/security)

接收人只需要在浏览器中打开生成的链接。他们不需要安装 MCP Server 或 Skill，也不需要注册好友盒账号。

## 参与贡献

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 Pull Request 前运行 `npm test`。

## 许可证

本仓库文件使用 [Apache License 2.0](LICENSE)。好友盒托管服务仍适用产品公开的服务条款和政策。
