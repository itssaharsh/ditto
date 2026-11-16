# Ditto — project instructions

Ditto lets an AI agent (Claude Code) rewrite a frontend while Kane CLI runs the same plain-English tests on the legacy app and the rewrite, feeding every difference back to the agent until both behave the same.

## On every new session or after compaction
1. Read this file, then `PROJECT_MEMORY.md`, then `TASKS.md`.
2. Check the real state: `git log --oneline | head`, `git status`, `kane-cli whoami`, `kane-cli balance`.
3. Resume from the first unchecked item in `TASKS.md`.

## Hard rules
- Deadline: 19 Nov 2026, 23:59 IST (18:29 UTC). Nothing can be pushed after it.
- Never commit secrets, `.env`, Kane evidence packs with personal data (result.yaml holds the account email), or anything under `hackathon-idea/`.
- Never fake a Kane run, a verdict, a screenshot or a number. Recorded cases in `cases/` must come from real runs.
- Kane credits are limited: prefer `testmd run` replays (≈0 credits) over new authoring runs; log credits used in `PROJECT_MEMORY.md`.
- No purchases, plan upgrades, emails or public posts without the user's approval.

## Environment
- Kane CLI: `~/.local/opt/npm-global/bin/kane-cli` (add to PATH). Chrome for Kane: `KANE_CLI_CHROME_PATH=$HOME/.local/lib/kane-chrome/chrome` (wrapper around Playwright Chromium; adds libasound via LD_LIBRARY_PATH; no sudo on this machine).
- Legacy app: `fixtures/legacy-todomvc` (official TodoMVC jQuery build, MIT), served on 127.0.0.1:7001. Spec: `fixtures/app-spec.md`.
- Rewrite: `../todomvc-react-port` (own git repo, written by Claude Code), served from `dist/` on 127.0.0.1:7002.
- Agent: Claude Code CLI `claude -p` (subscription; ANTHROPIC_API_KEY is removed from the child env unless DITTO_AGENT_USE_API_KEY is set).
- Commands: `npm run ditto -- design|record|loop|check|status`; tests: `npm test`; typecheck: `npm run typecheck`.

## Conventions
- TypeScript, Node 22, ESM. Run TS with `tsx`. Keep dependencies few; each one earns its place.
- The case file (`cases/<id>/case.json`) is the single source of truth: the live UI and the replay UI render the same events.
- Plain words in UI and docs; no buzzwords. Say "you".
- Commit small, descriptive commits.
