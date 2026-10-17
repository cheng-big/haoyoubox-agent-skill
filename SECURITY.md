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

The repository contains no production credentials. Pull requests that add tokens, cookies, private files, or credential-shaped fixtures will not be accepted.
