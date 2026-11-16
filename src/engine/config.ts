import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export interface DittoConfig {
  case: string;
  title: string;
  spec: string;
  suite: string;
  /** Either a folder Ditto serves on `port`, or the `url` of an app you already run. */
  legacy: { label: string; framework: string; dir?: string; url?: string; port: number; source?: string; publishAs?: string };
  /** `url`: a rewrite that is already running or deployed (Ditto then neither builds nor serves it). `publishAs`: folder name on the published site. */
  rewrite: { label: string; framework: string; repo: string; build: string; dist: string; port: number; source?: string; url?: string; publishAs?: string };
  agent: { model?: string; portPrompt: string; maxTurnsPort?: number; maxTurnsFix?: number };
  /** The behaviour the console opens on when none needed a fix. */
  namedExample?: string;
  /** One line shown under the console's title for this case. */
  note?: string;
  /** Short name for the console's run switcher (defaults to one derived from the title). */
  tab?: string;
  /** Keep this case out of the run switcher (it is linked from another case, e.g. a scan of other builds). */
  unlisted?: boolean;
  /** Which part of Kane's screenshots the console shows in its small frames (CSS percentages for the image). */
  frame?: { left: number; top: number; width: number };
  /** Reuse the oracle (recordings and results) of another case instead of recording the legacy app again. */
  oracleCase?: string;
  /** Values for the {{placeholders}} Kane declared when it designed the tests (start_url is filled in per app). */
  variables?: Record<string, string>;
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
    legacyUrl: cfg.legacy.url ?? `http://127.0.0.1:${cfg.legacy.port}/`,
    rewriteUrl: cfg.rewrite.url ?? `http://127.0.0.1:${cfg.rewrite.port}/`,
  };
}
