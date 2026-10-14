import type { Report, Rule, Finding } from './core.js';
export * from './core.js';
export interface A11yOptions {
  baseUrl?: string; include?: string[]; exclude?: string[]; cleanUrls?: boolean;
  /** Fingerprints to ignore (see loadBaseline). */
  baseline?: Set<string> | null;
  /** Report every duplicate id, not only referenced ones. */
  strictIds?: boolean;
  now?: Date; toolVersion?: string; [option: string]: unknown;
}
export declare const RULES: Record<string, Rule>;
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
export declare function check(dir: string, opts?: A11yOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: A11yOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown>; summary: string };
export declare function parseColor(value: string): { r: number; g: number; b: number; a: number } | null;
export declare function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number;
export declare function fingerprint(f: Finding): string;
export declare function loadBaseline(file: string): Set<string> | null;
export declare function writeBaseline(file: string, findings: Finding[]): void;
