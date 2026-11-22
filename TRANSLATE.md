# TRANSLATE.md — 第二轮：多语言完整性审计与增量修复（交接文档）

> 读者：接手本仓库的下一位 AI。
> 本轮**不要重做架构**。第一轮的 i18n 层已经落地、测试通过并发布；本轮只做**完整性审计 + 增量修复**：找出没有走 `t()` 的英文、补齐 zh-CN、修掉第一轮遗留的边界问题，并把结论沉淀成可复跑的检查。

---

## 0. 五分钟上手

```cmd
cd /d "D:\AI\LearnHarness 源代码\learnharness"

npm run check:i18n
npx tsc --noEmit
npm run dev            REM http://localhost:3000
```

- 语言设置：设置 → 通用 → 语言 / 教学语言。
- 数据落在 `learnharness\data\`（被 git 忽略）。要隔离试玩：`set LH_DATA_DIR=D:\tmp\lh-i18n-audit&& npm run dev`。
- 没有真实模型密钥也能做**纯界面审计**：首页、设置、新建会话、图谱空态都能看；只有"发一条消息"需要先配服务商密钥与三个模型档位。
- 本轮产物：增量词条 + 译文 + 测试 + 按区域提交。**不要**把 `.tsx` 里的英文直接换成中文，**不要**复制仓库，**不要**为语言加 `/zh` 路由。

---

## 1. 仓库、远端与发布状态

| 项 | 值 |
|---|---|
| 工作目录 | `D:\AI\LearnHarness 源代码\learnharness`（git root；父目录不是仓库） |
| 分支 | `main`，与 `origin/main` 同步 |
| `origin` | `https://github.com/inHT/learnharness-multilingual.git` — 公开的独立仓库（**不是 fork**） |
| `upstream` | `https://github.com/amosblomqvist/learnharness.git` — 原项目，只用于将来同步 |
| fork | `inHT/learnharness`（上游镜像，独立仓库不依赖它） |
| 发布形态 | "简体中文翻译版"：`README.md`（英文默认，含译文声明与上游链接）+ `README.zh-CN.md`；`LICENSE` 原样保留 AGPL-3.0 |

规则：

- **绝不 push 到 `upstream`**，也不要向上游开 PR。
- `origin` 是本项目唯一的发布目标；推送前确认工作区干净、检查全绿。
- Git 全局配置了 `http.proxy`/`https.proxy = http://127.0.0.1:7890`。该代理没开时 git 网络命令会报 `Failed to connect to 127.0.0.1 port 7890`；本仓库已设置**空的本地代理**，正常的 `git push` 可直接用。若要用代理，删除本仓库的这两项本地配置即可。
- `gh` 已登录 `inHT`，令牌含 `repo` + `workflow`（设备流授权已完成）。若将来又缺 `workflow`，`.github/workflows/*` 会被拒绝，需要 `gh auth refresh --scopes workflow --hostname github.com`。

### 工作区当前有 3 个未提交改动（开工前先决定）

| 文件 | 内容 | 建议 |
|---|---|---|
| `components/graph-view.tsx` | 真实 i18n 修复：Chains 按钮改用 `minimalHome.chainsButton`；空态两行改用 `minimalHome.emptyStart/emptyAttach` | **应提交**（属于本轮"已修未提交"项） |
| `package.json` | `allowScripts: { "electron@44.9.3": true }`（npm 11 的安装脚本门禁，Electron postinstall 需要） | 与 i18n 无关；保留则单独提交并说明，或 `git checkout -- package.json` 回退 |
| `next-env.d.ts` | Next 重新生成（`.next/dev/types` → `.next/types`） | 随 `next dev` 自动变化；可提交以保持树干净 |

---

## 2. 第一轮交付索引（读代码先看这些）

### 2.1 运行时与数据

