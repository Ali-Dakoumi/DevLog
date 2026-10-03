import * as vscode from 'vscode';
import { detectEnvironment } from '../core/environment';
import { Detection, ProjectEvidence } from '../core/types';

export class ProjectDetector implements vscode.Disposable {
  private readonly cache = new Map<string, Detection>();
  private readonly reactCache = new Map<string, boolean>();
  private readonly watcher: vscode.FileSystemWatcher;
  constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher(
      '**/{package.json,vite.config.*,next.config.*,tsconfig.json,svelte.config.js,nuxt.config.ts}',
    );
    for (const e of ['onDidChange', 'onDidCreate', 'onDidDelete'] as const)
      this.watcher[e](() => {
        this.cache.clear();
        this.reactCache.clear();
      });
  }
  dispose(): void {
    this.watcher.dispose();
  }
  async detect(uri: vscode.Uri, forced = 'auto', custom = ''): Promise<Detection> {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return { id: 'unknown', confidence: 0, reasons: ['File is not in a workspace'] };
    const key = `${folder.uri.toString()}|${forced}|${custom}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const files = new Set<string>();
    for (const name of [
      'package.json',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'tsconfig.json',
      'svelte.config.js',
      'nuxt.config.ts',
    ]) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, name));
        files.add(name);
      } catch {
        /* absent */
      }
    }
    const dependencies = new Set<string>();
    if (files.has('package.json'))
      try {
        const raw = await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(folder.uri, 'package.json'),
        );
        const pkg = JSON.parse(Buffer.from(raw).toString('utf8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).forEach((d) =>
          dependencies.add(d),
        );
      } catch {
        /* malformed package handled as weak evidence */
      }
    const result = detectEnvironment(
      { files, dependencies } satisfies ProjectEvidence,
      forced,
      custom,
    );
    this.cache.set(key, result);
    return result;
  }

  async isReactProject(uri: vscode.Uri): Promise<boolean> {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return false;
    const key = folder.uri.toString();
    const cached = this.reactCache.get(key);
    if (cached !== undefined) return cached;
    let detected = false;
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, 'package.json'));
      const pkg = JSON.parse(Buffer.from(raw).toString('utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      detected = Boolean(pkg.dependencies?.react || pkg.devDependencies?.react);
    } catch {
      /* missing or malformed package.json */
    }
    this.reactCache.set(key, detected);
    return detected;
  }
}
