#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mainCli, check, analyze, RULES, SITE_OPTIONS, SITE_HELP, loadBaseline, writeBaseline } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mainCli({
  name: 'a11y-warden', version: pkg.version, configKey: 'a11yWarden', rules: RULES,
  tagline: 'WCAG 2.2 audit of static HTML with baseline support',
  usage: 'Usage: a11y-warden [site-dir] [options]',
  help: `${SITE_HELP}Baseline
      --baseline <file>        Ignore findings recorded in this baseline file (default: .a11y-baseline.json if present)
      --update-baseline        Write all current findings to the baseline file and exit 0
      --strict-ids             Report every duplicate id, not only referenced ones
`,
  options: { ...SITE_OPTIONS, baseline: { type: 'string' }, 'update-baseline': { type: 'boolean' }, 'strict-ids': { type: 'boolean' } },
  run: async ({ dir, values: o, config, configFile }) => {
    const bf = resolve(o.baseline || config.baseline || '.a11y-baseline.json');
    if (o['update-baseline']) { const r = check(dir, { cli: o, strictIds: o['strict-ids'], toolVersion: pkg.version }, { ...config, allowlist: [] }, configFile); writeBaseline(bf, r.findings.filter((f) => RULES[f.rule])); process.stderr.write(`a11y-warden: wrote ${r.findings.length} finding(s) to ${bf}\n`); return { ...r, findings: [], counts: Object.fromEntries(Object.keys(r.counts).map((k) => [k, 0])) }; }
    return check(dir, { cli: o, strictIds: o['strict-ids'], baseline: loadBaseline(bf), toolVersion: pkg.version }, config, configFile);
  },
});
void analyze;
