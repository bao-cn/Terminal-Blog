## Summary

Describe the outcome of this Pull Request in a few sentences.

## Motivation

Explain the problem, user workflow, or maintenance need. Link the relevant Issue with `Closes #123` where applicable.

## Implementation

Describe the important design decisions, affected commands or layers, and alternatives that were rejected.

## Behavior and compatibility

Document changes to command syntax, output, permissions, files, SQLite data, APIs, configuration, localization, themes, or keyboard behavior. Write `None` when there is no compatibility impact.

## Risk

Describe security, data migration, performance, accessibility, rollback, or deployment risks and how they are controlled.

## Verification

List the exact commands and manual workflows you ran, including their results.

```text
npx prettier --check .
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

## Screenshots or recordings

Required for visible terminal, Markdown, Drawer, cursor, selection, scrolling, theme, or responsive changes. Remove this section when it does not apply.

## Checklist

- [ ] I read and followed [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] The change is focused and does not include unrelated formatting, dependency, or generated-file churn.
- [ ] New or changed commands use the central command registry so help, argument hints, and completion stay synchronized.
- [ ] Public API inputs have bounded runtime validation and appropriate authorization checks.
- [ ] Filesystem changes preserve path boundaries, conflict handling, atomic writes, and metadata index consistency.
- [ ] I added or updated tests proportional to the behavior and risk.
- [ ] I ran Prettier, ESLint, TypeScript, Vitest, and the production build locally.
- [ ] I tested relevant terminal workflows with keyboard input and both guest/root permissions.
- [ ] I checked visible changes in light and dark themes, both supported languages, and relevant desktop/mobile viewports.
- [ ] I updated README, help output, configuration examples, or migration notes where necessary.
- [ ] This Pull Request contains no passwords, tokens, private articles, databases, environment files, Agent instructions, or production data.
