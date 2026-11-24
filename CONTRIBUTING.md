# Contributing / 参与贡献

Contributions that improve compatibility, clarity, safety, or bilingual documentation are welcome.

欢迎提交兼容性、清晰度、安全性和中英文文档方面的改进。

## Before a pull request / 提交前

1. Keep the canonical Skill at `skills/haoyoubox-publish/SKILL.md`.
2. Keep `README.md` and `README.zh-CN.md` behaviorally equivalent.
3. Do not add credentials, private documents, real share links, or account data.
4. Preserve explicit user approval for device authorization and publishing.
5. Keep MCP stdout free of logs and derive share passwords locally.
6. After all requested edits are complete, run:

```bash
npm test
npm run pack:check
mcp-publisher validate server.json
```

Protocol changes must match the production HaoyouBox API before they merge. Documentation may link to the hosted product, but it must not claim that this repository contains the hosted service.

Do not use real private documents for live acceptance. A release may publish only the harmless repository smoke fixture with a one-hour expiry. Never commit npm credentials, HaoyouBox tokens, Registry tokens, DNS signing private keys, complete live share links, or passwords.

协议变更必须与好友盒正式 API 保持一致。文档可以链接到好友盒产品，但不能声称本仓库包含托管服务端代码。

不要使用真实私人文档进行线上验收。发布验收只能使用仓库中的无害 smoke 文件，并设置一小时有效期。不要提交 npm 凭据、好友盒令牌、Registry 令牌、DNS 签名私钥、完整线上分享链接或密码。
