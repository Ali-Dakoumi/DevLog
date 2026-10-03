import ts from 'typescript';

const kinds: Record<string, ts.ScriptKind> = {
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};
export function sourceFile(text: string, fileName: string): ts.SourceFile {
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    kinds[ext] ?? ts.ScriptKind.TS,
  );
}
export function nodeAt(sf: ts.SourceFile, offset: number): ts.Node {
  let best: ts.Node = sf;
  const visit = (n: ts.Node): void => {
    if (n.getFullStart() <= offset && offset <= n.getEnd()) {
      best = n;
      n.forEachChild(visit);
    }
  };
  visit(sf);
  return best;
}
export function detectExpression(
  text: string,
  fileName: string,
  offset: number,
  selected?: string,
): string | undefined {
  if (selected?.trim()) {
    const value = selected.trim();
    const probe = ts.transpileModule(`const __x = (${value});`, {
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext },
    });
    return (probe.diagnostics ?? []).some((d) => d.category === ts.DiagnosticCategory.Error)
      ? undefined
      : value;
  }
  const sf = sourceFile(text, fileName);
  let n = nodeAt(sf, offset);
  while (
    n.parent &&
    (ts.isIdentifier(n.parent) ||
      ts.isPropertyAccessExpression(n.parent) ||
      ts.isElementAccessExpression(n.parent) ||
      ts.isPropertyAccessChain(n.parent) ||
      ts.isElementAccessChain(n.parent) ||
      ts.isParenthesizedExpression(n.parent))
  )
    n = n.parent;
  if (
    ts.isIdentifier(n) ||
    ts.isPropertyAccessExpression(n) ||
    ts.isElementAccessExpression(n) ||
    ts.isCallExpression(n)
  )
    return n.getText(sf);
  return undefined;
}
export interface Placement {
  offset: number;
  indent: string;
  functionName?: string;
}
export function findPlacement(
  text: string,
  fileName: string,
  offset: number,
): Placement | undefined {
  const sf = sourceFile(text, fileName);
  let n = nodeAt(sf, offset);
  let fn: string | undefined;
  for (let p: ts.Node | undefined = n; p; p = p.parent) {
    if (!fn && ts.isFunctionLike(p)) fn = functionName(p);
    if (
      ts.isStatement(p) &&
      p.parent &&
      (ts.isBlock(p.parent) || ts.isSourceFile(p.parent) || ts.isCaseBlock(p.parent))
    ) {
      const end = p.getEnd();
      const lineStart = text.lastIndexOf('\n', p.getStart(sf)) + 1;
      return {
        offset: end,
        indent: /^[\t ]*/.exec(text.slice(lineStart))?.[0] ?? '',
        functionName: fn,
      };
    }
    n = p;
  }
  return undefined;
}
function functionName(n: ts.SignatureDeclaration): string | undefined {
  if ('name' in n && n.name) return n.name.getText();
  const p = n.parent;
  return ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : undefined;
}
