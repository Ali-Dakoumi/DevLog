import ts from 'typescript';
import { indentationUnit } from './generator';
import { nodeAt, sourceFile } from './parser';

export interface SourceEdit {
  start: number;
  end: number;
  text: string;
}

export interface FunctionContext {
  name: string;
  bodyStart: number;
  bodyEnd: number;
  insertOffset: number;
  indent: string;
  parameters: string[];
  isComponent: boolean;
  isHook: boolean;
  bodyText: string;
}

export function findFunctionContext(
  text: string,
  fileName: string,
  offset: number,
): FunctionContext | undefined {
  const sf = sourceFile(text, fileName);
  for (let node: ts.Node | undefined = nodeAt(sf, offset); node; node = node.parent) {
    if (!ts.isFunctionLike(node)) continue;
    const declaration = node as ts.FunctionLikeDeclaration;
    if (!declaration.body || !ts.isBlock(declaration.body)) continue;
    const name = functionLikeName(declaration);
    if (!name) return undefined;
    const lineStart = text.lastIndexOf('\n', declaration.getStart(sf)) + 1;
    const outerIndent = /^[\t ]*/.exec(text.slice(lineStart))?.[0] ?? '';
    const indent = outerIndent + indentationUnit(outerIndent);
    return {
      name,
      bodyStart: declaration.body.getStart(sf),
      bodyEnd: declaration.body.getEnd(),
      insertOffset: insertionOffset(declaration.body, sf),
      indent,
      parameters: declaration.parameters
        .filter((parameter) => ts.isIdentifier(parameter.name))
        .map((parameter) => (parameter.name as ts.Identifier).text),
      isComponent: /^[A-Z]/.test(name),
      isHook: /^use[A-Z0-9]/.test(name),
      bodyText: declaration.body.getText(sf),
    };
  }
  return undefined;
}

function functionLikeName(node: ts.FunctionLikeDeclaration): string | undefined {
  if ('name' in node && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)))
    return node.name.text;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (
    ts.isPropertyAssignment(parent) &&
    (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
  )
    return parent.name.text;
  return undefined;
}

function insertionOffset(body: ts.Block, sf: ts.SourceFile): number {
  const first = body.statements[0];
  if (!first) return body.getStart(sf) + 1;
  let offset = first.getStart(sf);
  for (const statement of body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    offset = statement.getEnd();
  }
  return offset === first.getStart(sf) ? body.getStart(sf) + 1 : offset;
}

export function parameterObject(parameters: string[]): string | undefined {
  return parameters.length ? `{ ${parameters.join(', ')} }` : undefined;
}

export function hasLifecycleInstrumentation(context: FunctionContext, marker: string): boolean {
  return (
    context.bodyText.includes(marker) &&
    context.bodyText.includes(`${context.name} mounted`) &&
    context.bodyText.includes(`${context.name} unmounted`)
  );
}

export interface ImportPlan {
  edits: SourceEdit[];
  hookIdentifier: string;
}

export function planUseEffectImport(
  text: string,
  fileName: string,
  eol: string,
  quote: 'single' | 'double',
): ImportPlan {
  const sf = sourceFile(text, fileName);
  const reactImports = sf.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'react',
  );
  for (const declaration of reactImports) {
    const clause = declaration.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      const existing = bindings.elements.find(
        element => (element.propertyName ?? element.name).text === 'useEffect',
      );
      if (existing) return { edits: [], hookIdentifier: existing.name.text };
      const names = bindings.elements.map(element => element.getText(sf));
      return {
        edits: [
          {
            start: bindings.getStart(sf),
            end: bindings.getEnd(),
            text: `{ useEffect, ${names.join(', ')} }`,
          },
        ],
        hookIdentifier: 'useEffect',
      };
    }
    if (!bindings && clause.name) {
      return {
        edits: [{ start: clause.getEnd(), end: clause.getEnd(), text: ', { useEffect }' }],
        hookIdentifier: 'useEffect',
      };
    }
  }
  const q = quote === 'single' ? "'" : '"';
  const importText = `import { useEffect } from ${q}react${q};`;
  const anchor = reactImports.at(-1);
  if (anchor)
    return {
      edits: [{ start: anchor.getEnd(), end: anchor.getEnd(), text: `${eol}${importText}` }],
      hookIdentifier: 'useEffect',
    };
  const lastImport = sf.statements.filter(ts.isImportDeclaration).at(-1);
  if (lastImport)
    return {
      edits: [{ start: lastImport.getEnd(), end: lastImport.getEnd(), text: `${eol}${importText}` }],
      hookIdentifier: 'useEffect',
    };
  return { edits: [{ start: 0, end: 0, text: `${importText}${eol}${eol}` }], hookIdentifier: 'useEffect' };
}
