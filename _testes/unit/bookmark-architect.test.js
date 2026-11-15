import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { categorizeBookmark, CATEGORIES, extractDomainNameUppercase } from '../../extension/src/shared/categorizer.js';
import { extractPreviewMetadata, checkSingleUrl, LINK_STATUS } from '../../extension/src/shared/link-checker.js';
import { flattenBookmarkNodes, parseImportPayload } from '../../extension/src/shared/backup-service.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from '../../extension/src/shared/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_BOOKMARKS_PATH = path.resolve(__dirname, '../../Bookmarks');

test('Categorizer accurately classifies AI, Programming, GameAssets and Sales domains', () => {
  assert.strictEqual(
    categorizeBookmark({ title: 'Agensi: The Skill Marketplace for AI Agents', url: 'https://www.agensi.io/' }),
    CATEGORIES.AI
  );
  assert.strictEqual(
    categorizeBookmark({ title: 'Warrior Girl by murilomunhao', url: 'https://murilomunhao.itch.io/warriorgirl' }),
    CATEGORIES.GAME_ASSETS
  );
  assert.strictEqual(
    categorizeBookmark({ title: 'Dashboard | Vitrine', url: 'https://app.cakto.com.br/dashboard/showcase' }),
    CATEGORIES.VENDAS
  );
  assert.strictEqual(
    categorizeBookmark({ title: 'Bufferbloat and Internet Speed Test', url: 'https://www.waveform.com/tools/bufferbloat' }),
    CATEGORIES.TESTE_INTERNET
  );
  // Fixes item misplaced inside the AI folder in the original reference file (GS Inima -> Governo & Utilidades)
  assert.strictEqual(
    categorizeBookmark({
      title: 'Agencia Virtual GS Inima',
      url: 'https://servicosonline-ourinhos.gsinima.com.br/',
      currentFolder: 'AI'
    }),
    CATEGORIES.GOVERNO_UTILIDADES
  );
});

test('Link Checker handles special schemes (javascript:, file://) and extracts OpenGraph metadata from HTML', async () => {
  const bookmarkletRes = await checkSingleUrl("javascript:alert('hello')");
  assert.strictEqual(bookmarkletRes.status, LINK_STATUS.SPECIAL);

  const fileRes = await checkSingleUrl('file:///home/murilo/Projetos/index.html');
  assert.strictEqual(fileRes.status, LINK_STATUS.SPECIAL);

  const sampleHtml = `
    <html>
      <head>
        <title>Native Title</title>
        <meta property="og:title" content="OpenGraph &amp; Official Title">
        <meta name="description" content="Detailed description for hover preview.">
        <meta property="og:image" content="/assets/preview.png">
      </head>
    </html>
  `;
  const preview = extractPreviewMetadata(sampleHtml, 'https://example.com/page');
  assert.strictEqual(preview.pageTitle, 'OpenGraph & Official Title');
  assert.strictEqual(preview.description, 'Detailed description for hover preview.');
  assert.strictEqual(preview.image, 'https://example.com/assets/preview.png');
});

test('Backup & Importer processes the reference Bookmarks file (if present locally)', (tCtx) => {
  if (!fs.existsSync(REFERENCE_BOOKMARKS_PATH)) {
    tCtx.skip('Personal Bookmarks file is gitignored and not present in this environment');
    return;
  }
  const rawContent = fs.readFileSync(REFERENCE_BOOKMARKS_PATH, 'utf-8');
  const rawJson = JSON.parse(rawContent);

  const flat = flattenBookmarkNodes(rawJson);
  assert.strictEqual(flat.length, 265, 'Should extract all 265 links from the reference Bookmarks file');

  const parsed = parseImportPayload(rawContent);
  assert.strictEqual(parsed.items.length, 265);

  // Verify every entry received a valid non-empty category
  for (const item of parsed.items) {
    assert.ok(item.category && item.category.length > 0, `Item missing category: ${item.url}`);
  }
});

test('Backup & Importer preserves observation notes and custom categories on re-import', () => {
  const backupSample = {
    schemaVersion: '1.0.0',
    bookmarks: [
      {
        title: 'My Custom Bookmark',
        url: 'https://mysite.example.com',
        category: 'Estudo',
        note: 'Great article on Clean Architecture',
        status: 'valid',
        statusCode: 200
      }
    ]
  };

  const { items, metadataPatches } = parseImportPayload(JSON.stringify(backupSample));
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].category, 'Estudo');
  assert.strictEqual(items[0].note, 'Great article on Clean Architecture');
  assert.strictEqual(
    metadataPatches['https://mysite.example.com'].note,
    'Great article on Clean Architecture'
  );
});

test('extractDomainNameUppercase extracts the domain name without extension in UPPERCASE by default', () => {
  assert.strictEqual(extractDomainNameUppercase('https://www.meusite.com'), 'MEUSITE');
  assert.strictEqual(extractDomainNameUppercase('https://www.meusite.com/pagina?id=1'), 'MEUSITE');
  assert.strictEqual(extractDomainNameUppercase('https://app.cakto.com.br/dashboard/showcase'), 'CAKTO');
  assert.strictEqual(extractDomainNameUppercase('https://murilomunhao.itch.io/warriorgirl'), 'MURILOMUNHAO');
  assert.strictEqual(extractDomainNameUppercase('https://e-gov.ourinhos.sp.gov.br:8443/tb'), 'OURINHOS');
  assert.strictEqual(extractDomainNameUppercase('http://localhost:3000/'), 'LOCALHOST');
  assert.strictEqual(extractDomainNameUppercase("javascript:alert('1')"), 'BOOKMARKLET');
});

test('i18n uses English (en) as default locale and translates accurately to pt-BR and es', () => {
  assert.strictEqual(DEFAULT_LOCALE, 'en');
  assert.deepStrictEqual(SUPPORTED_LOCALES, ['en', 'pt-BR', 'es']);
  assert.strictEqual(t('en', 'btnScanAll'), '🔍 Check All Links');
  assert.strictEqual(t('pt-BR', 'btnScanAll'), '🔍 Testar Todos os Links');
  assert.strictEqual(t('es', 'btnScanAll'), '🔍 Probar Todos los Enlaces');
  assert.strictEqual(
    t('en', 'toastImported', { total: 10, created: 4, updated: 6 }),
    '⬆️ Imported! 10 read (4 new created, 6 updated on the Bar).'
  );
});
