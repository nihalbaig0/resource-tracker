#!/usr/bin/env node
/**
 * Converts resource.md → per-category files in resources/categories/
 * Run: node scripts/build-resources.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'resource.md');
const outDir = path.join(root, 'resources', 'categories');

const DOMAIN_FIX = {
  'modal.com/gpu-glossary': 'https://modal.com/gpu-glossary',
  'siboehm.com': 'https://siboehm.com',
  'chipsandcheese.com': 'https://chipsandcheese.com',
  'veitner.bearblog.dev': 'https://veitner.bearblog.dev',
  'kapilsharma.dev': 'https://kapilsharma.dev',
  'proceduralpixels.com/blog': 'https://proceduralpixels.com/blog',
  'mlsys.wuklab.io': 'https://mlsys.wuklab.io',
};

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeUrl(raw) {
  let u = raw.replace(/[.,;)\]]+$/, '');
  if (DOMAIN_FIX[u]) return DOMAIN_FIX[u];
  if (!u.startsWith('http')) u = `https://${u}`;
  return u;
}

function extractUrls(line) {
  const urls = [];
  const titled = line.match(/^(.+?)\s*:\s*(https?:\/\/\S+)$/);
  if (titled) {
    urls.push({ title: titled[1].trim(), url: normalizeUrl(titled[2]) });
    return urls;
  }
  const bare = line.match(/^(https?:\/\/\S+)$/);
  if (bare) {
    urls.push({ title: '', url: normalizeUrl(bare[1]) });
    return urls;
  }
  for (const m of line.matchAll(/https?:\/\/[^\s)]+/g)) {
    urls.push({ title: '', url: normalizeUrl(m[0]) });
  }
  for (const [key, full] of Object.entries(DOMAIN_FIX)) {
    if (line.includes(key) && !urls.some((u) => u.url === full)) {
      urls.push({ title: '', url: full });
    }
  }
  return urls;
}

function parseResourceMd(text) {
  const categories = new Map();
  let cat = '';
  let sub = 'General';

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t === '# Resources') continue;
    if (t.startsWith('## ')) {
      cat = t.slice(3).trim();
      sub = 'General';
      if (!categories.has(cat)) categories.set(cat, new Map());
      continue;
    }
    if (t.startsWith('### ')) {
      sub = t.slice(4).trim();
      if (!categories.has(cat)) categories.set(cat, new Map());
      continue;
    }
    if (!cat) continue;

    const urls = extractUrls(t);
    if (!urls.length) continue;

    const subs = categories.get(cat);
    if (!subs.has(sub)) subs.set(sub, []);
    for (const item of urls) {
      const list = subs.get(sub);
      if (!list.some((x) => x.url === item.url)) list.push(item);
    }
  }
  return categories;
}

function toMarkdown(catName, subs) {
  const lines = [`# ${catName}`, ''];
  for (const [subName, items] of subs) {
    if (subName !== 'General') {
      lines.push(`## ${subName}`, '');
    }
    for (const { title, url } of items) {
      if (title) {
        lines.push(`- [${title}](${url})`);
      } else {
        lines.push(`- ${url}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

const text = fs.readFileSync(src, 'utf8');
const categories = parseResourceMd(text);

fs.mkdirSync(outDir, { recursive: true });

const manifest = [];

for (const [catName, subs] of categories) {
  const file = `${slugify(catName)}.md`;
  const md = toMarkdown(catName, subs);
  fs.writeFileSync(path.join(outDir, file), md);
  const count = [...subs.values()].reduce((n, arr) => n + arr.length, 0);
  manifest.push({ name: catName, file, count });
  console.log(`${file}: ${count} links`);
}

fs.writeFileSync(
  path.join(root, 'resources', 'manifest.json'),
  JSON.stringify({ categories: manifest }, null, 2) + '\n'
);

console.log(`\nWrote ${manifest.length} categories to resources/categories/`);
