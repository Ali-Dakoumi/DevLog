import * as vscode from 'vscode';
import { config } from '../config/configuration';
import { conditionFor } from '../core/environment';
import { generateGuardedConsole, indentationUnit } from '../core/generator';
import {
  findFunctionContext,
  hasLifecycleInstrumentation,
  parameterObject,
  planUseEffectImport,
  SourceEdit,
} from '../core/instrumentation';
import { LogKind } from '../core/types';
import { ProjectDetector } from '../environment/project';

type InstrumentationKind = 'value' | 'render' | 'lifecycle' | 'function';

export async function instrument(
  detector: ProjectDetector,
  kind: InstrumentationKind,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const document = editor.document;
  const configuration = config(document.uri);
  const detection = await detector.detect(
    document.uri,
    configuration.environment,
    configuration.customCondition,
  );
  const condition = conditionFor(
    detection.id,
    detection.condition ?? configuration.customCondition,
  );
  if (!condition) {
    vscode.window.showErrorMessage('Configure a safe DevLog environment before instrumenting.');
    return;
  }

  const text = document.getText();
  const selection = editor.selection;
  const offset = document.offsetAt(selection.active);
  const context = findFunctionContext(text, document.fileName, offset);
  if (!context) {
    vscode.window.showErrorMessage('Place the cursor inside a function with a block body.');
    return;
  }
  if (kind !== 'function') {
    if (!(await detector.isReactProject(document.uri))) {
      vscode.window.showErrorMessage('This command requires a React project.');
      return;
    }
    if (!context.isComponent && !context.isHook) {
      vscode.window.showErrorMessage('Place the cursor inside a React component or hook.');
      return;
    }
  }

  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const common = {
    condition,
    eol,
    marker: configuration.marker,
    semicolons: configuration.useSemicolons,
    quote: configuration.quoteStyle,
    pretty: configuration.pretty,
  } as const;
  const edits: SourceEdit[] = [];

  if (kind === 'render' || kind === 'function') {
    const logKind: LogKind = kind === 'render' ? 'react' : 'function';
    const values = kind === 'function' ? [parameterObject(context.parameters)].filter(isString) : [];
    const block = generateGuardedConsole({
      ...common,
      method: 'log',
      kind: logKind,
      label: kind === 'render' ? `${context.name} render` : `${context.name} called`,
      values,
      indent: context.indent,
    });
    edits.push({
      start: context.insertOffset,
      end: context.insertOffset,
      text: `${eol}${context.indent}${block}${eol}`,
    });
  } else {
    const importPlan = planUseEffectImport(
      text,
      document.fileName,
      eol,
      configuration.quoteStyle,
    );
    edits.push(...importPlan.edits);
    const unit = indentationUnit(context.indent);
    if (kind === 'value') {
      const expression = document.getText(selection).trim();
      if (!expression) {
        vscode.window.showErrorMessage('Select a value or expression to observe.');
        return;
      }
      const effectIndent = context.indent + unit;
      const log = withoutMarker(
        generateGuardedConsole({
          ...common,
          method: 'log',
          kind: 'react',
          label: `${expression} changed`,
          values: [expression],
          indent: effectIndent,
        }),
        configuration.marker,
        eol,
        effectIndent,
      );
      edits.push({
        start: context.insertOffset,
        end: context.insertOffset,
        text: `${eol}${context.indent}/* ${configuration.marker} */${eol}${context.indent}${importPlan.hookIdentifier}(() => {${eol}${context.indent}${unit}${log}${eol}${context.indent}}, [${expression}]);${eol}`,
      });
    } else {
      if (hasLifecycleInstrumentation(context, configuration.marker)) {
        vscode.window.showInformationMessage(`${context.name} already has lifecycle logging.`);
        return;
      }
      const effectIndent = context.indent + unit;
      const cleanupIndent = effectIndent + unit;
      const mount = withoutMarker(
        generateGuardedConsole({
          ...common,
          method: 'log',
          kind: 'mount',
          label: `${context.name} mounted`,
          indent: effectIndent,
        }),
        configuration.marker,
        eol,
        effectIndent,
      );
      const unmount = withoutMarker(
        generateGuardedConsole({
          ...common,
          method: 'log',
          kind: 'unmount',
          label: `${context.name} unmounted`,
          indent: cleanupIndent,
        }),
        configuration.marker,
        eol,
        cleanupIndent,
      );
      edits.push({
        start: context.insertOffset,
        end: context.insertOffset,
        text: `${eol}${context.indent}/* ${configuration.marker} */${eol}${context.indent}${importPlan.hookIdentifier}(() => {${eol}${context.indent}${unit}${mount}${eol}${context.indent}${unit}return () => {${eol}${context.indent}${unit}${unit}${unmount}${eol}${context.indent}${unit}};${eol}${context.indent}}, []);${eol}`,
      });
    }
  }

  await editor.edit((builder) => {
    for (const edit of edits.sort((a, b) => b.start - a.start))
      builder.replace(
        new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)),
        edit.text,
      );
  });
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function withoutMarker(block: string, marker: string, eol: string, indent: string): string {
  return block.replace(`/* ${marker} */${eol}${indent}`, '');
}
