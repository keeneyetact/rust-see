import { commands, ExtensionContext, services, Uri, workspace } from 'coc.nvim';
import { GenericNotificationHandler, Location, Position } from 'vscode-languageserver-protocol';
import * as cmds from './cmds';
import { Server } from './server';
import { StatusDisplay } from './cmds/watch_status';

export async function activate(context: ExtensionContext): Promise<void> {
  const run = Server.prepare();
  if (!run) {
    workspace.showMessage(`ra_lsp_server is not found, you need to build rust-analyzer from source`, 'error');
    const ret = await workspace.showQuickpick(['Yes', 'No'], 'Get ra_lsp_server?');
    if (ret === 0) {
      commands.executeCommand('vscode.open', 'https://github.com/rust-analyzer/rust-analyzer').catch(() => {});
    }
    return;
  }

  function registerCommand(name: string, f: any) {
    context.subscriptions.push(commands.registerCommand(name, f));
  }

  const watchStatus = new StatusDisplay(Server.config.cargoWatchOptions.command);
  context.subscriptions.push(watchStatus);

  // Notifications are events triggered by the language server
  // const allNotifications: Iterable<[string, GenericNotificationHandler]> = [['rust-analyzer/publishDecorations', notifications.publishDecorations.handle]];
  const allNotifications: Iterable<[string, GenericNotificationHandler]> = [['$/progress', params => watchStatus.handleProgressNotification(params)]];
  Server.start(allNotifications);
  if (Server.client) {
    context.subscriptions.push(services.registLanguageClient(Server.client));
  }

  // Commands are requests from vscode to the language server
  registerCommand('rust-analyzer.analyzerStatus', cmds.analyzerStatus.handler);
  registerCommand('rust-analyzer.matchingBrace', cmds.matchingBrace.handle);
  registerCommand('rust-analyzer.joinLines', cmds.joinLines.handle);
  registerCommand('rust-analyzer.parentModule', cmds.parentModule.handle);
  registerCommand('rust-analyzer.run', cmds.runnables.handle);
  registerCommand('rust-analyzer.runSingle', cmds.runnables.handleSingle);
  registerCommand('rust-analyzer.collectGarbage', () => Server.client.sendRequest<null>('rust-analyzer/collectGarbage', null));
  registerCommand('rust-analyzer.applySourceChange', cmds.applySourceChange.handle);
  registerCommand('rust-analyzer.syntaxTree', cmds.syntaxTree.handler);
  registerCommand('rust-analyzer.expandMacro', cmds.expandMacro.handler);
  registerCommand('rust-analyzer.showReferences', (uri: string, position: Position, locations: Location[]) => {
    // TODO
    return commands.executeCommand('editor.action.showReferences', Uri.parse(uri), position, locations);
  });

  registerCommand('rust-analyzer.reload', async () => {
    if (Server.client != null) {
      workspace.showMessage(`Reloading rust-analyzer...`);
      await Server.client.stop();
      Server.start(allNotifications);
    }
  });

  // if (Server.config.enableEnhancedTyping) {
  //   cmds.onEnter.handle();
  // }

  // const syntaxTreeContentProvider = new SyntaxTreeContentProvider();
  // vscode.window.onDidChangeActiveTextEditor(events.changeActiveTextEditor.makeHandler(syntaxTreeContentProvider));
  // disposeOnDeactivation(vscode.workspace.registerTextDocumentContentProvider('rust-analyzer', syntaxTreeContentProvider));
  // vscode.workspace.onDidChangeTextDocument(events.changeTextDocument.createHandler(syntaxTreeContentProvider), null, context.subscriptions);

  //   if (Server.config.displayInlayHints) {
  //     const hintsUpdater = new HintsUpdater();
  //     hintsUpdater.refreshHintsForVisibleEditors().then(() => {
  //       // vscode may ignore top level hintsUpdater.refreshHintsForVisibleEditors()
  //       // so update the hints once when the focus changes to guarantee their presence
  //       let editorChangeDisposable: vscode.Disposable | null = null;
  //       editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(_ => {
  //         if (editorChangeDisposable !== null) {
  //           editorChangeDisposable.dispose();
  //         }
  //         return hintsUpdater.refreshHintsForVisibleEditors();
  //       });

  //       disposeOnDeactivation(vscode.window.onDidChangeVisibleTextEditors(_ => hintsUpdater.refreshHintsForVisibleEditors()));
  //       disposeOnDeactivation(vscode.workspace.onDidChangeTextDocument(e => hintsUpdater.refreshHintsForVisibleEditors(e)));
  //       disposeOnDeactivation(vscode.workspace.onDidChangeConfiguration(_ => hintsUpdater.toggleHintsDisplay(Server.config.displayInlayHints)));
  //     });
  //   }
}

export function deactivate(): Thenable<void> {
  if (!Server.client) {
    return Promise.resolve();
  }
  return Server.client.stop();
}
