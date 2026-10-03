export type EnvironmentId = 'vite' | 'node' | 'next' | 'custom' | 'unknown';
export type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'table';
export interface ProjectEvidence {
  files: Set<string>;
  dependencies: Set<string>;
}
export interface Detection {
  id: EnvironmentId;
  confidence: number;
  condition?: string;
  reasons: string[];
}
export interface GenerateOptions {
  method: ConsoleMethod;
  expression: string;
  fileName: string;
  line: number;
  functionName?: string;
  condition: string;
  indent: string;
  eol: string;
  marker: string;
  prefix: string;
  includeFileName: boolean;
  includeLineNumber: boolean;
  includeFunctionName: boolean;
  includeExpression: boolean;
  semicolons: boolean;
  quote: 'single' | 'double';
  mode: 'inline' | 'helper';
  helperName: string;
}
export type FindingKind = 'protected' | 'unsafe' | 'ignored' | 'intentional' | 'malformed';
export interface Finding {
  file: string;
  line: number;
  column: number;
  method: string;
  kind: FindingKind;
  text: string;
}
