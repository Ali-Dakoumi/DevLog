import ts from 'typescript';
import { Finding } from './types';
import { sourceFile } from './parser';

export function analyzeSource(text: string, file: string, marker = '@devlog'): Finding[] {
  const sf = sourceFile(text, file); const findings: Finding[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText(sf) === 'console') {
      const method = n.expression.name.text; const pos = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      const parentIf = nearestIf(n); const comments = ts.getLeadingCommentRanges(text, parentIf?.getFullStart() ?? n.getFullStart()) ?? [];
      const protectedLog = Boolean(parentIf && comments.some(c => text.slice(c.pos, c.end).includes(marker)));
      const lineText = text.slice(text.lastIndexOf('\n', n.getStart(sf)) + 1, text.indexOf('\n', n.getEnd()) < 0 ? text.length : text.indexOf('\n', n.getEnd()));
      const ignored = /devlog-ignore/.test(lineText); const intentional = /audit|production-intentional/i.test(lineText);
      findings.push({ file, line: pos.line + 1, column: pos.character + 1, method, kind: protectedLog ? 'protected' : ignored ? 'ignored' : intentional ? 'intentional' : 'unsafe', text: n.getText(sf) });
    }
    n.forEachChild(visit);
  }; visit(sf);
  const markerCount = text.split(marker).length - 1; const protectedCount = findings.filter(f => f.kind === 'protected').length;
  if (markerCount > protectedCount) findings.push({ file, line: 1, column: 1, method: '', kind: 'malformed', text: 'Marker is not attached to a guarded console statement' });
  return findings;
}
function nearestIf(n: ts.Node): ts.IfStatement | undefined { for (let p = n.parent; p; p = p.parent) { if (ts.isIfStatement(p)) return p; if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return undefined; } return undefined; }

export interface OwnedRange { start: number; end: number; }
export function ownedRanges(text: string, file: string, marker = '@devlog'): OwnedRange[] {
  const sf = sourceFile(text, file); const ranges: OwnedRange[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isIfStatement(n)) {
      const comments = ts.getLeadingCommentRanges(text, n.getFullStart()) ?? [];
      const mark = comments.find(c => text.slice(c.pos, c.end).includes(marker));
      const calls: ts.CallExpression[] = []; const collect = (x: ts.Node): void => { if (ts.isCallExpression(x) && x.expression.getText(sf).startsWith('console.')) calls.push(x); x.forEachChild(collect); }; collect(n.thenStatement);
      if (mark && calls.length === 1) { let start = mark.pos; while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start--; if (start > 0 && text[start - 1] === '\n') start--; ranges.push({ start, end: n.end }); }
    }
    n.forEachChild(visit);
  }; visit(sf); return ranges;
}
export function removeOwned(text: string, file: string, marker = '@devlog'): string { return ownedRanges(text, file, marker).sort((a,b) => b.start-a.start).reduce((s,r) => s.slice(0,r.start)+s.slice(r.end), text); }
export interface CommentedOwnedRange extends OwnedRange { restored: string; }
export function commentedOwnedRanges(text: string, file: string, marker = '@devlog'): CommentedOwnedRange[] {
  const lines=text.match(/.*(?:\r\n|\n|$)/g)?.filter(Boolean)??[],result:CommentedOwnedRange[]=[];let offset=0;
  for(let i=0;i<lines.length;){if(!/^\s*\/\//.test(lines[i])){offset+=lines[i++].length;continue;}const start=offset,group:string[]=[];while(i<lines.length&&/^\s*\/\//.test(lines[i])){group.push(lines[i]);offset+=lines[i++].length;}const raw=group.join('');if(!raw.includes(marker))continue;const restored=raw.replace(/^(\s*)\/\/ ?/gm,'$1'),owned=ownedRanges(restored,file,marker);if(owned.length===1&&owned[0].start<=1&&owned[0].end>=restored.trimEnd().length)result.push({start,end:offset,restored});}
  return result;
}
