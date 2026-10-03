# DevLog

**Log freely. Ship clean.**

Developers frequently add temporary `console.log` statements while debugging and accidentally leave them active in production code. DevLog inserts recognizable, environment-aware development guards so temporary logging is explicit, searchable, and removable.

Before:

```ts
const user = await getUser();
```

After in Vite:

```ts
const user = await getUser();

/* @devlog */
if (import.meta.env.DEV) {
  console.log('[UserService.ts:42] user:', user);
}
```

Node.js and Next.js projects use a Node-compatible guard:

```ts
/* @devlog */
if (process.env.NODE_ENV !== 'production') {
  console.log('[UserService.ts:42] user:', user);
}
```

## Features

- Inserts `console.log`, `warn`, `error`, `info`, and `table` calls.
- Detects selected expressions or the expression under the cursor with the TypeScript parser.
- Places logs after the containing statement while preserving indentation and line endings.
- Detects Vite, Next.js, and Node-oriented projects per workspace folder.
- Supports custom development conditions and an optional user-supplied helper.
- Finds, comments, restores, and conservatively removes marked DevLog statements.
- Reports protected, unprotected, ignored, intentional, and malformed console findings.
- Provides an opt-in diagnostic for unprotected console statements.
- Includes a deterministic CLI for local use and CI.

## Quick Start

1. Install DevLog and open a JavaScript or TypeScript file.
2. Select an expression, or place the cursor on one.
3. Run **DevLog: Insert Log** or press `Ctrl+Alt+L` (`Cmd+Option+L` on macOS).
4. If project detection is ambiguous, choose an environment. DevLog stores the choice in workspace configuration.

## Commands

| Command                                      | Purpose                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| DevLog: Insert Log                           | Insert a protected `console.log`.                                         |
| DevLog: Insert Warning                       | Insert a protected `console.warn`.                                        |
| DevLog: Insert Error                         | Insert a protected `console.error`.                                       |
| DevLog: Insert Info                          | Insert a protected `console.info`.                                        |
| DevLog: Insert Table                         | Insert a protected `console.table`.                                       |
| DevLog: Remove All DevLogs From Current File | Remove only recognized DevLog-owned structures.                           |
| DevLog: Remove All DevLogs From Workspace    | Confirm, then remove recognized DevLog-owned structures in scanned files. |
| DevLog: Comment All DevLogs                  | Comment recognized DevLog statements in the active file.                  |
| DevLog: Uncomment All DevLogs                | Restore verified DevLog statements in the active file.                    |
| DevLog: Find All DevLogs                     | List protected DevLog statements and navigate to one.                     |
| DevLog: Convert console.log to DevLog        | Convert the explicitly selected console statement.                        |
| DevLog: Check Production Safety              | Scan supported workspace files and open a categorized report.             |

The editor context menu exposes Log, Warning, and Error actions when text is selected.

## Configuration

| Setting                      | Default   | Description                                                            |
| ---------------------------- | --------- | ---------------------------------------------------------------------- |
| `devlog.mode`                | `inline`  | Use guarded inline blocks or marked helper calls.                      |
| `devlog.environment`         | `auto`    | `auto`, `vite`, `node`, `next`, or `custom`.                           |
| `devlog.customCondition`     | empty     | JavaScript condition used by the custom environment.                   |
| `devlog.helperName`          | `devLog`  | Identifier called in helper mode. DevLog does not create or import it. |
| `devlog.includeFileName`     | `true`    | Include the source filename in the generated label.                    |
| `devlog.includeLineNumber`   | `true`    | Include the insertion-time source line.                                |
| `devlog.includeFunctionName` | `false`   | Include the containing function name when available.                   |
| `devlog.includeExpression`   | `true`    | Include the expression text in the label.                              |
| `devlog.prefix`              | empty     | Optional label prefix.                                                 |
| `devlog.marker`              | `@devlog` | Ownership marker used for generated statements.                        |
| `devlog.useSemicolons`       | `true`    | Add semicolons to generated calls.                                     |
| `devlog.quoteStyle`          | `single`  | Use `single` or `double` quotes.                                       |
| `devlog.diagnostics.enabled` | `false`   | Show warnings for unprotected console statements.                      |
| `devlog.statusBar.enabled`   | `true`    | Show the DevLog safety-scan shortcut.                                  |

Helper mode emits a marked call such as `devLog("user:", user)`. Your project must define and import that helper with the appropriate development guard.

## Environment Detection

Detection runs relative to the active file's workspace folder, so frontend and backend folders can use different strategies in a multi-root workspace.

- **Vite:** `import.meta.env.DEV`
- **Next.js / Node.js / Express / NestJS:** `process.env.NODE_ENV !== "production"`
- **Custom:** the validated expression in `devlog.customCondition`

DevLog considers project configuration files and dependencies. Detection results are cached and invalidated when relevant project files change. An unknown or ambiguous environment requires an explicit choice; DevLog does not silently guess a guard.

## Production Behavior

Vite production behavior has been tested: Vite replaces the development condition during a production build and removes the guarded DevLog console call from the resulting bundle. Other frameworks and custom build pipelines may transform guarded code differently, so verify the behavior of your own production build.

Ordinary manually written console statements are intentionally left unchanged unless you explicitly select one and invoke the conversion command.

## Safety

Generated statements contain `/* @devlog */`. Cleanup uses parsed source structure plus that marker and does not remove an arbitrary `console.log` merely because it is a console call. The scanner reports findings for review; “no unprotected console statements detected” is not an absolute security guarantee.

DevLog performs its source analysis locally. The extension does not send telemetry, make network requests, upload source code, execute shell commands, or store credentials. It reads supported source and project metadata inside the open workspace and writes source only in response to an explicit command.

## CLI and CI

```sh
devlog check
devlog check --production
devlog strip --dry-run
devlog strip
```

`check --production` exits with status 1 when unprotected or malformed findings exist. `strip` removes only recognized marker-owned blocks; preview affected files with `--dry-run`.

```yaml
- name: Check development logs
  run: npx devlog check --production
```

## Supported Languages

JavaScript, JavaScript React (JSX), TypeScript, TypeScript React (TSX), MJS, and CJS source files are supported. Framework detection covers Vite and common Node-oriented projects, including Next.js, Express, and NestJS evidence.

## Known Limitations

- Production removal depends on the selected framework and its build-time optimization.
- Helper mode requires a helper supplied and imported by the project.
- Dynamic console access, generated source, and unsupported languages may not be detected.
- The scanner ignores common dependency and build directories but does not yet parse every ignore-file format.
- Metadata such as filename and line number is generated at insertion time and is not updated when code moves.

## Contributing

```sh
npm install
npm run compile
npm test
npm run lint
```

Open the repository in VS Code and press F5 to launch an Extension Development Host. Contributions should preserve conservative ownership checks: unrelated console statements must never be removed.

Issues and contributions are welcome at the [DevLog repository](https://github.com/Ali-Dakoumi/DevLog).

## License

[MIT](LICENSE)
