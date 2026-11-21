<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lh_banner_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/lh_banner_light.png">
    <img src="docs/assets/lh_banner_light.png" alt="LearnHarness" width="640">
  </picture>
</p>

<p align="center"><strong>An agent harness for learning.</strong></p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
</p>

> **This is the Simplified Chinese translation edition of LearnHarness.**
> The original project is **[amosblomqvist/learnharness](https://github.com/amosblomqvist/learnharness)**.
> This repository adds a multilingual interface layer and a Simplified Chinese catalog. It is
> maintained independently and is not affiliated with or endorsed by the original author.
> It keeps the original license, [AGPL-3.0](LICENSE).

LearnHarness uses AI agents to plan and teach lessons from your current understanding to your goal. It builds a detailed picture of what you understand and how you reason. That picture is updated as you learn.

Instead of just giving you an explanation, it uses your answers and thinking to decide what you need next. Teaching builds understanding one reasoning step at a time. Practice makes it usable. A persistent knowledge graph carries it across sessions.

![LearnHarness teaching session](docs/assets/teaching-session.png)

## Multilingual support (added in this edition)

The app now has a real interface-language layer instead of hard-coded English. English remains the default and the source of truth for the message catalog; **Simplified Chinese (简体中文)** ships as the first complete translation.

- **Switch it in the app:** Settings → General → **Language** (interface) and **Teaching language**.
- **Defaults:** Language follows the operating system. Teaching language follows the interface.
- **Mapping:** `zh`, `zh-CN`, and `zh-Hans` resolve to Simplified Chinese. Traditional-Chinese tags (`zh-TW`, `zh-HK`, `zh-Hant`) fall back to English until a Traditional catalog exists, so no one is shown the wrong script.
- **No restart:** switching the interface language re-renders immediately. In the desktop app the native menu's custom items are rebuilt on the spot; role items such as Undo or Copy are localized by the operating system itself.
- **Teaching language is frozen per session.** Each session records the language in force when it was created. Changing the setting later affects new sessions only — one conversation never mixes languages, and existing records are never rewritten.
- **Dictation stays separate.** Dictation language is its own setting under Settings → Providers and is never derived from the interface language.
- **User data is never translated.** Chat history, notes, and existing knowledge-graph propositions keep the language they were written in.
- **System prompts stay English.** The teaching doctrine is English by design (overrides are stored on English paths). A fixed `## Learner language` block is appended at run time to tell the model which language to write learner-facing output in — including for the researcher, demo-builder, visual-maker, PDF-reader, extractor, and auditor sub-agents.

### What is translated

| Layer | Status |
|---|---|
| Interface (sidebar, chat, questions, practice, graph, settings, dialogs, artifact cards, plugin chrome) | ✅ Simplified Chinese |
| Native menu and startup-failure dialog (desktop) | ✅ Simplified Chinese |
| Message catalog, glossary, preserve list | ✅ `messages/`, `i18n/` |
| Teaching output | ✅ via the learner-language block (per session) |
| Dictation language names | English language names (treated as proper nouns) |
| `README` / `docs/` | Upstream English docs; this README has a Chinese pair |

### Adding another language

1. Copy `messages/en.json` to `messages/<locale>.json` and translate the values only — keys, ICU placeholders, code spans, and link targets stay untouched.
2. Add the locale id to `APP_LOCALES` in `src/core/locales.ts` (and to `CATALOG_LOCALES` in `src/i18n/index.ts`).
3. Record terminology in `i18n/glossary.<locale>.json`; list intentional English words (brands, protocols, file extensions) in `i18n/preserve.json`.
4. Run `npm run check:i18n` — it verifies key parity, placeholder parity, empty values, untranslated sentences, and that every key referenced from source exists.

No route prefixes and no duplicated repository: a language is one catalog file plus a glossary entry.

## How it works

1. **Measure.** Before teaching, the agent finds where your understanding ends on each part the lesson depends on. Your answers, confidence, and thinking show it where to start.
2. **Plan.** It works out a dependency map from that starting point to your goal. You can see the plan, and the lesson adapts when your understanding turns out different.
3. **Teach.** Each step builds on something you already understand. You predict, get an explanation, and check your understanding. Confusions are repaired before anything is built on them. The aim is for the goal to feel obviously true, not merely familiar.
4. **Practice.** Separate sessions pose varied problems that require the right knowledge to come to mind without being named first. Problems and hints adapt to your reasoning.

**Think out loud.** The thinking fields let you explain your reasoning, uncertainties, and reactions in your own words. This is how the agent gets a detailed picture rather than just a record of right and wrong answers. You can type or use dictation.

**Bring your files.** In the desktop app, attach PDFs, photos, or any other file with the paperclip, or drag them in. The file stays where it is: the message carries its path, and the agent reads it from there.

The agent can also research questions in the background, create visual explanations, show your own images in the lesson and mark them up with arrows and labels (including figures it crops straight out of your PDFs, such as lecture slides), and build interactive demonstrations.

## Knowledge that carries forward

What you are taught accumulates as propositions and reasoning chains: individual claims and the premises that lead to them. The graph shows this structure, with links back to the source sessions. You can also import notes.

Future teaching sessions can read the graph instead of starting from scratch. Practice sessions can draw their material from it. It stores the ideas and their connections, not ratings of your ability.

![LearnHarness knowledge graph](docs/assets/knowledge-graph.png)

## Download and get started

**[Download from learnharness.ai](https://learnharness.ai)** — [GitHub Releases](https://github.com/amosblomqvist/learnharness/releases)

Those downloads are the **original project's** builds and are in English. This translation edition is built from source (see below); no prebuilt binaries are published in this repository.

- **macOS (Apple Silicon):** signed and notarized DMG. Drag the app to Applications.
- **Windows (x64):** run the installer. It is currently unsigned; Windows may show an “unknown publisher” or SmartScreen warning.
- **Linux (x64):** make the AppImage executable and open it, or install the Debian/Ubuntu `.deb`.

Choose your models, then start a session with what you want to understand. You can use provider API keys, supported subscription connections in the desktop app, an installed [Claude Code CLI](docs/claude-code.md), or a [custom OpenAI-compatible endpoint](docs/custom-providers.md), including a local model server. Optional dictation and web search use separate service keys. Web research can use a Tavily, Brave, Exa, Firecrawl, or Ollama key in Settings → Providers → Search. Ollama search uses its hosted service, not a local model server.

See [Getting started](docs/getting-started.md) for model setup, dictation, files, and notes imports, and [context, caching, and costs](docs/compaction-accounting.md) for advanced cache preferences.

All three platforms support in-app updates.

## Your keys, your data

- **Your keys and models.** No LearnHarness subscription or markup. Billing depends on your provider, CLI configuration, subscription, or local setup. The live cost meter estimates known API costs, not subscription, CLI, or custom-endpoint charges.
- **Local storage.** Your chats, graph, settings, and API keys live on your machine. Learning records are plain files you can inspect.
- **External services.** Models run through your configured providers. Model requests send the context needed for the task; web research and dictation also contact external services. Local storage does not mean offline processing.
- **Inspectable behavior.** System prompts are visible and editable. The app is open source under the AGPL-3.0 license.

## Development and support

```bash
npm ci
npm run plugins:setup
npm run dev        # http://localhost:3000
npm test           # translation check + fixtures and fake providers
npm run check:i18n # catalog checks only
```

On Windows, the `NODE_ENV=test` prefix in `npm test` does not work in `cmd`; use:

```cmd
cmd /c "set NODE_ENV=test&& npx tsx --test --test-timeout=90000 tests\*.test.ts tests\*.test.tsx"
```

Configuration lives in `data/settings.json` (or `LH_DATA_DIR`): `general.locale` is the interface language (`"system"` or a catalog id), and `general.teachingLocale` is the teaching language (`"follow"` or a catalog id).

See the [documentation index](docs/README.md) for all guides, [development](docs/development.md) for setup and checks, [architecture](docs/architecture.md) for the runtime, [keyboard shortcuts](docs/keyboard.md), [themes](docs/themes.md) for the theme file format, and [desktop builds and releases](docs/desktop-release.md).

For trusted local plugins, start with the [authoring guide and capability map](docs/plugin-authoring.md). It links the question, practice-problem, submission, view-context and UI contracts. Use [`examples/plugins/`](examples/plugins/) for small runnable templates, [`plugins/`](plugins/) for feature source projects, and the [host architecture](docs/plugin-architecture.md) for internals.

Questions, bug reports, and feature requests about this **translation edition**: open an issue in this repository.

Upstream questions and bug reports: [amosblomqvist/learnharness issues](https://github.com/amosblomqvist/learnharness/issues).

Security vulnerabilities: report privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## License

[AGPL-3.0](LICENSE) — retained from the original project, as the license requires.

The app is free and open forever. If the upstream project ever charges for anything, it will be for convenience — managed keys, hosting — never for features you can run locally.
