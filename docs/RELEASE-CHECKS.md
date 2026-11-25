# Release verification

## 0.2.0 alpha

- Official MCP SDK client exercises stdio initialization, tool discovery, editor startup, readiness, prepared-project registration, browser draft synchronization, source diff generation, review status, PR refusal before verification, rollback and process shutdown.
- Product tests cover source revisions, safe paths, credential isolation, draft persistence, edit validation, code merge behavior and web PR URLs.
- GitHub Actions runs on Windows, macOS and Linux. Check actual Actions results; workflow configuration alone is not a passing result.
- Manual checks still required: installation in each advertised AI client, Windows double-click and browser opening, company-specific authentication and development environment, Chrome extension installation.
- This release does not claim that arbitrary repositories work without setup. Supported source integration: React / Next.js webpack development builds.

## Publication boundary

Exclude `.local/`, `.env*`, credentials, product repositories and `node_modules/`. Include package lock, MIT license and third-party notices. No tokens or company source belong in release assets. GitHub releases are separate from npm publication and Chrome Web Store publication.
