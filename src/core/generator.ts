import { GenerateOptions, LogKind, PrettyOptions } from './types';

const ICONS: Record<LogKind, string> = {
  log: '🛠️',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  table: '',
  react: '⚛️',
  function: '🚀',
  mount: '🟢',
  unmount: '🔴',
  timing: '⏱️',
};

export interface GuardedConsoleOptions {
  method: GenerateOptions['method'];
  kind: LogKind;
  label?: string;
  values?: string[];
  condition: string;
  indent: string;
  eol: string;
  marker: string;
  semicolons: boolean;
  quote: GenerateOptions['quote'];
  pretty: PrettyOptions;
}

export function formatLabel(kind: LogKind, content: string, pretty: PrettyOptions): string {
  if (!pretty.enabled) return content;
  return [pretty.icons ? ICONS[kind] : '', pretty.prefix.trim(), content]
    .filter(Boolean)
    .join(' ');
}

export function generateGuardedConsole(options: GuardedConsoleOptions): string {
  const quote = options.quote === 'single' ? "'" : '"';
  const escape = (value: string): string =>
    value
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), `\\${quote}`)
      .replace(/\r?\n/g, ' ');
  const args = [
    options.label === undefined
      ? undefined
      : `${quote}${escape(formatLabel(options.kind, options.label, options.pretty))}${quote}`,
    ...(options.values ?? []),
  ].filter((value): value is string => Boolean(value));
  const semicolon = options.semicolons ? ';' : '';
  const inner = options.indent + indentationUnit(options.indent);
  return `/* ${options.marker} */${options.eol}${options.indent}if (${options.condition}) {${options.eol}${inner}console.${options.method}(${args.join(', ')})${semicolon}${options.eol}${options.indent}}`;
}

export function generateLog(options: GenerateOptions): string {
  const pretty = options.pretty ?? { enabled: false, icons: false, prefix: '' };
  const quote = options.quote === 'single' ? "'" : '"';
  const escape = (value: string): string =>
    value
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), `\\${quote}`)
      .replace(/\r?\n/g, ' ');
  const location = [
    options.includeFileName ? options.fileName : '',
    options.includeLineNumber ? String(options.line) : '',
  ]
    .filter(Boolean)
    .join(':');
  const legacyParts = [
    options.prefix,
    location ? `[${location}]` : '',
    options.includeFunctionName && options.functionName ? `${options.functionName}()` : '',
    options.includeExpression ? `${options.expression}:` : '',
  ].filter(Boolean);
  const prettyParts = [
    options.prefix,
    location,
    options.includeFunctionName && options.functionName ? `${options.functionName}()` : '',
    options.includeExpression ? `→ ${options.expression}:` : '',
  ].filter(Boolean);
  const content = (pretty.enabled ? prettyParts : legacyParts).join(' ');
  const label = options.method === 'table' ? undefined : formatLabel(options.method, content, pretty);
  const semicolon = options.semicolons ? ';' : '';
  const values = [options.expression];

  if (options.mode === 'helper') {
    const args = [label ? `${quote}${escape(label)}${quote}` : undefined, ...values]
      .filter(Boolean)
      .join(', ');
    return `${options.eol}${options.indent}/* ${options.marker} */${options.eol}${options.indent}${options.helperName}(${args})${semicolon}`;
  }
  const guarded = generateGuardedConsole({
    method: options.method,
    kind: options.method,
    label: content || undefined,
    values,
    condition: options.condition,
    indent: options.indent,
    eol: options.eol,
    marker: options.marker,
    semicolons: options.semicolons,
    quote: options.quote,
    pretty,
  });
  return `${options.eol}${options.eol}${options.indent}${guarded}`;
}

export function indentationUnit(existing: string): string {
  return existing.includes('\t') ? '\t' : '  ';
}
