# interview-sprint

English | [简体中文](README.zh-CN.md)

A technical-interview prep skill that works the same way in **Claude Code**, **Codex**, and **pi**.

Give your agent an interview topic, for example "design a real-time billing system", "walk through a Go channel use case", or "describe a SQL tuning you did". The agent then:

1. Proposes a course outline in the chat that **highlights what matters**. Secondary lessons are marked *optional*, and the last lesson is always the **interview pitch**. Nothing is written to disk until you confirm.
2. Teaches lesson by lesson in **short segments**, pausing after each one so you can interrupt. It asks interview questions along the way and lets you try an answer first.
3. Keeps an **offline HTML course page** for every topic. The left side shows course progress. The right side shows the system, code, or troubleshooting timeline *growing* lesson by lesson. The page refreshes itself whenever the agent updates the data.
4. Stores progress only in the topic's `course-data.js`, so you can continue in a new session or in another tool.

Experience-type topics such as "tell me about a SQL tuning you did" use a **demo case** made up by the agent. Both the chat and the page remind you to replace it with your own experience.

The skill's instructions (`SKILL.md`) and the generated course pages are written in Chinese, and the agent follows the language you use.

## Install

### Recommended: git-managed install

```bash
git clone https://github.com/jianjustin/interview_sprint.git ~/.local/share/interview-sprint
~/.local/share/interview-sprint/install.sh
```

Update later with:

```bash
~/.local/share/interview-sprint/install.sh --update
```

`--update` runs `git pull --ff-only` and re-links. It refuses to run if the clone has uncommitted changes. With SSH access you can clone `git@github.com:jianjustin/interview_sprint.git` instead.

If you already have a checkout somewhere else, `./install.sh --git` does the same thing from there. It clones (or pulls) a managed copy into `~/.local/share/interview-sprint`, or the directory you pass as `./install.sh --git DIR`, and points every skill directory at that copy. Use `--repo URL` to clone from a different remote.

### Where it is linked

The skill package is the `interview-sprint/` folder inside the repository. Each tool expects `<skills dir>/interview-sprint/SKILL.md`, so the installer keeps **one** git clone and links each tool's skill directory to the package inside it:

| Location | Used by |
|---|---|
| `~/.claude/skills/interview-sprint` | Claude Code desktop app |
| `~/.claude-ccswitch/skills/interview-sprint` | `claude` in the terminal when it runs with `CLAUDE_CONFIG_DIR=~/.claude-ccswitch` |
| `~/.agents/skills/interview-sprint` | Codex (0.164.0 reads `~/.agents/skills`, verified with `codex debug prompt-input`) and pi (1.5.0 supports `~/.agents/skills`) |

- Running the installer again is safe. If a target already exists as a real directory, not a symlink, the installer stops and changes nothing.
- When `CLAUDE_CONFIG_DIR` is set, the skill is also linked into `$CLAUDE_CONFIG_DIR/skills/`. `--claude-dir DIR` replaces the default Claude directories, and `--add-claude-dir DIR` adds one more.
- `--dry-run` previews the changes. `--uninstall` removes only the symlinks that point to this copy.
- Restart running agent sessions to pick up a newly installed skill.

### Developing the skill

Run `./install.sh` with no flags in your working copy. The skill directories then link straight to it, so your edits take effect immediately.

## Usage

| Tool | Start a topic | Continue |
|---|---|---|
| Claude Code | `/interview-sprint design a real-time billing system` | `/interview-sprint`, then pick a topic |
| Codex | `$interview-sprint design a real-time billing system` | `$interview-sprint`, then pick a topic |
| pi | `/skill:interview-sprint design a real-time billing system` | `/skill:interview-sprint`, then pick a topic |

Plain language works too. The skill description matches phrases such as "I want to prepare for an interview on X", "continue my billing-system course", and their Chinese equivalents.

Course files live under `.interview_points/` in the directory where you start the agent:

```text
.interview_points/
├── index.html            # overview of all topics (double-click to open)
├── index-data.js
└── realtime-billing/
    ├── course.html       # the course page (double-click to open, works offline)
    └── course-data.js    # course content and progress; the only file the agent edits
```

The course page includes:

- a lesson timeline with done / in progress / not started / skipped states;
- a growth panel: architecture diagram, code evolution, or troubleshooting timeline;
- "new in this lesson" highlights and lesson cards;
- previous / next buttons, the ← → keys, and a "play growth" replay;
- auto-refresh every 2.5 seconds;
- readable data-error messages instead of a blank page;
- light and dark themes, and a single-column layout on narrow screens.

**Template upgrades:** the agent copies `course.html` and `index.html` once and never edits them. After you update the skill, copy the new files from `interview-sprint/assets/` into existing topic folders if you want the new template. The data format carries a `version` field.

## Repository layout

```text
interview_sprint/                 # development repository
├── interview-sprint/             # the skill package (the only folder that gets linked)
│   ├── SKILL.md
│   ├── assets/course.html        # course page renderer, all CSS/JS inlined, no external resources
│   ├── assets/index.html         # overview page template
│   ├── references/               # data-format / outline-patterns / lesson-guide
│   └── scripts/validate.mjs      # optional: validate a course-data.js with node
├── examples/                     # three sample topics: realtime-billing, go-channel, sql-tuning
├── tests/                        # automated checks, end-to-end checklist, C9 hash script
├── docs/                         # design spec, interaction mockup, implementation plan
├── install.sh
├── README.md                     # this file
└── README.zh-CN.md               # Chinese version
```

Open `examples/*/course.html` or `examples/index.html` in a browser to see the three sample topics.

## Development and tests

```bash
bash tests/run-all.sh
```

This runs, in order:

- **Sync**: copies the current templates into `examples/`.
- **Unit tests**: `node --test tests/unit`. They extract `<script id="course-core">` (pure logic) from `course.html` and run it in Node. They cover:
  - grid layout, `since` / `until`, group growth, and route numbers;
  - line diff and metric bar ratios;
  - data validation;
  - the skill frontmatter and both READMEs.
- **Browser tests**: `node --test tests/e2e`, one file at a time. Your local Chrome (or Playwright's bundled Chromium) opens the examples over `file://` and checks B1–B10:
  - zero network requests;
  - architecture growth, code-diff highlighting, and timeline bar ratios;
  - every card type, HTML escaping, and the HTML-card sanitizer;
  - auto-refresh and error display;
  - keyboard and replay controls;
  - light/dark contrast and narrow screens;
  - the overview page.

  Screenshots are written to `tests/artifacts/`.
- **Installer tests**: `tests/install.test.sh`, run in a temporary HOME, including git install and update against a local repository.
- **C9 self-test**: checks the C9 hash script.

The browser tests need `playwright-core`. The tests look for it in local dependencies, in `$PLAYWRIGHT_CORE_PATH`, and in the copy bundled with a global `@playwright/mcp`. If none is found, the browser tests are skipped with a reason, and `run-all.sh` reports the run as failed so the result is not mistaken for a pass.

The manual end-to-end checklist (start a topic → lessons → continue in another tool) is in [tests/e2e-checklist.md](tests/e2e-checklist.md), written in Chinese. To verify C9:

```bash
bash tests/c9-hash-check.sh <directory where you started the agent>
```
