import { GenerateOptions } from './types';

export function generateLog(o: GenerateOptions): string {
  const q = o.quote === 'single' ? "'" : '"';
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`).replace(/\r?\n/g, ' ');
  const location = [o.includeFileName ? o.fileName : '', o.includeLineNumber ? String(o.line) : '']
    .filter(Boolean)
    .join(':');
  const parts = [
    o.prefix,
    location ? `[${location}]` : '',
    o.includeFunctionName && o.functionName ? `${o.functionName}()` : '',
    o.includeExpression ? `${o.expression}:` : '',
  ].filter(Boolean);
  const label = parts.join(' ');
  const semi = o.semicolons ? ';' : '';
  const args = label ? `${q}${escape(label)}${q}, ${o.expression}` : o.expression;
  if (o.mode === 'helper')
    return `${o.eol}${o.indent}/* ${o.marker} */${o.eol}${o.indent}${o.helperName}(${args})${semi}`;
  const inner = o.indent + indentationUnit(o.indent);
  return `${o.eol}${o.eol}${o.indent}/* ${o.marker} */${o.eol}${o.indent}if (${o.condition}) {${o.eol}${inner}console.${o.method}(${args})${semi}${o.eol}${o.indent}}`;
}
function indentationUnit(existing: string): string {
  return existing.includes('\t') ? '\t' : '  ';
}