| 文件 | 作用 |
|---|---|
| `src/core/locales.ts` | `AppLocale`、`APP_LOCALES`、`LocaleSetting`/`TeachingLocaleSetting`、`resolveLocale`/`resolveTeachingLocale`、`mapSystemLocale`、`systemLocaleTag`、`learnerLanguageInstruction` |
| `src/i18n/index.ts` | 点分键查找、ICU 格式化（`intl-messageformat`）、`translate`（缺键回退英文再回退键名）、`translateOr`（运行时字符串兜底）、`formatTemplate` |
| `src/i18n/react.tsx` | `I18nProvider`、`useT`、`useI18n`；无 Provider 时回退英文（SSR 测试因此不需要包 Provider） |
| `messages/en.json` | **源目录**，值必须与改造前界面原文逐字一致 |
| `messages/zh-CN.json` | 简体中文全量译文（当前 518 键） |
| `i18n/glossary.zh-CN.json` | 术语表（session=会话、steer=引导、proposition=命题…） |
| `i18n/preserve.json` | 允许中英相同的键（纯标点模板等） |
| `scripts/check-translations.mjs` | 词条校验，已接入 `npm test` |
| `src/server/locale-boot.ts` | 服务端解析：记录 + OS tag → 界面/教学语言 |
| `app/layout.tsx` | 服务端设置 `<html lang>`；挂载 `I18nProvider` |
| `components/settings/language-settings.tsx` | 设置的两行语言选择；保存成功后 `setLocale` 即时切换 |

### 2.2 设置与记录

- `GeneralSettings` 新增 `locale`（出厂 `"system"`）与 `teachingLocale`（出厂 `"follow"`），见 `src/core/settings.ts`。
- 清洗器：非法值丢弃、未知键保留；写入侧 `src/server/settings-body.ts` 严格校验。
- 解析层 `src/core/settings-resolution.ts` 输出具体值。
- 会话记录 `ChatRecord.teachingLocale`（`src/core/contracts/chat.ts`）在 `src/store/chats.ts` 的 `createChat` 里**按当时设置冻结**。

### 2.3 教学语言

- `src/agent/teacher-agent.ts`：`composeInstructions(kind, switches?, teachingLocale?)` 在片段拼接**之后**追加 `## Learner language`；缓存按 kind+locale；不传 locale 时输出与改造前逐字节一致。
- `src/agent/subagents/language.ts`：`withLearnerLanguage(prompt, locale?)`。
- 子代理接入：`researcher.ts`、`demo-builder.ts`、`visual-maker.ts`、`pdf-reader.ts`、`extraction.ts`（extractor / notes extractor / auditor）。
- 作业运行器 `src/agent/subagents/runner.ts`：`jobContext()` 读会话冻结语言；**英文会话传 `undefined`**（不加块，保持英文提示词原样）。
- 抽取管道 `teachingLocaleFor()`：聊天来源读记录；导入笔记读当前设置；英文同样传 `undefined`。
- `src/server/chat-handler.ts`：把 `AgentBuildOptions.teachingLocale` 接到会话冻结值。

### 2.4 壳层与排版

- `electron/i18n.cjs`：CJS 版 locale 规则 + 读同一份 `messages/*.json`（asar 里已包含 `messages/**/*`）。
- `electron/main.cjs`：菜单自定义项走目录（role 项交给系统）；`lh:locale` IPC 实时重建菜单；启动失败对话框本地化；子进程环境带 `LH_OS_LOCALE`（有存在性兜底）。
- `electron/preload.cjs`：`window.lh.setLocale`。
- `app/globals.css` + `components/settings/appearance.tsx` + `components/mermaid-render.ts`：CJK 字体栈（PingFang SC / Microsoft YaHei / Noto Sans CJK SC；等宽加 Sarasa Mono SC / Noto Sans Mono CJK SC）。**不打包** Noto Sans SC。

### 2.5 必须保持的行为契约

1. **英文是源目录**：`en.json` 的值就是界面原文；改文案先改 en 再翻 zh。
2. **解析顺序**：用户明确选择 → 系统语言 → `en`。`zh`/`zh-CN`/`zh-Hans` → `zh-CN`；`zh-TW`/`zh-HK`/`zh-Hant` 在繁体目录出现前回退英文。
3. **会话冻结**：教学语言只在创建会话时写入；之后改设置只影响新会话，旧记录**不重写**。
4. **听写独立**：`DictationSettings.language` 与界面语言无关，互不覆盖。
5. **用户数据不翻译**：聊天记录、笔记、已有图谱命题保持原语言。
6. **系统提示保持英文底稿**：语言要求通过追加块注入，不能写进可覆盖的 markdown。
7. **无路由前缀**：语言是设置项，不是 URL。
8. **不改上游许可证与声明**：README 顶部声明与 AGPL-3.0 必须保留。

