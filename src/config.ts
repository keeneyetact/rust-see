import { workspace, commands } from 'coc.nvim';

export interface CargoWatchOptions {
  enable: boolean;
  arguments: string[];
  command: string;
  allTargets: boolean;
}

export interface CargoFeatures {
  noDefaultFeatures: boolean;
  allFeatures: boolean;
  features: string[];
}

export class Config {
  public highlightingOn = true;
  public rainbowHighlightingOn = false;
  public enableEnhancedTyping = true;
  public raLspServerPath = '';
  public lruCapacity: null | number = null;
  public displayInlayHints = true;
  public excludeGlobs: string[] = [];
  public useClientWatching = true;
  public featureFlags = {};
  public cargoWatchOptions: CargoWatchOptions = {
    enable: true,
    arguments: [],
    command: '',
    allTargets: true
  };
  public cargoFeatures: CargoFeatures = {
    noDefaultFeatures: false,
    allFeatures: true,
    features: []
  };

  private prevEnhancedTyping: null | boolean = null;
  private prevCargoFeatures: null | CargoFeatures = null;
  private prevCargoWatchOptions: null | CargoWatchOptions = null;

  constructor() {
    workspace.onDidChangeConfiguration(() => this.userConfigChanged());
    this.userConfigChanged();
  }

  public userConfigChanged() {
    const config = workspace.getConfiguration('rust-analyzer');
    let requireReloadMessage = '';

    if (config.has('highlightingOn')) {
      this.highlightingOn = config.get('highlightingOn') as boolean;
    }

    if (config.has('rainbowHighlightingOn')) {
      this.rainbowHighlightingOn = config.get('rainbowHighlightingOn') as boolean;
    }

    // if (!this.highlightingOn && Server) {
    //   // Server.highlighter.removeHighlights();
    // }

    if (config.has('enableEnhancedTyping')) {
      this.enableEnhancedTyping = config.get('enableEnhancedTyping') as boolean;

      if (this.prevEnhancedTyping === null) {
        this.prevEnhancedTyping = this.enableEnhancedTyping;
      }
    } else if (this.prevEnhancedTyping === null) {
      this.prevEnhancedTyping = this.enableEnhancedTyping;
    }

    if (this.prevEnhancedTyping !== this.enableEnhancedTyping) {
      requireReloadMessage = 'Changing enhanced typing setting requires a reload';
      this.prevEnhancedTyping = this.enableEnhancedTyping;
    }

    if (config.has('raLspServerPath')) {
      this.raLspServerPath = config.get<string>('raLspServerPath', '');
    }

    if (config.has('cargo-watch.enable')) {
      this.cargoWatchOptions.enable = config.get<boolean>('cargo-watch.enable', true);
    }

    if (config.has('cargo-watch.arguments')) {
      this.cargoWatchOptions.arguments = config.get<string[]>('cargo-watch.arguments', []);
    }

    if (config.has('cargo-watch.command')) {
      this.cargoWatchOptions.command = config.get<string>('cargo-watch.command', '');
    }

    if (config.has('cargo-watch.allTargets')) {
      this.cargoWatchOptions.allTargets = config.get<boolean>('cargo-watch.allTargets', true);
    }

    if (config.has('lruCapacity')) {
      this.lruCapacity = config.get('lruCapacity') as number;
    }

    if (config.has('displayInlayHints')) {
      this.displayInlayHints = config.get('displayInlayHints') as boolean;
    }
    if (config.has('excludeGlobs')) {
      this.excludeGlobs = config.get('excludeGlobs', []);
    }
    if (config.has('useClientWatching')) {
      this.useClientWatching = config.get('useClientWatching', true);
    }
    if (config.has('featureFlags')) {
      this.featureFlags = config.get('featureFlags', {});
    }
    if (config.has('cargoFeatures.noDefaultFeatures')) {
      this.cargoFeatures.noDefaultFeatures = config.get('cargoFeatures.noDefaultFeatures', false);
    }
    if (config.has('cargoFeatures.allFeatures')) {
      this.cargoFeatures.allFeatures = config.get('cargoFeatures.allFeatures', true);
    }
    if (config.has('cargoFeatures.features')) {
      this.cargoFeatures.features = config.get('cargoFeatures.features', []);
    }

    if (this.prevCargoFeatures !== null) {
      const changed =
        this.cargoFeatures.allFeatures !== this.prevCargoFeatures.allFeatures ||
        this.cargoFeatures.noDefaultFeatures !== this.prevCargoFeatures.noDefaultFeatures ||
        this.cargoFeatures.features.length !== this.prevCargoFeatures.features.length ||
        this.cargoFeatures.features.some((v, i) => v !== this.prevCargoFeatures!.features[i]);
      if (changed) {
        requireReloadMessage = 'Changing cargo features requires a reload';
      }
    }
    this.prevCargoFeatures = { ...this.cargoFeatures };

    if (this.prevCargoWatchOptions !== null) {
      const changed =
        this.cargoWatchOptions.enable !== this.prevCargoWatchOptions.enable ||
        this.cargoWatchOptions.command !== this.prevCargoWatchOptions.command ||
        this.cargoWatchOptions.allTargets !== this.prevCargoWatchOptions.allTargets ||
        this.cargoWatchOptions.arguments.length !== this.prevCargoWatchOptions.arguments.length ||
        this.cargoWatchOptions.arguments.some((v, i) => v !== this.prevCargoWatchOptions!.arguments[i]);
      if (changed) {
        requireReloadMessage = 'Changing cargo-watch options requires a reload';
      }
    }
    this.prevCargoWatchOptions = { ...this.cargoWatchOptions };

    if (requireReloadMessage) {
      workspace.showPrompt(`${requireReloadMessage}. Reload Now?`).then(prompt => {
        if (prompt) {
          commands.executeCommand(`workbench.action.reloadWindow`);
        }
      });
    }
  }
}
