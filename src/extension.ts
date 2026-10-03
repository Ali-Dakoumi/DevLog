import * as vscode from 'vscode';
import { ProjectDetector } from './environment/project';
import { insertLog } from './commands/insertLog';
import {
  checkSafety,
  convert,
  findAll,
  removeCurrent,
  removeWorkspace,
  toggleComments,
} from './commands/actions';
import { Diagnostics } from './diagnostics/diagnostics';
import { config } from './config/configuration';
export function activate(context: vscode.ExtensionContext): void {
  const detector = new ProjectDetector(),
    diagnostics = new Diagnostics();
  const reg = (id: string, fn: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  reg('devlog.insertLog', () => insertLog(detector, 'log'));
  reg('devlog.insertWarning', () => insertLog(detector, 'warn'));
  reg('devlog.insertError', () => insertLog(detector, 'error'));
  reg('devlog.insertInfo', () => insertLog(detector, 'info'));
  reg('devlog.insertTable', () => insertLog(detector, 'table'));
  reg('devlog.removeCurrentFile', removeCurrent);
  reg('devlog.removeWorkspace', removeWorkspace);
  reg('devlog.commentAll', () => toggleComments(true));
  reg('devlog.uncommentAll', () => toggleComments(false));
  reg('devlog.findAll', findAll);
  reg('devlog.convert', () => convert(detector));
  reg('devlog.checkSafety', checkSafety);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  status.command = 'devlog.checkSafety';
  status.text = '$(shield) DevLog';
  status.tooltip = 'Run DevLog production-safety check';
  if (config().statusBar) status.show();
  context.subscriptions.push(detector, diagnostics, status);
}
export function deactivate(): void {}
