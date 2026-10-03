# DevLog

**Log freely. Ship clean.**

DevLog inserts explicitly marked, environment-guarded console statements into JavaScript and TypeScript. It addresses the familiar problem of development logs accidentally remaining active in production builds.

![DevLog Demo](assets/demo.gif)

```ts
const user = await getUser();

/* @devlog */
if (import.meta.env.DEV) {
  console.log('[UserService.ts:42] user:', user);
}
```

## Install and use

Install the VSIX from the Extensions view, open a JS/TS/JSX/TSX file, put the cursor on an expression, and press `Ctrl+Alt+L` (`Cmd+Option+L` on macOS). All actions are also in the Command Palette. The first insertion detects Vite, Next.js, Express/NestJS, or Node/TypeScript evidence relative to the file's workspace folder. Ambiguous projects ask you to choose.

Commands include insertion for log/warn/error/info/table, safe removal, comment/uncomment, workspace search, conversion of an explicitly selected console statement, and a production-safety report.

## Configuration

`devlog.mode` is `inline` by default. `helper` emits a marked `devLog(...)` call and assumes that your project provides and imports a suitably guarded helper. Configure `devlog.environment` as `auto`, `vite`, `node`, `next`, or `custom`; custom mode requires a valid `devlog.customCondition` such as `__DEV__`.

Formatting settings include filename, line, function and expression metadata, prefix, quote style, marker and semicolons. Diagnostics are opt-in with `devlog.diagnostics.enabled`; the status-bar item can be disabled. Settings are listed in VS Code's Settings UI.

Vite uses `import.meta.env.DEV`. Next.js and Node-oriented projects use `process.env.NODE_ENV !== 'production'`. Detection is cached per workspace folder and invalidated when relevant project files change.

## CLI and CI

```sh
npx devlog check
npx devlog check --production
npx devlog strip --dry-run
npx devlog strip
```

`--production` returns exit code 1 for unprotected or malformed findings. `strip` removes only marker-owned guarded blocks; use `--dry-run` first.

```yaml
- name: Check development logs
  run: npx devlog check --production
```

## Development

```sh
npm install
npm run compile
npm test
npm run package
```

Open the repository in VS Code and press F5 to start an Extension Development Host.

## Safety and limitations

DevLog uses runtime guards, recognizable ownership markers, AST-based analysis, conservative cleanup, and an optional CI check as defense in depth. This is not an absolute guarantee that logs can never reach production: custom build transforms, helper implementations, dynamic console access, generated code, unsupported languages, and incorrectly configured environments remain outside its proof. Helper mode does not create or import a helper automatically. Unknown environments require an explicit choice.

The scanner ignores common dependency/build folders. It categorizes findings for review rather than assuming every warning or error is unsafe. Source code is processed locally and is never sent to an external server.
