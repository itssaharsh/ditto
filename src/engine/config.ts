import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export interface DittoConfig {
  case: string;
  title: string;
  spec: string;
  suite: string;
  legacy: { label: string; framework: string; dir: string; port: number; source?: string };
  rewrite: { label: string; framework: string; repo: string; build: string; dist: string; port: number; source?: string };
  agent: { model?: string; portPrompt: string; maxTurnsPort?: number; maxTurnsFix?: number };
  parallel: number;
  maxRounds: number;
  creditCap: number;
  /** Folder Kane runs in; recordings and evidence copies stay out of your repos. */
  workDir: string;
  casesDir: string;
}

export interface LoadedConfig extends DittoConfig {
  root: string;
  abs: (p: string) => string;
  legacyUrl: string;
  rewriteUrl: string;
}

export function loadConfig(file = 'ditto.config.json'): LoadedConfig {
  const path = resolve(file);
  const root = dirname(path);
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as DittoConfig;
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(root, p));
  return {
    ...cfg,
    root,
    abs,
    legacyUrl: `http://127.0.0.1:${cfg.legacy.port}/`,
    rewriteUrl: `http://127.0.0.1:${cfg.rewrite.port}/`,
  };
}
