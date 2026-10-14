// a11y-warden: WCAG 2.2 static HTML audit with baseline support. Louis Wright, MIT.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions, textOf, ancestor } from './site.js';
import { buildReport, UsageError } from './core.js';

export * from './core.js';
export { SITE_OPTIONS, SITE_HELP, siteOptions };

export const RULES = {
  'img-alt-missing': { severity: 'high', title: 'Image has no alt attribute (WCAG 1.1.1)' },
  'img-alt-suspicious': { severity: 'medium', title: 'Alt text is a file name, placeholder or redundant ("image of") (WCAG 1.1.1)' },
  'input-label-missing': { severity: 'high', title: 'Form control has no accessible name (label, aria-label, aria-labelledby, title) (WCAG 1.3.1, 4.1.2)' },
  'button-name-missing': { severity: 'high', title: 'Button has no accessible name (WCAG 4.1.2)' },
  'link-name-missing': { severity: 'high', title: 'Link has no accessible name (WCAG 2.4.4, 4.1.2)' },
  'link-name-generic': { severity: 'low', title: 'Link text is generic ("click here", "read more") without context (WCAG 2.4.4)' },
  'html-lang-missing': { severity: 'medium', title: '<html> has no valid lang attribute (WCAG 3.1.1)' },
  'page-title-missing': { severity: 'medium', title: 'Page has no <title> (WCAG 2.4.2)' },
  'landmark-main-missing': { severity: 'low', title: 'Page has no <main> landmark (WCAG 1.3.1, 2.4.1)' },
  'landmark-main-multiple': { severity: 'low', title: 'Page has more than one visible <main> landmark' },
  'contrast-insufficient': { severity: 'high', title: 'Inline text colour contrast is below 4.5:1 (3:1 for large text) (WCAG 1.4.3)' },
  'duplicate-id': { severity: 'medium', title: 'id is used more than once and is referenced by ARIA or a label (WCAG 4.1.1/1.3.1)' },
  'aria-role-invalid': { severity: 'medium', title: 'role attribute is not a valid WAI-ARIA role (WCAG 4.1.2)' },
  'aria-reference-missing': { severity: 'medium', title: 'aria-labelledby / aria-describedby / for points at a missing id' },
  'aria-hidden-focusable': { severity: 'high', title: 'aria-hidden="true" element is or contains a focusable element (WCAG 4.1.2)' },
  'tabindex-positive': { severity: 'medium', title: 'tabindex greater than 0 disrupts focus order (WCAG 2.4.3)' },
  'iframe-title-missing': { severity: 'medium', title: '<iframe> has no title (WCAG 4.1.2)' },
  'viewport-zoom-disabled': { severity: 'high', title: 'meta viewport disables zoom (user-scalable=no or maximum-scale < 2) (WCAG 1.4.4)' },
  'media-autoplay': { severity: 'medium', title: 'Audio/video autoplays with sound and no controls (WCAG 1.4.2)' },
  'table-header-missing': { severity: 'low', title: 'Data table has no <th> header cells (WCAG 1.3.1)' },
  'svg-name-missing': { severity: 'low', title: 'Standalone <svg role="img"> has no accessible name (WCAG 1.1.1)' },
  'focus-outline-removed': { severity: 'medium', title: 'Inline style removes the focus outline (outline: none/0) (WCAG 2.4.7)' },
};

const ROLES = new Set('alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem doc-abstract doc-acknowledgments doc-afterword doc-appendix doc-backlink doc-biblioentry doc-bibliography doc-biblioref doc-chapter doc-colophon doc-conclusion doc-cover doc-credit doc-credits doc-dedication doc-endnote doc-endnotes doc-epigraph doc-epilogue doc-errata doc-example doc-footnote doc-foreword doc-glossary doc-glossref doc-index doc-introduction doc-noteref doc-notice doc-pagebreak doc-pagelist doc-part doc-preface doc-prologue doc-pullquote doc-qna doc-subtitle doc-tip doc-toc graphics-document graphics-object graphics-symbol'.split(' '));
const GENERIC_LINKS = /^(click here|here|read more|more|learn more|link|this|continue|details|more info|go)$/i;
const NAMED = ['aria-label', 'aria-labelledby', 'title'];

