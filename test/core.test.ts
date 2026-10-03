import { describe, expect, it } from 'vitest';
import { detectEnvironment, validCondition } from '../src/core/environment';
import { detectExpression, findPlacement } from '../src/core/parser';
import { generateLog } from '../src/core/generator';
import { analyzeSource, commentedOwnedRanges, removeOwned } from '../src/core/analyzer';
import {
  findFunctionContext,
  parameterObject,
  planUseEffectImport,
} from '../src/core/instrumentation';
describe('expression detection', () => {
  const text = 'const x = user.name;\nconst y = result?.data;\nconst z = users[0];';
  for (const x of ['user.name', 'result?.data', 'users[0]'])
    it(x, () => expect(detectExpression(text, 'x.ts', text.indexOf(x) + 2)).toBe(x));
  it('selected multiline expression', () =>
    expect(detectExpression('', 'x.ts', 0, 'response.\n  data')).toBe('response.\n  data'));
});
describe('environment', () => {
  it('detects vite', () =>
    expect(
      detectEnvironment({ files: new Set(['vite.config.ts']), dependencies: new Set() }).id,
    ).toBe('vite'));
  it('detects next', () =>
    expect(
      detectEnvironment({ files: new Set(['package.json']), dependencies: new Set(['next']) }).id,
    ).toBe('next'));
  it('detects node', () =>
    expect(
      detectEnvironment({ files: new Set(['package.json']), dependencies: new Set(['express']) })
        .id,
    ).toBe('node'));
  it('rejects ambiguity', () =>
    expect(
      detectEnvironment({ files: new Set(['vite.config.ts']), dependencies: new Set(['next']) }).id,
    ).toBe('unknown'));
  it('validates custom conditions', () => {
    expect(validCondition('__DEV__')).toBe(true);
    expect(validCondition('x); evil(); if (x')).toBe(false);
  });
});
describe('generation and placement', () => {
  it('matches Vite output', () => {
    const t =
        'async function loadUser() {\n  const user = await api.getUser();\n\n  return user;\n}',
      p = findPlacement(t, 'example.ts', t.indexOf('user'));
    expect(p?.offset).toBe(t.indexOf(';') + 1);
    expect(
      generateLog({
        method: 'log',
        expression: 'user',
        fileName: 'example.ts',
        line: 2,
        functionName: 'loadUser',
        condition: 'import.meta.env.DEV',
        indent: '  ',
        eol: '\n',
        marker: '@devlog',
        prefix: '',
        includeFileName: true,
        includeLineNumber: true,
        includeFunctionName: false,
        includeExpression: true,
        semicolons: true,
        quote: 'single',
        mode: 'inline',
        helperName: 'devLog',
      }),
    ).toBe(
      "\n\n  /* @devlog */\n  if (import.meta.env.DEV) {\n    console.log('[example.ts:2] user:', user);\n  }",
    );
  });
});
describe('safety and removal', () => {
  const protectedText =
    "const x=1;\n/* @devlog */\nif (import.meta.env.DEV) {\n  console.log('x', x);\n}\nconsole.log('important');\n";
  it('classifies AST calls and ignores strings/comments', () => {
    const f = analyzeSource(
      protectedText + "const s='console.log(no)'; // console.log(no)\n",
      'x.ts',
    );
    expect(f.map((x) => x.kind)).toEqual(['protected', 'unsafe']);
  });
  it('removes only owned block', () => {
    const out = removeOwned(protectedText, 'x.ts');
    expect(out).not.toContain('@devlog');
    expect(out).toContain("console.log('important')");
  });
  it('supports CRLF', () =>
    expect(removeOwned(protectedText.replace(/\n/g, '\r\n'), 'x.ts')).toContain(
      "console.log('important')",
    ));
});
describe('comment restoration', () => {
  it('restores only a verified owned block', () => {
    const block = "// /* @devlog */\n// if (__DEV__) {\n//   console.log('x', x);\n// }\n";
    expect(commentedOwnedRanges(block, 'x.ts')[0].restored).toContain('if (__DEV__)');
  });
});
describe('helper ownership', () => {
  const helper = "const x=1;\n/* @devlog */\ndebugOnly('x:', x);\nconsole.log('important');\n";
  it('recognizes configured helper calls', () =>
    expect(analyzeSource(helper, 'x.ts', '@devlog', 'debugOnly').map((x) => x.kind)).toEqual([
      'protected',
      'unsafe',
    ]));
  it('removes only the owned helper call', () => {
    const out = removeOwned(helper, 'x.ts', '@devlog', 'debugOnly');
    expect(out).not.toContain('debugOnly');
    expect(out).toContain("console.log('important')");
  });
});
describe('marker parsing', () => {
  it('does not treat marker text in strings as an owned comment', () =>
    expect(analyzeSource("const marker = '@devlog';", 'x.ts')).toEqual([]));
});
describe('tsx', () => {
  it('places inside component block', () => {
    const t = 'function C({user}: P) {\n  return <div>{user.name}</div>;\n}';
    expect(detectExpression(t, 'x.tsx', t.indexOf('user.name') + 2)).toBe('user.name');
    expect(findPlacement(t, 'x.tsx', t.indexOf('user.name'))?.indent).toBe('  ');
  });
});
describe('instrumentation', () => {
  it('finds an arrow component and its parameters', () => {
    const text = 'const Card = (user, count) => {\n  return <div>{user.name}</div>;\n};';
    const context = findFunctionContext(text, 'x.tsx', text.indexOf('user.name'));
    expect(context?.name).toBe('Card');
    expect(context?.isComponent).toBe(true);
    expect(parameterObject(context?.parameters ?? [])).toBe('{ user, count }');
  });
  it('reuses an aliased useEffect import', () => {
    const text = "import { useEffect as effect, useState } from 'react';\n";
    const plan = planUseEffectImport(text, 'x.tsx', '\n', 'single');
    expect(plan.hookIdentifier).toBe('effect');
    expect(plan.edits).toEqual([]);
  });
  it('adds useEffect to an existing React import', () => {
    const text = "import React, { useState } from 'react';\n";
    const plan = planUseEffectImport(text, 'x.tsx', '\n', 'single');
    expect(plan.edits[0].text).toBe('{ useEffect, useState }');
  });
});
