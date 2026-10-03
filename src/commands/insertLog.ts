import * as path from 'path';
import * as vscode from 'vscode';
import { config } from '../config/configuration';
import { conditionFor } from '../core/environment';
import { generateLog } from '../core/generator';
import { detectExpression, findPlacement } from '../core/parser';
import { ConsoleMethod } from '../core/types';
import { ProjectDetector } from '../environment/project';
export async function insertLog(detector: ProjectDetector, method: ConsoleMethod): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const c = config(doc.uri);
  let detection = await detector.detect(doc.uri, c.environment, c.customCondition);
  if (!/^[A-Za-z0-9@_.-]+$/.test(c.marker)) {
    vscode.window.showErrorMessage(
      'DevLog marker must contain only letters, numbers, @, underscore, dot, or hyphen.',
    );
    return;
  }
  if (c.mode === 'helper' && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(c.helperName)) {
    vscode.window.showErrorMessage('DevLog helperName must be a valid JavaScript identifier.');
    return;
  }
  if (detection.id === 'unknown') {
    const selected = await vscode.window.showQuickPick(['Vite', 'Node.js', 'Next.js', 'Custom'], {
      placeHolder: 'Choose DevLog environment',
    });
    if (!selected) return;
    const value = selected === 'Node.js' ? 'node' : selected.toLowerCase().replace('.js', '');
    if (value === 'custom') {
      vscode.window.showErrorMessage(
        'Set devlog.customCondition and devlog.environment to custom before inserting.',
      );
      return;
    }
    await vscode.workspace
      .getConfiguration('devlog', doc.uri)
      .update('environment', value, vscode.ConfigurationTarget.WorkspaceFolder);
    detection = await detector.detect(doc.uri, value, c.customCondition);
  }
  const condition = conditionFor(detection.id, detection.condition ?? c.customCondition);
  if (!condition) {
    vscode.window.showErrorMessage(
      `DevLog cannot create a safe guard: ${detection.reasons.join(', ')}`,
    );
    return;
  }
  const text = doc.getText();
  const eol = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const inserts: { offset: number; text: string }[] = [];
  for (const selection of editor.selections) {
    const offset = doc.offsetAt(selection.active);
    const expr = detectExpression(
      text,
      doc.fileName,
      offset,
      selection.isEmpty ? undefined : doc.getText(selection),
    );
    const place = findPlacement(text, doc.fileName, offset);
    if (!expr || !place) continue;
    const line = doc.positionAt(offset).line + 1;
    inserts.push({
      offset: place.offset,
      text: generateLog({
        method,
        expression: expr,
        fileName: path.basename(doc.fileName),
        line,
        functionName: place.functionName,
        condition,
        indent: place.indent,
        eol,
        marker: c.marker,
        prefix: c.prefix,
        includeFileName: c.includeFileName,
        includeLineNumber: c.includeLineNumber,
        includeFunctionName: c.includeFunctionName,
        includeExpression: c.includeExpression,
        semicolons: c.useSemicolons,
        quote: c.quoteStyle,
        mode: c.mode,
        helperName: c.helperName,
        pretty: c.pretty,
      }),
    });
  }
  if (!inserts.length) {
    vscode.window.showWarningMessage(
      'DevLog could not identify a valid expression and insertion point. Select the expression explicitly.',
    );
    return;
  }
  const edit = new vscode.WorkspaceEdit();
  for (const i of inserts.sort((a, b) => b.offset - a.offset))
    edit.insert(doc.uri, doc.positionAt(i.offset), i.text);
  await vscode.workspace.applyEdit(edit);
}
