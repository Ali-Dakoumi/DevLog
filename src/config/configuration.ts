import * as vscode from 'vscode';
export interface DevLogConfig {
  mode: 'inline' | 'helper';
  environment: string;
  customCondition: string;
  helperName: string;
  includeFileName: boolean;
  includeLineNumber: boolean;
  includeFunctionName: boolean;
  includeExpression: boolean;
  prefix: string;
  pretty: { enabled: boolean; icons: boolean; prefix: string };
  marker: string;
  useSemicolons: boolean;
  quoteStyle: 'single' | 'double';
  diagnostics: boolean;
  statusBar: boolean;
}
export function config(uri?: vscode.Uri): DevLogConfig {
  const c = vscode.workspace.getConfiguration('devlog', uri);
  return {
    mode: c.get('mode', 'inline'),
    environment: c.get('environment', 'auto'),
    customCondition: c.get('customCondition', ''),
    helperName: c.get('helperName', 'devLog'),
    includeFileName: c.get('includeFileName', true),
    includeLineNumber: c.get('includeLineNumber', true),
    includeFunctionName: c.get('includeFunctionName', false),
    includeExpression: c.get('includeExpression', true),
    prefix: c.get('prefix', ''),
    pretty: {
      enabled: c.get('pretty.enabled', true),
      icons: c.get('pretty.icons', true),
      prefix: c.get('pretty.prefix', '[DevLog]'),
    },
    marker: c.get('marker', '@devlog'),
    useSemicolons: c.get('useSemicolons', true),
    quoteStyle: c.get('quoteStyle', 'single'),
    diagnostics: c.get('diagnostics.enabled', false),
    statusBar: c.get('statusBar.enabled', true),
  };
}
