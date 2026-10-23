import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = fs.readFileSync(new URL('../src/i18n/catalog.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { locales, messages, resolveLocale, translate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const errorSource = fs.readFileSync(new URL('../src/i18n/errors.ts', import.meta.url), 'utf8');
const errorCode = ts.transpileModule(errorSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { errorMessageKey } = await import(`data:text/javascript;base64,${Buffer.from(errorCode).toString('base64')}`);
test('backend error categories have translations in every locale and unknown errors use a safe fallback', () => {
  const cases = {
    'no working directory or binary path set': 'error.workingDirectory',
    'noalbs binary not found; download it or set a manual path': 'error.binaryMissing',
    'noalbs is not running': 'error.notRunning',
    'already running': 'error.alreadyRunning',
    'no backup found': 'error.backupMissing',
    'no release asset found for this OS/architecture': 'error.noAsset',
    'io error: access denied': 'error.io',
    'http error: timeout': 'error.http',
    'json error: missing field `switcher`': 'error.json',
    'zip error: invalid archive': 'error.archive',
    'extraction task failed: interrupted': 'error.archive',
    'unexpected backend failure': 'error.unknown',
    'toString': 'error.unknown',
  };
  for (const [error, key] of Object.entries(cases)) {
    assert.equal(errorMessageKey(error), key);
    for (const locale of locales) {
      assert.ok(messages[locale][key]);
      assert.notEqual(translate(locale, key), key);
      if (locale !== 'en') assert.notEqual(translate(locale, key), translate('en', key));
    }
  }
});
test('all five catalogs have non-empty translations and identical interpolation parameters', () => {
  const parameters = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale]), Object.keys(messages.en));
    for (const [key, value] of Object.entries(messages[locale])) {
      assert.ok(value.trim(), `${locale}: ${key}`);
      assert.deepEqual(parameters(value), parameters(key), `${locale}: ${key}`);
    }
  }
});
test('language negotiation handles traditional and simplified Chinese and falls back safely', () => {
  for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-US']) assert.equal(resolveLocale([tag]), 'zh-TW');
  for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans']) assert.equal(resolveLocale([tag]), 'zh-CN');
  assert.equal(resolveLocale(['fr-FR', 'ja-JP']), 'ja');
  assert.equal(resolveLocale(['ko-KR']), 'ko');
  assert.equal(resolveLocale(['fr']), 'en');
});
test('interpolation preserves user values including JSON, tokens and dollar signs', () => {
  const value = '{"normal":"Low","language":"EN","token":"$&"}';
  assert.equal(translate('zh-TW', 'user: {user}', { user: value }), `使用者：${value}`);
  assert.equal(translate('ja', 'unknown.source.key'), 'unknown.source.key');
});

test('UI literal messages have translations and JSX contains only approved technical names', () => {
  const approved = new Set(['N', 'NOALBS', 'NOALBS /', 'noalbs', 'OBS', 'Twitch', 'Kick', 'RTT']);
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.tsx') ? [file] : [];
  });
  for (const file of walk(root)) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isJsxText(node)) {
        const text = node.text.trim();
        if (/[a-zA-Z]/.test(text)) assert.ok(approved.has(text), `${file}: untranslated JSX ${text}`);
      }
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        for (const locale of locales) assert.ok(messages[locale][key], `${file}: missing ${locale} ${key}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});
