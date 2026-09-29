# 内容来源与改编说明

本项目的 34 章、630 条正文来自 **《高性价比人生指南》**，作者署名为 **eternity4719 及 HowToLiveBetter 贡献者**。

- 原仓库：https://github.com/eternity4719/HowToLiveBetter
- 固定版本：`e91118de217945dfb8e3561dddc74c97cc64a707`，上游提交时间 `2026-09-29T17:16:23+08:00`。
- 正文许可：[Creative Commons Attribution 4.0 International（CC BY 4.0）](https://creativecommons.org/licenses/by/4.0/)。许可证全文保存在 [upstream/LICENSE](upstream/LICENSE)。
- 本项目将原书整理为微信小程序中的顺序阅读、检索和随机卡片。改动包括数据结构、交互与排版、为引文建立链接索引。除下方明确记录的一条备注修订外，字段原文、章节介绍和备注均保留；证据等级来自原书，并非本项目另行认证。
- `upstream/book/` 是逐章原始 Markdown 快照，`upstream/README.md` 保留上游的阅读说明、术语与许可声明。仅把换行符统一为 LF。文件哈希与版本记录见 [provenance.json](provenance.json)。
- 结构化数据中的 `sourceText` 保留整段来源文字；`sources` 为便于操作的链接索引，较长的链接标题可能截短，完整书目信息仍在 `sourceText` 中。
- 原书及本次改编均按现状提供，不保证内容无误或持续适用。涉及健康、急救、法律、财务和政策时，应核对原始来源及当时当地适用情况。
- 本项目是独立衍生作品，不代表原作者或贡献者提供、认可或背书此小程序。

## 本项目内容修订

2026-09-30：仅替换第 1 章第 5 条（不采、不买、不吃野生蘑菇）的处置备注。小程序明确提示怀疑误食有毒蘑菇时不要自行催吐、不要等待症状出现才求助，应尽快联系急救或医疗专业人员，并在安全情况下保留照片或样本供识别。这是本项目的整理修订，不是上游原文。

修订参考 [NSW 政府毒物信息中心急救指引](https://www.poisonsinfo.nsw.gov.au/first-aid) 和 [NSW Health 野生蘑菇中毒说明](https://www.health.nsw.gov.au/environment/factsheets/Pages/wild-mushroom-poisoning.aspx)。此单条修订不代表全书已经完成医学审校。

完整替换文案、展示提示与参考链接记录在 [editorial-overrides.json](editorial-overrides.json)。`provenance.json` 保留该文件的确定性 SHA-256、修订摘要和原备注 SHA-256。上游快照完全不改，导入器先核对原备注哈希，再应用覆盖，因此重新导入不会恢复错误处置建议；若原备注已变化，导入会停止以便重新审核。

## 可复现构建

`node scripts/import-content.mjs` 从仓库内已固定的快照离线构建 `miniprogram/data/book.js`，不联网、不更换上游版本，也不会把当前时间写入产物。

如需重新导入同一固定版本：`node scripts/import-content.mjs --source /path/to/HowToLiveBetter`。导入器校验 Git 提交、正文工作区状态和章节目录，保留所有字段及引文；无法识别的结构会报错，避免无声丢失内容。

上游更新需要先审核改动，再显式更改导入器中的固定提交与预期数量。不得直接用最新远端正文覆盖已审核的版本。
