import ts from 'typescript';
import { Detection, EnvironmentId, ProjectEvidence } from './types';

export function detectEnvironment(e: ProjectEvidence, forced: string = 'auto', custom = ''): Detection {
  if (forced === 'custom') return validCondition(custom) ? { id: 'custom', confidence: 100, condition: custom.trim(), reasons: ['Configured custom condition'] } : { id: 'unknown', confidence: 0, reasons: ['Invalid custom condition'] };
  if (forced !== 'auto') return { id: forced as EnvironmentId, confidence: 100, reasons: ['Configured explicitly'] };
  const vite = e.files.has('vite.config.ts') || e.files.has('vite.config.js') || e.dependencies.has('vite');
  const next = [...e.files].some(f => /^next\.config\./.test(f)) || e.dependencies.has('next');
  if (vite && !next) return { id: 'vite', confidence: 95, reasons: ['Vite configuration or dependency'] };
  if (next && !vite) return { id: 'next', confidence: 95, reasons: ['Next.js configuration or dependency'] };
  if (vite && next) return { id: 'unknown', confidence: 30, reasons: ['Both Vite and Next.js evidence found'] };
  const nodeDeps = ['express', '@nestjs/core'];
  if (e.files.has('package.json') && (nodeDeps.some(d => e.dependencies.has(d)) || e.files.has('tsconfig.json'))) return { id: 'node', confidence: nodeDeps.some(d => e.dependencies.has(d)) ? 85 : 60, reasons: ['Node/TypeScript project evidence'] };
  return { id: 'unknown', confidence: 0, reasons: ['No reliable environment evidence'] };
}
export function conditionFor(id: EnvironmentId, custom?: string): string | undefined {
  if (id === 'vite') return 'import.meta.env.DEV';
  if (id === 'node' || id === 'next') return "process.env.NODE_ENV !== 'production'";
  if (id === 'custom' && custom && validCondition(custom)) return custom.trim();
  return undefined;
}
export function validCondition(value: string): boolean {
  if (!value.trim() || /[;{}]/.test(value)) return false;
  const result = ts.transpileModule(`if (${value}) {}`, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext } });
  return !(result.diagnostics ?? []).some(d => d.category === ts.DiagnosticCategory.Error);
}
