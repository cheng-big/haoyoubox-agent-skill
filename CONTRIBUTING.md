# Contributing / 参与贡献

Contributions that improve compatibility, clarity, safety, or bilingual documentation are welcome.

欢迎提交兼容性、清晰度、安全性和中英文文档方面的改进。

## Before a pull request / 提交前

1. Keep the canonical Skill at `skills/haoyoubox-publish/SKILL.md`.
2. Keep `README.md` and `README.zh-CN.md` behaviorally equivalent.
3. Do not add credentials, private documents, real share links, or account data.
4. Preserve explicit user approval for device authorization and publishing.
5. Run:

```bash
npm test
```

Protocol changes must match the production HaoyouBox API before they merge. Documentation may link to the hosted product, but it must not claim that this repository contains the hosted service.

协议变更必须与好友盒正式 API 保持一致。文档可以链接到好友盒产品，但不能声称本仓库包含托管服务端代码。
