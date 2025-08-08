# Repository Guidelines

## Project Structure & Module Organization
- `a11ycap/`: Core TypeScript library (built with Vite + tsc). Source in `a11ycap/src`.  
- `a11ycap-mcp/`: MCP server utilities (TypeScript) compiled to `dist/`.
- `test/`: Playwright specs (`*.spec.ts`) and test helpers.
- `testpagecra/`: CRA demo app used by tests.
- `babel-plugin-a11ycap/`: Babel plugin package (scaffold).
- Root config: `playwright.config.ts`, `biome.json`, `pnpm-workspace.yaml`.

## Build, Test, and Development Commands
- Install: `pnpm install` (workspace).  
- Build (all): `pnpm build` → runs `pnpm -r build` across packages.  
- Build (package): `pnpm --filter a11ycap build` or `pnpm --filter a11ycap-mcp build`.  
- Lint: `pnpm lint` or `pnpm -r lint` (auto-fix: `pnpm --filter a11ycap lint:fix`).  
- Test (headless): `pnpm test` → builds lib + demo and runs Playwright.  
- Test (headed): `pnpm test:headed` or `pnpm --filter a11ycap test:headed` for UI debugging.
- Local demo: `cd testpagecra && pnpm start` (CRA).


## Coding Style & Naming Conventions
- Language: TypeScript. Indent with 2 spaces; single quotes; ES5 trailing commas.  
- Tooling: Biome for lint + format (`biome.json`); organize imports enabled.  
- Naming: `camelCase` for variables/functions, `PascalCase` for types/classes.  
- Files: library modules as `camelCase.ts` (e.g., `reactUtils.ts`); tests as `*.spec.ts`.

## Testing Guidelines
- Framework: Playwright. Specs live in `test/` and end with `.spec.ts`.  
- Run fast locally with `pnpm test:headed` to inspect traces; JSON results in `test-results.json`.  
- Ensure the library builds before pushing; add tests for new features and edge cases.

## Commit & Pull Request Guidelines
- Commits: imperative, concise, scoped when helpful (e.g., `[a11ycap] fix aria snapshot`).  
- PRs: clear description, linked issues, rationale, and test updates. Include screenshots or logs when behavior changes.  
- Checks: PRs should pass build, lint, and tests (`pnpm build && pnpm -r lint && pnpm test`).

## Security & Configuration Tips
- Do not commit secrets. Use environment variables for configuration toggles.  
- Avoid flaky tests: respect short timeouts in `playwright.config.ts` and reuse the dev server when possible.

