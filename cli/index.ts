#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { analyzeSource, removeOwned } from '../src/core/analyzer';

const EXCLUDED = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.git', 'vendor']);
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (EXTENSIONS.has(path.extname(entry.name))) result.push(file);
    }
  }
  await walk(root);
  return result;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!['check', 'strip'].includes(command)) {
    console.error('Usage: devlog <check|strip> [--production] [--dry-run] [path]'); // production-intentional
    process.exitCode = 2;
    return;
  }

  const root = path.resolve(args.find((argument) => !argument.startsWith('--')) ?? '.');
  const files = await sourceFiles(root);
  if (command === 'check') {
    let unsafe = 0;
    let protectedCount = 0;
    let malformed = 0;
    for (const file of files) {
      const text = await fs.readFile(file, 'utf8');
      for (const finding of analyzeSource(text, file)) {
        if (finding.kind === 'unsafe') {
          unsafe++;
          console.log(
            `unsafe ${path.relative(root, file)}:${finding.line}:${finding.column} ${finding.text}`,
          ); // production-intentional
        } else if (finding.kind === 'protected') protectedCount++;
        else if (finding.kind === 'malformed') {
          malformed++;
          console.log(`malformed ${path.relative(root, file)}:${finding.line} ${finding.text}`); // production-intentional
        }
      }
    }
    console.log(
      `Scanned ${files.length} files: ${protectedCount} protected, ${unsafe} potentially unsafe, ${malformed} malformed.`,
    ); // production-intentional
    if (args.includes('--production') && (unsafe || malformed)) process.exitCode = 1;
    return;
  }

  const dryRun = args.includes('--dry-run');
  let changed = 0;
  for (const file of files) {
    const before = await fs.readFile(file, 'utf8');
    const after = removeOwned(before, file);
    if (before !== after) {
      changed++;
      console.log(`${dryRun ? 'would strip' : 'stripped'} ${path.relative(root, file)}`); // production-intentional
      if (!dryRun) await fs.writeFile(file, after, 'utf8');
    }
  }
  console.log(`${dryRun ? 'Would modify' : 'Modified'} ${changed} file(s).`); // production-intentional
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error)); // production-intentional
  process.exitCode = 2;
});
