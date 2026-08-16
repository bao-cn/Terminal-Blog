# Contributing to Terminal Blog

[中文](#中文贡献指南) | [English](#english-contribution-guide)

## 中文贡献指南

感谢参与 Terminal Blog。项目接受 Bug 修复、命令扩展、终端交互改进、性能优化、测试、文档和国际化贡献。

### 1. 提交 Issue 前

- 搜索现有 Issue 和 Pull Request，避免重复工作。
- Bug 应确认可以在最新默认分支复现。
- 功能建议需要说明它如何映射到终端命令、文件模型或访客工作流。
- 安全漏洞不要公开披露利用细节、密码、token 或真实数据，请使用 GitHub Security 页面中的 Private vulnerability reporting。

### 2. 准备开发环境

```bash
git clone <your-fork-url>
cd terminal_blog
npm install
npm test
npm run lint
```

项目要求 Node.js 24 或更高版本。开发服务器运行在：

```bash
npm run dev
```

访问 <http://localhost:3000>。

### 3. 创建分支

从最新默认分支创建短生命周期分支：

```text
feat/<topic>       新功能或命令
fix/<topic>        Bug 修复
refactor/<topic>   不改变预期行为的重构
docs/<topic>       文档或示例
test/<topic>       测试改进
chore/<topic>      工具链和维护工作
```

一个分支只解决一个明确问题。不要混入无关格式化、依赖升级或大范围重命名。

版本发布遵循以下顺序：

1. 功能、修复和改进分别通过短生命周期分支合入 `main`，确保 `main` 始终包含最新的可发布代码。
2. 准备发布时，从最新 `main` 创建 `release/<version>` 分支，例如 `release/0.1.0-beta.1`。
3. 发布分支只接受版本号、CHANGELOG、发布说明和必要的发布修复。通用代码修复必须先同步到 `main`，再合入发布分支。
4. 每个版本都要更新 `CHANGELOG.md`，版本号遵循 Semantic Versioning；预发布版本使用 `-alpha.N`、`-beta.N` 或 `-rc.N`。
5. 在 GitHub Actions 中手动运行 `Release` 工作流，并在分支选择器中选择对应的 `release/<version>`。工作流会拒绝从 `main`、特性分支或版本号不匹配的分支发布。
6. 可在 `related_issues` 输入框填写 `#12, #34` 等 Issue 编号。版本 Changelog 会完整保留，GitHub 自动生成的 Pull Request 和贡献者信息会追加到发布说明。
7. 工作流通过 Prettier、ESLint、TypeScript、Vitest 和生产构建后，创建 `v<version>` 标签和 GitHub pre-release，并上传源码 ZIP、Linux x64 standalone 包和 SHA-256 校验文件。
8. 发布失败后的通用修复仍应先提交到 `main`，再同步到版本分支并重新运行工作流。已经存在的版本标签不会被覆盖。

### 4. 架构约束

- React 组件负责视图和交互协调，不应直接实现可独立测试的解析、认证或持久化算法。
- 新命令必须注册到 `lib/command-registry.ts`，以便帮助、参数提示和补全自动生效。
- 纯命令解析和管道处理放在 `lib/terminal-command-parser.ts`、`lib/terminal-text-pipeline.ts` 或新的高内聚模块。
- Route Handler 必须使用 `lib/request-security.ts` 和 Zod Schema，不直接调用无上限的 `request.json()` 或 `request.formData()`。
- 文章正文继续以 Markdown 文件为权威来源，SQLite 只存 metadata 和系统状态。
- 文件修改使用原子写入，不先删除旧文件再写新文件。
- 不要把终端输出包装成装饰性卡片。除 Markdown `cat render` 外，命令输出应保持纯文本终端语义。
- 新增 UI 必须兼容深浅主题、中英文、键盘操作、Drawer 展开状态和虚拟滚动。

### 5. 不应提交的内容

以下内容已被 `.gitignore` 排除：

```text
articles/
draft/
data/
.env*
AGENTS.md
CLAUDE.md
.codex/
.claude/
```

不要在测试、Issue、截图或日志中提交真实密码、session token、邮箱、IP 或生产文章。

### 6. 测试要求

提交前运行：

```bash
npx prettier --check .
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

根据修改范围补充测试：

- 命令：注册、参数数量、别名、补全、管道和错误输出。
- 认证：过期、撤销、密码版本、限流和 Cookie 行为。
- API：Origin、Content-Type、请求大小、Schema 和授权状态。
- 文件：路径穿越、冲突、原子写入和索引同步。
- UI：输入光标、备用屏幕恢复、虚拟列表和 Drawer 布局。

可视修改需要在至少一个桌面和一个移动视口验证，并在 Pull Request 中附截图或录屏。

### 7. Commit 规范

推荐使用 Conventional Commits：

```text
feat(commands): add wc command
fix(auth): revoke sessions after password change
refactor(storage): share atomic file writer
docs(readme): document font sharding
test(pipeline): cover quoted pipe characters
```

Commit 应描述原因和结果，不使用 `update`、`fix stuff` 等无法追踪的消息。

### 8. Pull Request

Pull Request 应包含：

- 问题背景与目标。
- 关键设计决策及被放弃的方案。
- 行为变化和兼容性影响。
- 安全、数据迁移或性能风险。
- 实际运行的测试命令和结果。
- UI 变化截图或录屏。
- 相关 Issue，例如 `Closes #123`。

请保持 PR 可评审。大型架构修改应先提交设计 Issue，再拆成可以独立验证的阶段。

### 9. 评审与合并

- 回应所有评审问题，无法采纳时说明技术原因。
- 评审期间使用新增提交修复问题；除非维护者要求，不要强制重写公共历史。
- 合并前必须通过 CI，解决所有阻塞讨论，并更新受影响文档。
- 合并方式由维护者根据提交历史选择 squash、rebase 或 merge。

## English Contribution Guide

Terminal Blog accepts bug fixes, command extensions, terminal interaction improvements, performance work, tests, documentation, and localization contributions.

### 1. Before opening an Issue

- Search existing Issues and Pull Requests.
- Confirm bugs against the latest default branch.
- Feature proposals should explain how the behavior maps to terminal commands, the filesystem model, or a visitor workflow.
- Never disclose exploit details, credentials, tokens, or real data in a public Issue. Use GitHub Private vulnerability reporting from the Security page.

### 2. Development setup

```bash
git clone <your-fork-url>
cd terminal_blog
npm install
npm test
npm run lint
npm run dev
```

Node.js 24 or newer is required. The development server is available at <http://localhost:3000>.

### 3. Branches

Create a short-lived branch from the latest default branch:

```text
feat/<topic>       Features and commands
fix/<topic>        Bug fixes
refactor/<topic>   Refactoring without intended behavior changes
docs/<topic>       Documentation and examples
test/<topic>       Test improvements
chore/<topic>      Tooling and maintenance
```

Keep each branch focused on one problem. Avoid unrelated formatting, dependency upgrades, or broad renames.

Use this order for releases:

1. Merge feature, fix, and improvement branches into `main` so it remains the source of the latest releasable code.
2. When preparing a release, create `release/<version>` from the latest `main`, for example `release/0.1.0-beta.1`.
3. Release branches accept only version metadata, CHANGELOG updates, release notes, and necessary release fixes. General code fixes must land in `main` first and then be synchronized to the release branch.
4. Update `CHANGELOG.md` for every release. Versions follow Semantic Versioning, with `-alpha.N`, `-beta.N`, or `-rc.N` suffixes for prereleases.
5. Manually run the `Release` workflow in GitHub Actions and choose the matching `release/<version>` in the branch selector. The workflow rejects `main`, feature branches, and release branches whose name does not match `package.json`.
6. Optionally enter issue numbers such as `#12, #34` in `related_issues`. The version's Changelog is preserved, and GitHub-generated Pull Request and contributor details are appended to the release notes.
7. After Prettier, ESLint, TypeScript, Vitest, and the production build pass, the workflow creates the `v<version>` tag and GitHub pre-release, then uploads a source ZIP, Linux x64 standalone bundle, and SHA-256 checksums.
8. General fixes for a failed release still land in `main` first and are then synchronized to the release branch before rerunning the workflow. Existing version tags are never overwritten.

### 4. Architecture rules

- React components coordinate view state; independently testable parsing, authentication, and persistence logic belongs in `lib/`.
- Register every new command in `lib/command-registry.ts` so help, completion, and argument hints stay automatic.
- Put pure command and pipeline logic in focused modules such as `terminal-command-parser.ts` and `terminal-text-pipeline.ts`.
- Route Handlers must use the bounded request readers, same-origin policy, and Zod schemas. Do not introduce unrestricted `request.json()` or `request.formData()` calls.
- Markdown remains the source of truth for article bodies. SQLite stores metadata and system state.
- Use atomic file updates and preserve the previous file on failure.
- Keep command output terminal-native. Do not add decorative output cards except for rendered Markdown content.
- UI changes must work in both themes and languages, with keyboard input, the Drawer, and virtual scrolling.

### 5. Files that must not be committed

Do not commit local articles, drafts, databases, environment files, Agent instructions, credentials, session tokens, private logs, or real production data.

### 6. Required checks

```bash
npx prettier --check .
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

Add tests proportional to the change. Commands need registry and pipeline coverage; authentication needs expiration and revocation coverage; APIs need origin, size, schema, and authorization coverage; file changes need traversal, conflict, atomic-write, and index synchronization coverage.

Visual changes must be checked at desktop and mobile sizes and documented with screenshots or recordings.

### 7. Commits

Conventional Commits are preferred:

```text
feat(commands): add wc command
fix(auth): revoke sessions after password change
refactor(storage): share atomic file writer
docs(readme): document font sharding
test(pipeline): cover quoted pipe characters
```

### 8. Pull Requests

Describe the problem, design, behavior changes, compatibility, risk, verification, screenshots, and related Issues. Keep Pull Requests reviewable. Propose large architectural work in an Issue first and split it into independently verifiable stages.

### 9. Review and merge

Respond to review feedback with either a change or a technical explanation. Add commits during review unless a maintainer requests a history rewrite. CI must pass, blocking discussions must be resolved, and affected documentation must be updated before merge.
