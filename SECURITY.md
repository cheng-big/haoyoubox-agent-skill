# Security Policy / 安全政策

## Report a vulnerability

Use GitHub's **Security** tab to submit a private vulnerability report. Do not open a public issue for an unpatched vulnerability. Do not include a real publish token, device secret, share password, complete share link, or private file in any report.

Include the affected Skill version or commit, the expected behavior, the observed behavior, and a minimal reproduction that uses synthetic data.

## 报告安全问题

请通过 GitHub 仓库的 **Security** 页面提交 private vulnerability report。未修复的漏洞不要提交为公开 Issue。报告中不要包含真实发布令牌、设备 secret、分享密码、完整分享链接或私人文件。

请说明受影响的 Skill 版本或提交、预期行为、实际行为，并使用虚构数据提供最小复现步骤。

## Exposed credentials / 凭据泄漏

If a HaoyouBox publish token may be exposed, revoke it immediately from [Agent access](https://www.haoyoubox.com/app?view=agent). Create a new token only after the source of exposure is removed.

如果好友盒发布令牌可能泄漏，请立即在 [Agent 接入](https://www.haoyoubox.com/app?view=agent&lang=zh) 中撤销。确认泄漏来源已经清除后，再创建新令牌。

The repository contains no production credentials. Pull requests that add tokens, cookies, private files, registry signing keys, or credential-shaped fixtures will not be accepted.

## MCP credential handling / MCP 凭据处理

The MCP `auth` command stores a publish-only token outside the repository. On POSIX systems, the credential directory uses mode `0700` and the file uses mode `0600`. `HAOYOUBOX_TOKEN` is supported for MCP hosts that provide a secret environment store. Never put the token in MCP arguments, source files, logs, or `server.json`.

MCP `auth` 命令把仅有发布权限的令牌保存在仓库外。POSIX 系统上的凭据目录使用 `0700`，文件使用 `0600`。支持由 MCP Host 通过机密环境存储提供 `HAOYOUBOX_TOKEN`。不要把令牌写入 MCP 参数、源代码、日志或 `server.json`。

The stdio server reserves stdout for MCP JSON-RPC. Diagnostics go to stderr. Test and issue-report fixtures must use synthetic files, tokens, share URLs, and account data.

stdio 服务器只把 stdout 用于 MCP JSON-RPC。诊断信息写入 stderr。测试和问题报告必须使用虚构文件、令牌、分享链接和账号数据。
