import * as vscode from 'vscode';
import { analyzeSource } from '../core/analyzer';
import { Finding } from '../core/types';
export const SOURCE_GLOB = '**/*.{js,jsx,ts,tsx,mjs,cjs}';
export const EXCLUDE_GLOB = '**/{node_modules,dist,build,.next,coverage,.git,vendor}/**';
export async function scanWorkspace(marker = '@devlog', progress?: vscode.Progress<{message?:string}>): Promise<Finding[]> { const uris = await vscode.workspace.findFiles(SOURCE_GLOB, EXCLUDE_GLOB); const all: Finding[] = []; for (let i=0;i<uris.length;i++) { progress?.report({message:`${i+1}/${uris.length}`}); const bytes=await vscode.workspace.fs.readFile(uris[i]); all.push(...analyzeSource(Buffer.from(bytes).toString('utf8'), uris[i].fsPath, marker)); } return all; }