---

## 3. 第二轮范围

### 要做

- 全量审计**学习者可见文本**是否都走目录：JSX 文本、`aria-label`/`title`/`placeholder`、空状态、错误提示、对话框标题、toast/inline alert、按钮、tooltip。
- 补齐 `messages/en.json` 新键 → 翻译 `messages/zh-CN.json` → 更新术语表/保留表。
- 修掉第一轮遗留的行为问题（见 §5 的 B 类）。
- 扩充自动化：让"漏抽词条"能在提交流程里被发现（至少提供可复跑的扫描脚本；见 §4.A）。
- 更新受影响的测试（断言 testid/键，而不是英文句子）。
- 按区域小步提交（侧边栏 / 设置 / 会话 / 题目与练习 / 图谱 / 对话框 / 插件 / 壳层 / 卡片）。

### 不要做

- 不重写 i18n 架构，不改 `t()` 的语义，不引入新 i18n 库。
- 不把源码里的英文批量替换成中文。
- 不翻译 `docs/`、README（README 已有中英两份）、系统提示底稿、工具名、JSON 字段名、路径、代码、公式。
- 不翻译用户数据（同一会话中已有内容）。
- 不为语言加路由前缀，不为每门语言复制仓库。
- 不 push 到 upstream，不向上游开 PR。

---

## 4. 审计方法（按顺序执行，可复跑）

### A. 静态扫描：找"没过 `t()` 的可见英文"

`check:i18n` 只能发现"代码引用了不存在的键"，**看不见硬编码英文**。把下面脚本存为 `scripts/scan-ui-literals.mjs`，按需运行（无依赖）：

```js
import fs from "node:fs";
import path from "node:path";

// 列出给定 TSX 文件里可疑的可见英文字面量。
const files = process.argv.slice(2);
const ATTR = /\b(label|hint|title|placeholder|aria-label)="([^"]{2,})"/g;
const TEXT = />([A-Za-z][^<>{}]{2,}?)</g;
const LIT  = /\b([A-Za-z]*(?:[Ll]abel|title|Title|placeholder|description|Description|heading|body|hint|Hint|copy|Copy))\s*[:=]\s*"([^"]{2,})"/g;

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  console.log(`=== ${file}`);
  lines.forEach((line, i) => {
    const n = i + 1;
    for (const re of [ATTR, TEXT, LIT]) {
      for (const m of line.matchAll(re)) {
        const text = m[2] ?? m[1];
        if (!text || /^[A-Za-z]+\.[A-Za-z.]+$/.test(text)) continue; // 跳过键名/标识符
        console.log(`${n}: ${text}`);
      }
    }
  });
}
```

用法（Windows）：

```cmd
node scripts\scan-ui-literals.mjs components\settings\*.tsx
```

批量找候选（建议用 `findstr`/PowerShell 先生成文件清单，再喂给脚本）：

```cmd
dir /b /s components\*.tsx > "%TEMP%\tsx.txt"
```

**脚本盲区**（必须人工补看）：

- 模板字符串与变量拼接：`` aria-label={`${name} settings`} ``——应改为 `t("...", { name })`。
- 模块级常量/导出对象（如 `PLUGIN_TRUST_WARNING`、`updateStatusText()` 的返回值）。
- 纯函数返回的界面文案（`keyStatusLine`、`questionCardLabel`、`sideThreadPlaceholder`、`timeAgo`）——需要可选 `locale` 参数或调用方传 `t`。
- 服务端返回后原样显示的字符串（`body.error`、`detail.error`、作业/抽取失败原因）。
- `data-*`/testid/工具名：**不是界面文案，不要翻译**。

