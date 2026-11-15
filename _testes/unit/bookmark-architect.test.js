import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { categorizeBookmark, CATEGORIES } from '../../extension/src/shared/categorizer.js';
import { extractPreviewMetadata, checkSingleUrl, LINK_STATUS } from '../../extension/src/shared/link-checker.js';
import { flattenBookmarkNodes, parseImportPayload } from '../../extension/src/shared/backup-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_BOOKMARKS_PATH = path.resolve(__dirname, '../../Bookmarks');

test('Categorizer classifica corretamente domínios de IA, Programação, GameAssets e Vendas', () => {
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
  // Corrige item que estava por engano dentro da pasta AI no arquivo original (GS Inima -> Governo & Utilidades)
  assert.strictEqual(
    categorizeBookmark({
      title: 'Agencia Virtual GS Inima',
      url: 'https://servicosonline-ourinhos.gsinima.com.br/',
      currentFolder: 'AI'
    }),
    CATEGORIES.GOVERNO_UTILIDADES
  );
});

test('Link Checker trata esquemas especiais (javascript:, file://) e extrai OpenGraph de HTML', async () => {
  const bookmarkletRes = await checkSingleUrl("javascript:alert('hello')");
  assert.strictEqual(bookmarkletRes.status, LINK_STATUS.SPECIAL);

  const fileRes = await checkSingleUrl('file:///home/murilo/Projetos/index.html');
  assert.strictEqual(fileRes.status, LINK_STATUS.SPECIAL);

  const sampleHtml = `
    <html>
      <head>
        <title>Título Nativo</title>
        <meta property="og:title" content="Título OpenGraph &amp; Oficial">
        <meta name="description" content="Descrição detalhada para prévia ao passar o mouse.">
        <meta property="og:image" content="/assets/preview.png">
      </head>
    </html>
  `;
  const preview = extractPreviewMetadata(sampleHtml, 'https://example.com/page');
  assert.strictEqual(preview.pageTitle, 'Título OpenGraph & Oficial');
  assert.strictEqual(preview.description, 'Descrição detalhada para prévia ao passar o mouse.');
  assert.strictEqual(preview.image, 'https://example.com/assets/preview.png');
});

test('Backup & Importer processa integralmente o arquivo Bookmarks de referência (se presente localmente)', (t) => {
  if (!fs.existsSync(REFERENCE_BOOKMARKS_PATH)) {
    t.skip('Arquivo pessoal Bookmarks ignorado no Git (não presente neste ambiente)');
    return;
  }
  const rawContent = fs.readFileSync(REFERENCE_BOOKMARKS_PATH, 'utf-8');
  const rawJson = JSON.parse(rawContent);

  const flat = flattenBookmarkNodes(rawJson);
  assert.strictEqual(flat.length, 265, 'Deve extrair todos os 265 links do arquivo Bookmarks de referência');

  const parsed = parseImportPayload(rawContent);
  assert.strictEqual(parsed.items.length, 265);

  // Verifica se todas as entradas receberam uma categoria válida não vazia
  for (const item of parsed.items) {
    assert.ok(item.category && item.category.length > 0, `Item sem categoria: ${item.url}`);
  }
});

test('Backup & Importer preserva notas de observação e categorias customizadas na reimportação', () => {
  const backupSample = {
    schemaVersion: '1.0.0',
    bookmarks: [
      {
        title: 'Meu Favorito Customizado',
        url: 'https://meusite.exemplo.com',
        category: 'Estudo',
        note: 'Excelente artigo sobre Clean Architecture',
        status: 'valid',
        statusCode: 200
      }
    ]
  };

  const { items, metadataPatches } = parseImportPayload(JSON.stringify(backupSample));
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].category, 'Estudo');
  assert.strictEqual(items[0].note, 'Excelente artigo sobre Clean Architecture');
  assert.strictEqual(
    metadataPatches['https://meusite.exemplo.com'].note,
    'Excelente artigo sobre Clean Architecture'
  );
});