// ---- colour contrast
const NAMED_COLORS = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0', yellow: '#ffff00', orange: '#ffa500', navy: '#000080', maroon: '#800000', purple: '#800080', teal: '#008080', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff', olive: '#808000', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc' };
export function parseColor(v) {
  if (!v) return null; v = String(v).trim().toLowerCase(); if (NAMED_COLORS[v]) v = NAMED_COLORS[v];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]) : 1 };
  return null;
}
const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export function contrastRatio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
const styleOf = (el) => { const o = {}; for (const d of String(el.attrs?.style || '').split(';')) { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim().replace(/\s*!important$/, ''); } return o; };

// ---- baseline
export const fingerprint = (f) => `${f.rule}|${f.file || ''}|${f.subject || ''}`;
export function loadBaseline(file) { if (!file || !existsSync(file)) return null; try { const j = JSON.parse(readFileSync(file, 'utf8')); return new Set(j.findings || []); } catch (e) { throw new UsageError(`Cannot read baseline ${file}: ${e.message}`); } }
export function writeBaseline(file, findings) { writeFileSync(file, JSON.stringify({ tool: 'a11y-warden', created: new Date().toISOString().slice(0, 10), findings: [...new Set(findings.map(fingerprint))].sort() }, null, 2) + '\n'); }

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  for (const pg of site.pages) {
    const doc = pg.doc; const at = (e) => ({ file: pg.file, line: e?.line });
    const ids = new Map(); for (const e of doc.all) if (e.attrs.id) ids.set(e.attrs.id, (ids.get(e.attrs.id) || 0) + 1);
    const byId = (id) => doc.all.find((e) => e.attrs.id === id);
    const hidden = (e) => e.attrs.hidden != null || e.attrs['aria-hidden'] === 'true' || !!ancestor(e, (n) => n.attrs?.hidden != null || n.attrs?.['aria-hidden'] === 'true');
    const named = (e) => NAMED.some((k) => (k === 'aria-labelledby' ? String(e.attrs[k] || '').split(/\s+/).some((id) => id && byId(id) && textOf(byId(id))) : String(e.attrs[k] || '').trim()));
    const sub = (e, extra = '') => `${pg.path}#${e.tag}${e.attrs.id ? '#' + e.attrs.id : ''}${extra}@${e.line}`;
    const html = doc.all.find((e) => e.tag === 'html');
    if (!html || !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(html.attrs.lang || '')) add('html-lang-missing', pg.path, `${pg.path}: <html> ${html?.attrs.lang ? `lang="${html.attrs.lang}" is invalid` : 'has no lang'}`, 'Add <html lang="en"> (or the page language).', at(html));
    if (!doc.title) add('page-title-missing', pg.path, `${pg.path} has no <title>`, 'Add a descriptive <title>.', { file: pg.file });
    const mains = doc.all.filter((e) => (e.tag === 'main' || e.attrs.role === 'main') && !hidden(e));
    if (!mains.length && doc.all.some((e) => e.tag === 'body' || e.tag === 'p')) add('landmark-main-missing', pg.path, `${pg.path} has no <main>`, 'Wrap the primary content in <main>.', { file: pg.file });
    else if (mains.length > 1) add('landmark-main-multiple', pg.path, `${pg.path} has ${mains.length} <main> landmarks`, 'Keep one visible <main>.', at(mains[1]));
    const vp = doc.meta('viewport')[0];
    if (vp) { const c = String(vp.content || '').toLowerCase(); const mx = /maximum-scale\s*=\s*([\d.]+)/.exec(c); if (/user-scalable\s*=\s*(no|0)/.test(c) || (mx && +mx[1] < 2)) add('viewport-zoom-disabled', pg.path, `meta viewport "${vp.content}" blocks zooming`, 'Remove user-scalable=no and maximum-scale.', at(vp)); }
    for (const e of doc.all) {
      if (hidden(e) && e.tag !== 'html') { if (e.attrs['aria-hidden'] === 'true') { const foc = [e, ...doc.all.filter((x) => ancestor(x, (n) => n === e))].find((x) => (['a', 'button', 'input', 'select', 'textarea'].includes(x.tag) && (x.tag !== 'a' || x.attrs.href != null) && x.attrs.disabled == null && x.attrs.tabindex !== '-1') || (x.attrs.tabindex != null && +x.attrs.tabindex >= 0)); if (foc) add('aria-hidden-focusable', sub(e), `aria-hidden element contains focusable <${foc.tag}>`, 'Remove aria-hidden, or make the content non-focusable (tabindex="-1", inert).', at(e)); } continue; }
      const st = styleOf(e);
      if (e.tag === 'img' && e.attrs.role !== 'presentation' && e.attrs.role !== 'none') {
        if (e.attrs.alt == null && !named(e)) add('img-alt-missing', sub(e, e.attrs.src ? ':' + e.attrs.src : ''), `<img src="${e.attrs.src || ''}"> has no alt`, 'Add alt text describing the image, or alt="" if it is decorative.', at(e));
        else if (e.attrs.alt && (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(e.attrs.alt.trim()) || /^(image|img|photo|picture|graphic|untitled|placeholder|alt|dsc_?\d+|img_?\d+)$/i.test(e.attrs.alt.trim()) || /^(image|picture|photo) of\b/i.test(e.attrs.alt.trim()))) add('img-alt-suspicious', sub(e), `alt="${e.attrs.alt}" is not a useful description`, 'Describe what the image shows or does; screen readers already announce "image".', at(e));
      }
      if (e.tag === 'input' || e.tag === 'select' || e.tag === 'textarea') {
        const type = (e.attrs.type || 'text').toLowerCase();
        if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) { if (['submit', 'reset', 'button'].includes(type) && !e.attrs.value && !named(e) && type === 'button') add('button-name-missing', sub(e), '<input type="button"> has no value or label', 'Add value="…" or aria-label.', at(e)); if (type === 'image' && e.attrs.alt == null && !named(e)) add('img-alt-missing', sub(e), '<input type="image"> has no alt', 'Add alt text describing the action.', at(e)); }
        else { const lbl = (e.attrs.id && doc.all.some((x) => x.tag === 'label' && x.attrs.for === e.attrs.id && textOf(x, { alt: true }))) || !!ancestor(e, (n) => n.tag === 'label' && textOf(n, { alt: true })); if (!lbl && !named(e)) add('input-label-missing', sub(e, e.attrs.name ? ':' + e.attrs.name : ''), `<${e.tag}${e.attrs.name ? ` name="${e.attrs.name}"` : ''}> has no label${e.attrs.placeholder ? ' (placeholder is not a label)' : ''}`, 'Add <label for="id">, wrap it in <label>, or use aria-label.', at(e)); }
      }
      if ((e.tag === 'button' || e.attrs.role === 'button') && !textOf(e, { alt: true }) && !named(e) && !e.children.some((c) => c.tag === 'svg' && (c.children.some((x) => x.tag === 'title') || c.attrs['aria-label']))) add('button-name-missing', sub(e), `<${e.tag}> has no accessible name`, 'Add visible text, or aria-label for icon buttons.', at(e));
      if (e.tag === 'a' && e.attrs.href != null) {
        const t = textOf(e, { alt: true });
        const svgName = e.children.some((c) => c.tag === 'svg' && (c.children.some((x) => x.tag === 'title') || c.attrs['aria-label']));
        if (!t && !named(e) && !svgName) add('link-name-missing', sub(e, ':' + e.attrs.href), `<a href="${e.attrs.href}"> has no accessible name`, 'Add link text, alt text on the image inside it, or aria-label.', at(e));
        else if (t && GENERIC_LINKS.test(t.trim()) && !named(e)) add('link-name-generic', sub(e, ':' + e.attrs.href), `Link text "${t}" (${e.attrs.href}) does not say where it goes`, 'Use descriptive link text, or add aria-label / visually hidden context.', at(e));
      }
      if (e.attrs.role) for (const r of e.attrs.role.trim().split(/\s+/)) if (!ROLES.has(r.toLowerCase())) { add('aria-role-invalid', sub(e, ':' + r), `role="${r}" is not a WAI-ARIA role`, 'Use a valid role or remove it.', at(e)); break; }
      for (const k of ['aria-labelledby', 'aria-describedby', 'aria-controls']) if (e.attrs[k]) for (const id of e.attrs[k].trim().split(/\s+/)) if (!ids.has(id)) add('aria-reference-missing', sub(e, ':' + k + '=' + id), `${k}="${id}" points to no element`, `Add id="${id}" to the referenced element or fix the reference.`, at(e));
      if (e.tag === 'label' && e.attrs.for && !ids.has(e.attrs.for)) add('aria-reference-missing', sub(e, ':for=' + e.attrs.for), `<label for="${e.attrs.for}"> points to no element`, 'Match the label "for" to the control id.', at(e));
      if (e.attrs.tabindex != null && +e.attrs.tabindex > 0) add('tabindex-positive', sub(e), `tabindex="${e.attrs.tabindex}" on <${e.tag}>`, 'Use tabindex="0" (or none) and fix the DOM order instead.', at(e));
      if ((e.tag === 'iframe' || e.tag === 'frame') && !named(e) && e.attrs['aria-hidden'] !== 'true') add('iframe-title-missing', sub(e, e.attrs.src ? ':' + e.attrs.src : ''), `<iframe src="${e.attrs.src || ''}"> has no title`, 'Add title="…" describing the embedded content.', at(e));
      if ((e.tag === 'video' || e.tag === 'audio') && e.attrs.autoplay != null && e.attrs.muted == null && e.attrs.controls == null) add('media-autoplay', sub(e), `<${e.tag}> autoplays with sound and no controls`, 'Add muted or controls, or do not autoplay.', at(e));
      if (e.tag === 'table' && e.attrs.role !== 'presentation' && e.attrs.role !== 'none') { const rows = doc.all.filter((x) => x.tag === 'tr' && ancestor(x, (n) => n.tag === 'table') === e); if (rows.length >= 2 && !doc.all.some((x) => x.tag === 'th' && ancestor(x, (n) => n.tag === 'table') === e)) add('table-header-missing', sub(e), `Table with ${rows.length} rows has no <th>`, 'Mark header cells with <th scope="col|row">, or role="presentation" for layout tables.', at(e)); }
      if (e.tag === 'svg' && e.attrs.role === 'img' && !named(e) && !e.children.some((x) => x.tag === 'title' && textOf(x))) add('svg-name-missing', sub(e), '<svg role="img"> has no accessible name', 'Add <title> as first child, or aria-label.', at(e));
      if (/^(none|0)(px)?$/.test(st.outline || st['outline-style'] || '')) add('focus-outline-removed', sub(e), `Inline style "outline: ${st.outline || st['outline-style']}" on <${e.tag}>`, 'Keep a visible focus indicator (e.g. :focus-visible outline).', at(e));
      if (st.color) {
        const fg = parseColor(st.color); let bg = null;
        for (let n = e; n && n.tag; n = n.parent) { const s = styleOf(n); const b = parseColor(s['background-color'] || (s.background && !/url\(|gradient/.test(s.background) ? s.background.split(/\s+/)[0] : null)); if (b) { bg = b; break; } }
        bg ||= parseColor(config.defaultBackground || '#ffffff');
        if (fg && bg && fg.a === 1 && bg.a === 1 && textOf(e)) {
          const size = parseFloat(st['font-size']) || 16; const bold = /bold|[6-9]00/.test(st['font-weight'] || '') || /^(h[1-6]|strong|b|th)$/.test(e.tag);
          const large = size >= 24 || (bold && size >= 18.66) || /^h[12]$/.test(e.tag);
          const need = large ? 3 : 4.5; const r = contrastRatio(fg, bg);
          if (r < need) add('contrast-insufficient', sub(e), `Text "${textOf(e).slice(0, 40)}" has contrast ${r.toFixed(2)}:1 (${st.color} on ${bg === null ? '?' : `rgb(${bg.r},${bg.g},${bg.b})`}), needs ${need}:1`, 'Darken the text or lighten the background.', at(e));
        }
      }
    }
    const referenced = new Set(); for (const e of doc.all) { for (const k of ['aria-labelledby', 'aria-describedby', 'aria-controls']) for (const id of String(e.attrs[k] || '').split(/\s+/)) if (id) referenced.add(id); if (e.tag === 'label' && e.attrs.for) referenced.add(e.attrs.for); }
    for (const [id, n] of ids) if (n > 1 && (referenced.has(id) || opts.strictIds || config.strictIds)) add('duplicate-id', `${pg.path}#${id}`, `id="${id}" is used ${n} times${referenced.has(id) ? ' and referenced by a label/ARIA attribute' : ''}`, 'Make ids unique.', at(doc.all.filter((e) => e.attrs.id === id)[1]));
  }
  return { findings, info: { pages: site.pages.length }, summary: `${site.pages.length} page(s) audited` };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'a11y-warden', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '♿', defaultFile: 'index.html' };
  const r = runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, (site, o, c) => {
    const res = analyze(site, o, c);
    const base = opts.baseline instanceof Set ? opts.baseline : null;
    if (base) { const kept = res.findings.filter((f) => !base.has(fingerprint(f))); res.info = { ...res.info, baselined: res.findings.length - kept.length }; res.findings = kept; }
    return res;
  }, buildReport);
  return r;
}