### B. 浏览器实测（真正的验收）

1. `npm run dev`，打开 <http://localhost:3000>。
2. 设置 → 通用：语言切到"简体中文"，教学语言两种都试；**不重启**确认即时生效。
3. 逐页对照下面的清单（每页都看：正文、按钮、占位符、空态、tooltip、错误、aria）：
   - 侧边栏：会话行、搜索、筛选、右键菜单、文件夹菜单、活动栏。
   - 主页：模式切换（Teach/Practice）、空态、图谱 chrome、链式表。
   - 新建会话：空态、输入框、模型 pill、零密钥/未配置 CTA。
   - 会话：头部（标题、计划 chip、阶段 chip）、侧边对话、输入框（发送/停止）、排队 steer、重试、错误条。
   - 题目栏 / 练习栏：选项、置信度、我不知道、提交、思路字段、占位符。
   - 图谱：搜索、显示设置面板全部滑杆、空态、会话列表、费用面板。
   - 设置：服务商（密钥行、状态行、自定义端点、订阅连接）、代理、外观、图谱、键盘、通用（语言/更新）、插件。
   - 对话框：删除会话/文件夹/节点/来源、中止回合、计划弹窗、启动消息、Mermaid 全屏。
   - 卡片：研究/PDF/演示/图像、任务卡、错误与下载/反转/全屏按钮。
   - 桌面版（可选）：原生菜单自定义项、启动失败对话框。
4. 中文下检查**溢出**：侧边栏会话行、设置行、题目栏、计划 chip。中文字形更宽，等宽区域尤其要看。

如果环境提供 browser-use / control-browser 技能，优先用截图辅助比对；否则手工记录"文件:行为"清单。

### C. SSR 断言（回归门槛）

```cmd
set LH_DATA_DIR=D:\tmp\lh-i18n-audit&& npm run dev
```

先写 `%LH_DATA_DIR%\data\settings.json`：

```json
{ "version": 1, "general": { "locale": "zh-CN", "teachingLocale": "follow" } }
```

然后请求首页，确认 `<html lang="zh-CN">` 且包含中文侧边栏词、不含英文原词。第一轮验证过这一路径；本轮把它固化成脚本或测试更好。

### D. 自动化检查

```cmd
npm run check:i18n
npx tsc --noEmit
npx eslint .
```

全量测试（`npm test` 的 `NODE_ENV=test` 前缀在 cmd 下无效）：

```cmd
cmd /c "set NODE_ENV=test&& npx tsx --test --test-timeout=90000 tests\*.test.ts tests\*.test.tsx"
```

当前基线：**5543 个测试，5466 通过，11 跳过，66 失败**。失败的 66 个全部是这台 Windows 机器的既有环境问题，**不要**试图修：

