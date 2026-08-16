# Changelog

All notable changes to Terminal Blog are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.1] - 2026-08-16

### Added

- Initial terminal-first blog workspace with article browsing, editing, drafts, uploads, authentication, configuration, and command pipelines.
- Bilingual interface, theme persistence, virtual scrollback, and responsive file drawer.
- Production Docker image and Compose deployment with persistent content and database volumes.
- Short `config` virtual path for editing site configuration from the terminal.
- Configurable first-visit cookie and local-storage consent prompt with persistent `y`, `n`, and `Ctrl+C` handling.
- Live title-template updates for opened articles, with the configured site description as the default article name.

### Security

- Same-origin request validation, bounded request bodies, revocable root sessions, upload signature checks, and restrictive response headers.

[Unreleased]: https://github.com/terminal-blog/terminal-blog/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/terminal-blog/terminal-blog/releases/tag/v0.1.0-beta.1
