<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lh_banner_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/lh_banner_light.png">
    <img src="docs/assets/lh_banner_light.png" alt="LearnHarness" width="640">
  </picture>
</p>

<p align="center"><strong>面向学习的智能体框架。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

> **这是 LearnHarness 的简体中文翻译版。**
> 原项目地址：**[amosblomqvist/learnharness](https://github.com/amosblomqvist/learnharness)**。
> 本仓库在原项目基础上增加了多语言界面层与简体中文语言包，独立维护，与原作者无隶属或背书关系。
> 沿用原项目的许可证 [AGPL-3.0](LICENSE)。

LearnHarness 用 AI 智能体为你规划并讲授课程，从你当前的理解出发，抵达你的目标。它会持续勾勒你理解了什么、如何推理，并随着你的学习不断更新这幅图景。

它不会只丢给你一段解释，而是根据你的回答和思路决定下一步该讲什么。教学把理解一个推理步骤一个推理步骤地搭起来，练习让它真正可用，而持久的知识图谱让这些收获跨会话延续。

![LearnHarness 教学会话](docs/assets/teaching-session.png)

## 多语言支持（本版本新增）

应用现在有了真正的界面语言层，而不是把英文写死在代码里。英文仍是默认语言、也是词条目录的源语言；**简体中文**是第一份完整译文。

- **在应用内切换：** 设置 → 通用 → **语言**（界面）与 **教学语言**。
- **默认值：** 语言跟随操作系统；教学语言跟随界面语言。
- **映射规则：** `zh`、`zh-CN`、`zh-Hans` 解析为简体中文；繁体标签（`zh-TW`、`zh-HK`、`zh-Hant`）在繁体目录出现之前回退英文，避免把简体界面显示给繁体用户。
- **无需重启：** 切换界面语言立即重新渲染；桌面版的原生菜单自定义项会当场重建，撤销、复制等系统项由操作系统本地化。
- **教学语言按会话冻结。** 每个会话在创建时记录当时的教学语言；之后修改设置只影响新会话——同一段对话不会中英混杂，已有记录也不会被改写。
- **听写是独立设置。** 听写语言在设置 → 服务商中单独选择，不会从界面语言推导。
- **用户数据不翻译。** 聊天记录、笔记和已有的图谱命题保持写入时的语言。
- **系统提示保持英文。** 教学准则按英文设计（用户覆盖也存放在英文路径）。运行时会在末尾追加固定的 `## Learner language` 区块，告诉模型用哪种语言输出学习者可见的内容——研究者、演示构建、绘图、PDF 阅读、抽取与审校等子代理同样适用。

### 已翻译的范围

| 层 | 状态 |
|---|---|
| 界面（侧边栏、会话、题目、练习、图谱、设置、对话框、卡片、插件外壳） | ✅ 简体中文 |
| 原生菜单与启动失败对话框（桌面版） | ✅ 简体中文 |
| 词条目录、术语表、保留表 | ✅ `messages/`、`i18n/` |
| 教学输出 | ✅ 通过学习者语言区块（按会话） |
| 听写语言名 | 保留英文语言名（视为专名） |
| `README` / `docs/` | 上游文档为英文；本 README 提供中英两份 |

### 如何新增一门语言

1. 复制 `messages/en.json` 为 `messages/<locale>.json`，只翻译值——键、ICU 占位符、代码片段和链接目标保持不动。
2. 在 `src/core/locales.ts` 的 `APP_LOCALES` 中加入该语言（并在 `src/i18n/index.ts` 的 `CATALOG_LOCALES` 中登记）。
3. 在 `i18n/glossary.<locale>.json` 里记录术语；把允许与英文相同的词（品牌、协议名、扩展名）写进 `i18n/preserve.json`。
4. 运行 `npm run check:i18n`：校验键集合、占位符集合、空值、未译整句，以及源码引用的每个键都存在。

不需要按路径区分语言的路由，也不需要复制仓库：一门语言就是一份词条目录加一份术语表。

## 工作方式

1. **摸底。** 教学开始前，智能体会找到你对每个前置知识的理解边界。你的回答、置信度和思路会告诉它从哪里开始。
2. **规划。** 它从起点到目标画出一张依赖图。你能看到这份计划，而当实际理解与预期不同时，课程会随之调整。
3. **授课。** 每一步都建立在你已经理解的内容上。你做出预测、获得解释、检验理解；在理解出现混乱时先修正，再继续往上搭。目标是让结论显得显而易见，而不只是眼熟。
4. **练习。** 独立的练习会话会给出多种问题，要求你在不被提示名称的情况下自己想起相应知识。题目与提示会随你的思路调整。

**把思路说出来。** 思路输入框让你用自己的话解释推理、疑惑和反应。智能体因此得到的是细致的图景，而不只是对错记录。你可以打字，也可以使用听写。

**带上你的文件。** 在桌面版中，用回形针附加 PDF、图片或任意文件，也可以直接拖入。文件不会被复制：消息携带它的路径，智能体从那里读取。

智能体还可以在后台检索资料、生成图解、在课程中展示你自己的图片并用箭头和标签标注（包括直接从 PDF 中裁出的插图，例如讲义页面），以及构建可交互的演示。

## 会延续下去的知识

你学到的东西会沉淀为命题与推理链：一条条主张，以及推出它们的前提。图谱把这些结构画出来，并链接回来源会话。你也可以导入笔记。

后续的教学会话可以读取图谱，而不必从零开始；练习会话也能从中取材。它存储的是想法及其联系，而不是对你能力的评分。

![LearnHarness 知识图谱](docs/assets/knowledge-graph.png)

## 下载与开始

**[从 learnharness.ai 下载](https://learnharness.ai)** —— [GitHub Releases](https://github.com/amosblomqvist/learnharness/releases)

这些是**原项目**的安装包，界面为英文。本翻译版在[本仓库的 Releases](https://github.com/inHT/learnharness-multilingual/releases) 发布 **Windows x64** 安装包；macOS 与 Linux 版本可从源码构建（见下）。

- **macOS（Apple Silicon）：** 已签名并公证的 DMG，拖入“应用程序”即可。
- **Windows（x64）：** 运行安装程序。目前未签名，Windows 可能提示“未知发布者”或 SmartScreen 警告。
- **Linux（x64）：** 给 AppImage 加可执行权限后打开，或安装 Debian/Ubuntu 的 `.deb`。

选好模型，然后用你想弄懂的问题开始一个会话。你可以使用服务商 API 密钥、桌面版支持的订阅连接、已安装的 [Claude Code CLI](docs/claude-code.md)，或[自定义 OpenAI 兼容端点](docs/custom-providers.md)（包括本地模型服务）。可选的听写和网页检索使用各自的服务密钥。网页研究可在 设置 → 服务商 → 搜索 中配置 Tavily、Brave、Exa、Firecrawl 或 Ollama 密钥；Ollama 检索使用其托管服务，而非本地模型服务。

模型配置、听写、文件与笔记导入见[快速开始](docs/getting-started.md)；缓存与费用等高级设置见[上下文、缓存与费用](docs/compaction-accounting.md)。

三个平台都支持应用内更新。

## 你的密钥，你的数据

- **你的密钥与模型。** 没有 LearnHarness 订阅或加价。费用取决于你的服务商、CLI 配置、订阅或本地部署。实时计费器只估算已知的 API 费用，不包含订阅、CLI 或自定义端点。
- **本地存储。** 会话、图谱、设置和 API 密钥都在你的机器上。学习记录是可直接查看的纯文件。
- **外部服务。** 模型通过你配置的服务商运行。模型请求会发送完成任务所需的上下文；网页检索与听写也会访问外部服务。本地存储不等于离线处理。
- **可检查的行为。** 系统提示可见、可编辑。应用以 AGPL-3.0 许可证开源。

## 开发与支持

```bash
npm ci
npm run plugins:setup
npm run dev        # http://localhost:3000
npm test           # 词条校验 + 夹具与假服务商
npm run check:i18n # 仅词条校验
```

Windows 的 `cmd` 下 `npm test` 里的 `NODE_ENV=test` 前缀不生效，请使用：

```cmd
cmd /c "set NODE_ENV=test&& npx tsx --test --test-timeout=90000 tests\*.test.ts tests\*.test.tsx"
```

配置位于 `data/settings.json`（或 `LH_DATA_DIR`）：`general.locale` 是界面语言（`"system"` 或语言 id），`general.teachingLocale` 是教学语言（`"follow"` 或语言 id）。

全部指南见[文档索引](docs/README.md)；另有[开发](docs/development.md)、[架构](docs/architecture.md)、[键盘快捷键](docs/keyboard.md)、[主题格式](docs/themes.md)与[桌面构建与发布](docs/desktop-release.md)。

受信任的本地插件请从[编写指南与能力映射](docs/plugin-authoring.md)开始，其中链接了题目、练习、提交、视图上下文与 UI 契约。可运行的小模板在 [`examples/plugins/`](examples/plugins/)，功能源码在 [`plugins/`](plugins/)，内部机制见[宿主架构](docs/plugin-architecture.md)。

关于本**翻译版**的问题、缺陷与功能建议：请在本仓库提 issue。

上游问题与缺陷：[amosblomqvist/learnharness issues](https://github.com/amosblomqvist/learnharness/issues)。

安全漏洞：请按 [SECURITY.md](SECURITY.md) 私下报告，不要发在公开 issue 中。

## 许可证

[AGPL-3.0](LICENSE) —— 按许可证要求沿用原项目。

应用永久免费开源。如果上游项目将来对任何东西收费，那也只会是便利性服务——托管密钥、托管部署——而不会是你可以在本地运行的功能。
