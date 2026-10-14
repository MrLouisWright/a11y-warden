import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, parseColor, contrastRatio, fingerprint, RULES } from '../src/index.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const rules = (r) => r.findings.map((f) => f.rule);
const site = (files) => { const d = mkdtempSync(join(tmpdir(), 'aw-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; };
const page = (body) => `<!doctype html><html lang="en"><head><title>t</title></head><body><main>${body}</main></body></html>`;

test('good fixture is clean', () => { assert.deepEqual(check(fx('good')).findings, []); });
test('bad fixture reports every rule', () => { const r = rules(check(fx('bad'))); for (const k of Object.keys(RULES)) assert.ok(r.includes(k), k); });
test('colour parsing and contrast ratio', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 }); assert.equal(parseColor('rgb(0, 0, 0)').r, 0); assert.equal(parseColor('white').g, 255); assert.equal(parseColor('nope'), null);
  assert.equal(contrastRatio(parseColor('#000'), parseColor('#fff')).toFixed(0), '21');
  assert.ok(Math.abs(contrastRatio(parseColor('#767676'), parseColor('#fff')) - 4.54) < 0.01);
});
test('large text needs only 3:1; background inherited from ancestors', () => {
  assert.deepEqual(rules(check(site({ 'a.html': page('<p style="color:#888;font-size:24px">Big text</p>') }))), []);
  assert.ok(rules(check(site({ 'a.html': page('<div style="background-color:#000"><p style="color:#333">Dark on dark</p></div>') }))).includes('contrast-insufficient'));
});
test('labels: wrapping label, aria-labelledby, title count; placeholders do not', () => {
  assert.deepEqual(rules(check(site({ 'a.html': page('<label>N <input name="n"></label><span id="l">Q</span><input aria-labelledby="l"><input title="T">') }))), []);
  assert.deepEqual(rules(check(site({ 'a.html': page('<input placeholder="Search">') }))), ['input-label-missing']);
});
test('hidden content is skipped except aria-hidden focus traps', () => {
  assert.deepEqual(rules(check(site({ 'a.html': page('<div hidden><img src="x"></div><div aria-hidden="true"><img src="y"><a href="/" tabindex="-1">x</a></div>') }))), []);
});
test('baseline: update then only new findings are reported', () => {
  const d = site({ 'a.html': page('<img src="x">') });
  const bin = new URL('../bin/a11y-warden.js', import.meta.url).pathname; const bf = join(d, 'base.json');
  assert.equal(spawnSync(process.execPath, [bin, d, '--update-baseline', '--baseline', bf]).status, 0);
  assert.equal(JSON.parse(readFileSync(bf, 'utf8')).findings.length, 1);
  assert.equal(spawnSync(process.execPath, [bin, d, '--baseline', bf]).status, 0);
  writeFileSync(join(d, 'b.html'), page('<button></button>'));
  const r = spawnSync(process.execPath, [bin, d, '--baseline', bf, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.deepEqual(JSON.parse(r.stdout).findings.map((f) => f.rule), ['button-name-missing']);
  assert.match(fingerprint({ rule: 'x', file: 'a', subject: 's' }), /^x\|a\|s$/);
});
test('allowlist with expiry', () => {
  const d = site({ 'a.html': page('<img src="x">') });
  const r = check(d, { now: new Date('2026-10-14') }, { allowlist: [{ rule: 'img-alt-missing', file: 'a.html', reason: 'CMS fix pending', expires: '2026-12-31' }] });
  assert.equal(r.findings.length, 0); assert.equal(r.suppressed.length, 1);
});
test('CLI exit codes and formats', () => {
  const bin = new URL('../bin/a11y-warden.js', import.meta.url).pathname;
  const run = (...x) => spawnSync(process.execPath, [bin, ...x], { encoding: 'utf8' });
  assert.equal(run(fx('good'), '--fail-on', 'info').status, 0);
  assert.equal(run(fx('bad')).status, 1);
  assert.equal(run(fx('bad'), '--fail-on', 'none').status, 0);
  assert.equal(run('/nonexistent-dir-xyz').status, 2);
  const s = JSON.parse(run(fx('bad'), '--format', 'sarif', '--fail-on', 'none').stdout); assert.equal(s.version, '2.1.0');
  assert.match(run(fx('bad'), '--format', 'markdown', '--fail-on', 'none').stdout, /\| Severity \|/);
});
