import ts from 'typescript';
import { Finding } from './types';
import { sourceFile } from './parser';

export function analyzeSource(
  text: string,
  file: string,
  marker = '@devlog',
  helperName = 'devLog',
): Finding[] {
  const sf = sourceFile(text, file);
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sf) === 'console'
    ) {
      const method = node.expression.name.text;
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const parentIf = nearestIf(node);
      const comments =
        ts.getLeadingCommentRanges(text, parentIf?.getFullStart() ?? node.getFullStart()) ?? [];
      const protectedLog = Boolean(
        parentIf &&
        comments.some((comment) => text.slice(comment.pos, comment.end).includes(marker)),
      );
      const lineStart = text.lastIndexOf('\n', node.getStart(sf)) + 1;
      const nextLine = text.indexOf('\n', node.getEnd());
      const lineText = text.slice(lineStart, nextLine < 0 ? text.length : nextLine);
      const ignored = /devlog-ignore/.test(lineText);
      const intentional = /audit|production-intentional/i.test(lineText);
      findings.push({
        file,
        line: pos.line + 1,
        column: pos.character + 1,
        method,
        kind: protectedLog
          ? 'protected'
          : ignored
            ? 'ignored'
            : intentional
              ? 'intentional'
              : 'unsafe',
        text: node.getText(sf),
      });
    } else if (isOwnedHelperStatement(node, sf, text, marker, helperName)) {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      findings.push({
        file,
        line: pos.line + 1,
        column: pos.character + 1,
        method: helperName,
        kind: 'protected',
        text: node.expression.getText(sf),
      });
    }
    node.forEachChild(visit);
  };
  visit(sf);
  const markerCount = countMarkerComments(text, marker);
  const protectedCount = findings.filter((finding) => finding.kind === 'protected').length;
  if (markerCount > protectedCount)
    findings.push({
      file,
      line: 1,
      column: 1,
      method: '',
      kind: 'malformed',
      text: 'Marker is not attached to a recognized DevLog statement',
    });
  return findings;
}

function countMarkerComments(text: string, marker: string): number {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  let count = 0;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      (token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia) &&
      scanner.getTokenText().includes(marker)
    )
      count++;
  }
  return count;
}

function nearestIf(node: ts.Node): ts.IfStatement | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isIfStatement(parent)) return parent;
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return undefined;
  }
  return undefined;
}

function markerComment(text: string, node: ts.Node, marker: string): ts.CommentRange | undefined {
  return (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []).find((comment) =>
    text.slice(comment.pos, comment.end).includes(marker),
  );
}

function isOwnedHelperStatement(
  node: ts.Node,
  sf: ts.SourceFile,
  text: string,
  marker: string,
  helperName: string,
): node is ts.ExpressionStatement {
  return Boolean(
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === helperName &&
    markerComment(text, node, marker) &&
    node.getText(sf).startsWith(`${helperName}(`),
  );
}

export interface OwnedRange {
  start: number;
  end: number;
}

export function ownedRanges(
  text: string,
  file: string,
  marker = '@devlog',
  helperName = 'devLog',
): OwnedRange[] {
  const sf = sourceFile(text, file);
  const ranges: OwnedRange[] = [];
  const addRange = (mark: ts.CommentRange, end: number): void => {
    let start = mark.pos;
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start--;
    if (start > 0 && text[start - 1] === '\n') start--;
    ranges.push({ start, end });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      const mark = markerComment(text, node, marker);
      const calls: ts.CallExpression[] = [];
      const collect = (child: ts.Node): void => {
        if (
          ts.isCallExpression(child) &&
          ts.isPropertyAccessExpression(child.expression) &&
          child.expression.expression.getText(sf) === 'console'
        )
          calls.push(child);
        child.forEachChild(collect);
      };
      collect(node.thenStatement);
      if (mark && calls.length === 1) addRange(mark, node.end);
    } else if (isOwnedHelperStatement(node, sf, text, marker, helperName)) {
      const mark = markerComment(text, node, marker);
      if (mark) addRange(mark, node.end);
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return ranges;
}

export function removeOwned(
  text: string,
  file: string,
  marker = '@devlog',
  helperName = 'devLog',
): string {
  return ownedRanges(text, file, marker, helperName)
    .sort((a, b) => b.start - a.start)
    .reduce((source, range) => source.slice(0, range.start) + source.slice(range.end), text);
}

export interface CommentedOwnedRange extends OwnedRange {
  restored: string;
}

export function commentedOwnedRanges(
  text: string,
  file: string,
  marker = '@devlog',
  helperName = 'devLog',
): CommentedOwnedRange[] {
  const lines = text.match(/.*(?:\r\n|\n|$)/g)?.filter(Boolean) ?? [];
  const result: CommentedOwnedRange[] = [];
  let offset = 0;
  for (let index = 0; index < lines.length;) {
    if (!/^\s*\/\//.test(lines[index])) {
      offset += lines[index++].length;
      continue;
    }
    const start = offset;
    const group: string[] = [];
    while (index < lines.length && /^\s*\/\//.test(lines[index])) {
      group.push(lines[index]);
      offset += lines[index++].length;
    }
    const raw = group.join('');
    if (!raw.includes(marker)) continue;
    const restored = raw.replace(/^(\s*)\/\/ ?/gm, '$1');
    const owned = ownedRanges(restored, file, marker, helperName);
    if (owned.length === 1 && owned[0].start <= 1 && owned[0].end >= restored.trimEnd().length)
      result.push({ start, end: offset, restored });
  }
  return result;
}