- POSIX 路径断言：`appearance-chrome`、`automatic-updates`、`desktop-platform`、`data-dir-seam`、`file-access-settings`
- `D:\` 路径的 `ERR_UNSUPPORTED_ESM_URL_SCHEME`：`verify-release`
- symlink `EPERM`：`source-access`、`learner-image-snapshots`、`plugin-host`、`plugin-install-local`、`core-plugins`、`core-plugin-build`、`plugin-task-records`、`plugin-authoring-bundle`、`plugin-*-types`
- `TMPDIR` 未定义：`session-identity`
- 子进程/网络超时：`custom-provider-restart`、`model-catalog`、`plugin-api-reference`、`safe-fetch-connector`、`subscription-auth`、`auth-store`、`chatgpt-auth`、`claude-code-stream`

**判定回归的方法**：与基线提交做 worktree 对比，而不是看绝对失败数。

```cmd
git worktree add ..\lh-baseline <baseline-commit>
cd /d "D:\AI\LearnHarness 源代码\lh-baseline"
mklink /J node_modules "D:\AI\LearnHarness 源代码\learnharness\node_modules"
:: 两边跑同一批文件，--test-reporter=tap，diff 掉 "not ok" 行
```

> ⚠️ 收尾时**先删除 junction**（`rmdir node_modules`）再 `git worktree remove`。直接 `remove --force` 会沿 junction 递归删掉主仓库的 `node_modules`（第一轮已经踩过，需重新 `npm install`）。

### E. 词条覆盖检查

```cmd
cmd /c "set LH_I18N_LIST_UNUSED=1&& node scripts\check-translations.mjs"
```

会列出"没有任何代码引用"的键。当前约 58 个，全部是**动态键族**（如 `shortcuts.action.<id>`、`settings.agent.slot.*`、`settings.appearance.colors.*` 通过映射表或模板拼接引用），**不是错误**。新增键若出现在该列表中且确实没人用，应删掉。

---

## 5. 已确认缺口（截至 2026-11-22，按字符串搜索；行号会漂移）

### A. 已修、未提交（先提交或并入本轮）

| 文件 | 内容 |
|---|---|
| `components/graph-view.tsx` | Chains 按钮 → `minimalHome.chainsButton`；图谱空态 → `minimalHome.emptyStart` / `emptyAttach` |

### B. 未修复（已核实存在；建议键名仅供参考）

| 位置 | 现值 | 建议 |
|---|---|---|
| `components/home.tsx:320` | `Teach` / `Practice`（主页模式切换） | 复用 `sidebar.teaching` / `sidebar.practice`，或新增 `home.modeTeach/modePractice`（产品决定；按钮用 `home-mode-teach` testid 稳定） |
| `components/attach-files-button.tsx:159,163,175` | `Attach files`、`Attach files or a folder` | `composer.attach`、`composer.attachOrFolder` |
| `components/composer.tsx:231` | `aria-label` 的 `Send` / `Stop` | `composer.send` / `composer.stop` |
| `components/settings/keys-section.tsx:156,340` | `not set`、`+ Add a provider`；状态行里的 ` · env` | `settings.keys.notSet`、`settings.keys.addProvider`、`settings.keys.envSuffix`；`keyStatusLine` 加可选 `locale`（参考 `timeAgo`） |
| `components/settings/subscription-connections.tsx:112,118,128,86` | `Disconnect`、`Continue`、`Connect`、`Manage…`、`${label} connection` | `settings.keys.subscription.*` |
| `components/settings/update-settings.tsx:17-19,49-53,92,101,107` | `MANUAL_UPDATE_HINT`、`AUTO_UPDATE_HINT`、`UPDATE_ERROR`、`updateStatusText()`、`Automatic updates`、`Release notes`、`Restart`、`Check for updates` 等 | `settings.update.*`；注意 `MANUAL_UPDATE_HINT` 是导出常量，可能被测试引用 |
| `components/artifacts/worker-result-presentation.tsx:9` | 默认 prop `view brief` / `hide brief` | `artifacts.viewBrief` / `artifacts.hideBrief`（默认值改为 `undefined` 后在渲染时取 `t()`） |
| `components/artifacts/job-card.tsx:57,95` | `PDF brief`、`Research brief` | `artifacts.pdfBrief` / `artifacts.researchBrief` |
| `components/artifacts/demo-card.tsx:109` | `Demo completed, but the result could not be displayed.` | `artifacts.demoUnavailable` |
| `components/artifacts/visual-card.tsx:80` | `Figure completed, but the result could not be displayed.` | `artifacts.figureUnavailable` |
| `app/layout.tsx:19-22` | `metadata.title/description` 英文，窗口/标签页标题 | 若要求本地化，改 `generateMetadata()` 读 `readLocaleBoot()`；品牌名保持 `Learning Harness` |

### C. 需要产品决策（先问，不要擅自改）

1. **服务端错误**：路由/管道返回的英文错误（`body.error`、`detail.error`、抽取/作业失败原因）目前在多处原样显示。方案：按 `code` 映射为本地化句子，原始 detail 作为次要信息保留；或统一"本地化前缀 + 原文"。
2. **听写语言名**：`DICTATION_LANGUAGES` 的 60+ 语言名保留英文（视为专名）。若要本地化，新增 `dictationLanguages.<code>`，搜索仍匹配 code/英文名；注意这是 60+ 词条的批量翻译。
3. **日期**：`timeAgo` 已本地化；`components/graph-view.tsx` 自己的 `timeAgo(startedAt)` 与 `newestCreatedAt.slice(0,10)` 仍是英文/ISO。是否统一为 `Intl.DateTimeFormat(locale)`？
4. **第三方插件文案**：宿主只本地化自己的 chrome；插件 UI 文本由插件提供。是否引入插件自带 `locales/<locale>.json` + 插件 API `t()`？
5. **`README`/`docs/`**：不在界面词条范围。README 已中英双语；`docs/` 保持英文。

### D. 尚未系统扫描（线索，不是结论）

`components/ai-elements/*`、`components/selection-toolbar.tsx`、`components/citation-*`、`components/session-navigation.tsx`、`components/tree-presentation.tsx`、`components/plugin-ui-host.tsx`、`components/plugin-renderers.tsx`、`components/settings/{model-menu,search-menu-list,theme-cards,prompt-text,prompt-segment-row,plugin-settings-rows}.tsx`、`components/notes-import.tsx` 的 notices/errors、`components/extraction-coverage.tsx` 之外的图谱面板细节、`components/md-blocks.tsx` 的复制按钮、`components/host-dialog.tsx` 的 `aria-label`。逐个跑 §4.A 的扫描 + 浏览器对照。

---

## 6. 修复规范

### 6.1 键与值

- 键：稳定、点分、按**区域**而不是按英文句子：`sidebar.newSession`、`settings.language`、`graph.empty`。
- `messages/en.json` 的值必须与**当前界面原文逐字一致**（包括弯引号、`—`、`·`、`⇧↵`）；这保证抽取阶段行为零变化。
- `zh-CN.json` 只改值；键、ICU 语法、占位符名、反引号代码、链接目标不动。
- 复数/数量用 ICU：`{count, plural, one {# item} other {# items}}`；中文通常只写 `{count} 个…`，但占位符集合必须与 en 一致。
- 拼接句子不要拼字符串；把整句放进目录，参数化变量。
- 新术语先写进 `i18n/glossary.zh-CN.json` 再翻译；允许中英相同（品牌、协议、扩展名）的键登记到 `i18n/preserve.json`。

### 6.2 API 选择

| 场景 | 用法 |
|---|---|
| React 组件 | `const t = useT();` → `t("area.key")` |
| 需要 `locale` 的地方 | `const { locale, t } = useI18n();` |
| 纯函数 / 非 React 模块 / 默认参数 | `translate(locale, key, params?)`，`locale` 默认 `"en"` |
| 有运行时英文兜底（键盘动作标签、服务端错误） | `translateOr(locale, key, fallback, params?)` |
| 需要在无 Provider 的渲染测试里工作 | 不用包 Provider；`useT` 会自动回退英文 |

### 6.3 三个坑（第一轮踩过）

1. **不要在测试里把组件当函数调用**（`renderToStaticMarkup(Card({...}))`）。组件一旦用 `useT()` 就会触发 "Invalid hook call"。改成 JSX：`renderToStaticMarkup(<Card ... />)`。
2. **`Toggle` 的 testid 由 label 派生**（`components/settings/controls.tsx`：`toggle-${label...}`）。翻译 label 会改变 zh 下的 testid；测试应断言稳定 testid（给 `Toggle` 传固定 `data-testid` 或在测试里用 role），不要依赖英文派生值。
3. **导出常量被测试引用**（如 `MANUAL_UPDATE_HINT`、`EXTRACTION_RETRY_LINE`、`SESSION_DELETE_COPY`）。改为键时保留原常量作为英文，或同步更新测试；不要让 `t()` 出现在模块顶层。

### 6.4 测试策略

- 现有组件渲染测试大多**不包 `I18nProvider`**，因此拿到英文回退——这正是第一轮能保留大量旧断言的原因。
- 新增/修改断言时优先用 `data-testid`、`role`、结构；确需断言文案时用英文默认值，或在测试里包 `I18nProvider` 断言中文。
- 涉及复数/数量：像 `plugin-worker-header` 那样逐字断言的地方，ICU 文案要精确（`1 page` vs `N pages`）。
- 每个修复跑：相关单测 → `check:i18n` → `tsc` → `eslint`；一批完成后再跑全量。

### 6.5 提交粒度

沿用第一轮风格，按区域小提交，例如：

```
i18n: localize the settings update rows
i18n: localize home mode switch and compose controls
i18n: localize artifact status and fallbacks
```

提交信息写清：新增键数、翻译范围、行为不变或变更点、测试更新。**一次提交只做一件事**，不要把"抽词条"和"翻译"混在一起（翻译单独提交，便于审阅）。

---

## 7. 验收标准（Definition of Done）

- [ ] `npm run check:i18n` 通过；en/zh 键集合一致；占位符集合一致；无空值；无未登记的整句英文。
- [ ] `npx tsc --noEmit` 零错误；`npx eslint .` 0 error（允许既有 warning）。
- [ ] 全量测试与基线对比：**失败集合不新增**（不要试图消灭 66 个环境失败）。
- [ ] 浏览器实测：中文下逐页无可见英文（除保留表/专名/代码/用户数据），切换语言无需重启。
- [ ] 中文排版无溢出：侧边栏会话行、设置行、题目栏、计划 chip。
- [ ] 旧会话不被改写：英文会话切中文后打开仍是英文；新会话用新语言。
- [ ] 桌面版菜单：自定义项随语言切换（role 项由系统本地化）。
- [ ] `README.md` / `README.zh-CN.md` 的声明与上游链接仍在；`LICENSE` 未改。
- [ ] 工作区干净，提交已推到 `origin`（不推 upstream）。

---

## 8. 环境陷阱（Windows 专有，逐条）

1. **shell 是 cmd**：没有 `ls`/`grep`/`head`/`tail`；用 `dir`、`findstr`、PowerShell。
2. **`npm test` 不可直接跑**：`NODE_ENV=test` 前缀在 cmd 无效；用 `cmd /c "set NODE_ENV=test&& npx tsx --test ..."`。
3. **首次运行前必须 `npm run plugins:setup`**，否则 `npm run dev` 在 `coding-questions` 构建处失败（缺 `@codemirror/*`）。已执行过；`npm install` 丢依赖后需重跑。
4. **严禁用 PowerShell `Set-Content` 写源码**（默认 ANSI/GBK，会破坏 `—`、`→` 等 UTF-8 字符，导致 Turbopack 报 `invalid utf-8 sequence`、全站 500）。用 Edit/Write 工具或 Node 的 `fs.writeFileSync(path, text, "utf8")`。
5. **CRLF**：`core.autocrlf=true`，检出文件是 CRLF。Node 批量替换脚本必须先 `s.replace(/\r\n/g, "\n")`，否则多行 needle 永远匹配不到。
6. **`node -e "…"` 在 cmd 下会被引号搞坏**：把脚本写成 `.mjs` 再 `node 脚本.mjs`。
7. **npm 11 安装门禁**：`npm ci` 会跳过 electron 的 postinstall（`allowScripts`），`node_modules/electron/dist/electron.exe` 缺失；已通过 `allowScripts` 解决（见 §1 未提交项）。
8. **worktree 对比法**：junction `node_modules` 后，收尾必须先 `rmdir node_modules` 再 `git worktree remove`，否则会删空主仓库依赖。
9. **`gh` 权限/代理**：见 §1；推送 `.github/workflows/*` 需要 `workflow` scope。
10. **测试临时目录**：测试在 `%TEMP%\lh-*` 写大量 scratch；收尾可清理。`data/` 是运行时数据，用户要求用完删除（但注意 `%APPDATA%\LearnHarness` 是用户真实安装的数据，**不要**当测试数据删）。

---

## 9. 附录

### 9.1 术语表（完整版见 `i18n/glossary.zh-CN.json`）

| en | zh | 备注 |
|---|---|---|
| session | 会话 | |
| teaching session | 教学会话 | |
| practice | 练习 | |
| knowledge graph / graph | 知识图谱 / 图谱 | |
| node | 节点 | |
| proposition | 命题 | |
| reasoning chain / chain | 推理链 | 不译"链条" |
| dictation | 听写 | 独立设置 |
| provider | 服务商 | |
| key / API key | 密钥 / API 密钥 | |
| steer | 引导 | 回合中追加消息 |
| turn | 回合 | |
| compaction | 上下文压缩 | |
| extraction | 知识抽取 | |
| chunk budget | 分块预算 | |
| notes | 笔记 | |
| source | 来源 | |
| graph traces | 图谱痕迹 | |
| confidence | 置信度 | |
| side conversation | 侧边对话 | |
| plan | 计划 | |
| probing / planning / teaching | 摸底 / 规划 / 授课 | |
| strong / cheap / vision | 强力 / 经济 / 视觉 | 模型档位 |

文风：短、直接；设置项用名词或动词短语；不用敬语；按钮不加句号；中英文之间留半角空格（`API 密钥`、`1 个会话`）。

### 9.2 关键键族

`common.*`、`time.*`、`sidebar.*`、`settings.{nav,agent,appearance,graph,keys,plugins,general}.*`、`question.*`、`practice.*`、`chat.*`、`newSession.*`、`graph.*`、`plan.*`、`sideThread.*`、`dictation.*`、`dictationLanguage.*`、`coverage.*`、`activity.*`、`stats.*`、`chainTable.*`、`sessionFind.*`、`keyboard.*`、`shortcuts.*`、`setup.*`、`artifacts.*`、`pluginChrome.*`、`menu.*`、`dialogs.*`、`updateBanner.*`、`minimalHome.*`、`overlay.*`、`sourceTree.*`、`delete.*`、`deleteNode.*`、`deleteSource.*`、`notesImport.*`、`modelPicker.*`、`reading.*`、`startupMessage.*`

### 9.3 新增一门语言

1. `cp messages/en.json messages/<locale>.json`，只翻译值。
2. `src/core/locales.ts` 的 `APP_LOCALES` 加 id；`src/i18n/index.ts` 的 `CATALOGS`/`CATALOG_LOCALES` 登记。
3. `src/core/locales.ts` 的 `mapSystemLocale` 加系统标签映射；`LEARNER_LANGUAGE_NAME` 加语言名（教学指令用）。
4. `i18n/glossary.<locale>.json`；必要时更新 `i18n/preserve.json`。
5. 跑 `npm run check:i18n`。
6. 字体：若目标文字需要额外回退，更新 `app/globals.css` 与 `appearanceVars` 的字体栈（不打包字体文件）。

### 9.4 相关测试

- `tests/i18n.test.ts`（目录查找、ICU、回退、`translateOr`）
- `tests/teaching-language.test.ts`（指令块位置、工具名英文、冻结）
- `tests/session-language-stamp.test.ts`（createChat 冻结）
- `tests/render-sidebar.test.tsx`、`render-settings.test.tsx`、`render-new-session.test.tsx`、`render-phase-divider.test.tsx`、`render-activity-dock.test.tsx`、`render-update-banner.test.tsx`、`render-side-thread*`、`render-plan-block.test.tsx`、`plugin-question-components.test.tsx`、`plugin-worker-header.test.tsx`、`research-sources.test.tsx`、`reading-font-css.test.ts`、`settings-pure.test.ts`、`desktop-platform.test.ts`（preload 接口清单）、`file-path-preload.test.ts`（同上）

### 9.5 项目记忆（`.zcode` 记忆目录，跨会话）

- `windows-text-edit-hazards` — ANSI 写入与 CRLF 的坑
- `repo-layout-and-baseline-tests` — 远端、环境失败清单、baseline 对比法、代理/权限
- `windows-electron-build-gotchas` — npm 11 + electron postinstall、`dist/win-unpacked` 验证路径
- `i18n-check-blind-spots` — `check:i18n` 的盲区与本轮缺口清单

---

**交接结束。** 开工顺序建议：先决定 §1 的 3 个未提交改动 → 跑一遍 §4.A 扫描生成候选清单 → 按 §5 的 B 类逐项修（每项一个提交）→ 处理 C 类前先问用户 → 最后按 §7 验收。
