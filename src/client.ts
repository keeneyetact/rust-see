import { Executable, LanguageClient, LanguageClientOptions, ServerOptions, Uri, workspace } from 'coc.nvim';
import executable from 'executable';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import which from 'which';
import { Config } from './config';

function expandPathResolving(path: string) {
  if (path.startsWith('~/')) {
    return path.replace('~', homedir());
  }
  return path;
}

export function resolveBin(config: Config, serverRoot: string): string | undefined {
  // 1. from config
  // 2. in PATH
  // 3. in coc-server-root
  let bin = expandPathResolving(config.raLspServerPath);
  if (bin === 'ra_lsp_server') {
    bin = which.sync(bin, { nothrow: true }) || join(serverRoot, bin);
  }

  if (!existsSync(bin)) {
    return;
  }

  if (!executable.sync(bin)) {
    workspace.showMessage(`${bin} is not executable`, 'error');
    return;
  }

  return bin;
}

export function createClient(config: Config, serverRoot: string): LanguageClient | undefined {
  const bin = resolveBin(config, serverRoot);
  if (!bin) {
    return;
  }

  let folder = '.';
  if (workspace.workspaceFolder?.uri.length > 0) {
    folder = Uri.parse(workspace.workspaceFolder.uri).fsPath;
  }

  const run: Executable = {
    command: bin,
    options: { cwd: folder }
  };

  const serverOptions: ServerOptions = {
    run,
    debug: run
  };
  const outputChannel = workspace.createOutputChannel('Rust Analyzer Language Server Trace');
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'rust' }, { pattern: 'Cargo.toml' }],
    initializationOptions: {
      publishDecorations: false,
      lruCapacity: config.lruCapacity,
      cargoWatchEnable: config.cargoWatchOptions.enable,
      cargoWatchArgs: config.cargoWatchOptions.arguments,
      cargoWatchCommand: config.cargoWatchOptions.command,
      cargoWatchAllTargets: config.cargoWatchOptions.allTargets,
      excludeGlobs: config.excludeGlobs,
      useClientWatching: config.useClientWatching,
      cargoFeatures: config.cargoFeatures,
      featureFlags: config.featureFlags
    },
    outputChannel
  };

  const client = new LanguageClient('rust-analyzer', 'Rust Analyzer Language Server', serverOptions, clientOptions);
  // HACK: This is an awful way of filtering out the decorations notifications
  // However, pending proper support, this is the most effecitve approach
  // Proper support for this would entail a change to vscode-languageclient to allow not notifying on certain messages
  // Or the ability to disable the serverside component of highlighting (but this means that to do tracing we need to disable hihlighting)
  // This also requires considering our settings strategy, which is work which needs doing
  // @ts-ignore The tracer is private to vscode-languageclient, but we need access to it to not log publishDecorations requests
  client._tracer = {
    log: (messageOrDataObject: string | any, data?: string) => {
      if (typeof messageOrDataObject === 'string') {
        if (messageOrDataObject.includes('rust-analyzer/publishDecorations') || messageOrDataObject.includes('rust-analyzer/decorationsRequest')) {
          // Don't log publish decorations requests
        } else {
          // @ts-ignore This is just a utility function
          client.logTrace(messageOrDataObject, data);
        }
      } else {
        // @ts-ignore
        client.logObjectTrace(messageOrDataObject);
      }
    }
  };
  client.registerProposedFeatures();
  return client;
}