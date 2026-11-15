/**
 * Backup & Importer Service Module
 * Suporta:
 * 1. Exportar todos os favoritos + notas + categorias + status/prévias para um arquivo JSON rico (ou formato compatível com o arquivo Bookmarks do Brave/Chrome).
 * 2. Importar a partir de:
 *    - Backup JSON do próprio plugin (restaurando favoritos, notas, categorias e prévias)
 *    - Arquivo `Bookmarks` nativo do Brave/Chrome (formato Chromium JSON com `roots.bookmark_bar`, `roots.other`, etc., igual ao arquivo de referência na raiz do projeto)
 */

import { categorizeBookmark } from './categorizer.js';
import { batchUpdateMetadata, getAllMetadata, normalizeUrlKey } from './storage-service.js';

/**
 * Percorre recursivamente qualquer estrutura de árvore de favoritos (API `chrome.bookmarks` ou arquivo `Bookmarks` do Chromium)
 * e extrai uma lista plana de links com contexto de pasta.
 * @param {object|Array} rootNodes
 * @returns {Array<{ id?: string, title: string, url: string, folder: string, dateAdded?: string }>}
 */
export function flattenBookmarkNodes(rootNodes) {
  const flat = [];

  function walk(node, folderPath = '') {
    if (!node) return;

    const title = node.title ?? node.name ?? '';
    const url = node.url;
    const isFolder = !url && (Array.isArray(node.children) || node.type === 'folder');

    if (url) {
      flat.push({
        id: node.id ? String(node.id) : undefined,
        guid: node.guid,
        title: title || url,
        url,
        folder: folderPath || 'Barra de favoritos',
        dateAdded: node.date_added || node.dateAdded
      });
      return;
    }

    if (isFolder && Array.isArray(node.children)) {
      // Ignora nomes de raízes padrão na construção da categoria imediata se tiver subpastas
      const isRootContainer =
        node.id === '0' ||
        node.id === '1' ||
        node.id === '2' ||
        node.id === '3' ||
        ['barra de favoritos', 'bookmarks bar', 'outros favoritos', 'other bookmarks', 'dispositivos móveis', 'mobile bookmarks'].includes(
          title.toLowerCase()
        );

      const nextFolder = isRootContainer ? folderPath : title || folderPath;
      for (const child of node.children) {
        walk(child, nextFolder);
      }
    }
  }

  if (Array.isArray(rootNodes)) {
    for (const n of rootNodes) walk(n, '');
  } else if (rootNodes && typeof rootNodes === 'object') {
    // Formato de arquivo Bookmarks nativo do Brave/Chromium: { checksum, roots: { bookmark_bar: {...}, other: {...} } }
    if (rootNodes.roots && typeof rootNodes.roots === 'object') {
      for (const rootObj of Object.values(rootNodes.roots)) {
        if (rootObj && typeof rootObj === 'object') {
          walk(rootObj, '');
        }
      }
    } else {
      walk(rootNodes, '');
    }
  }

  return flat;
}

/**
 * Gera o payload completo de backup combinando a árvore atual do navegador e os metadados (notas, categorias, prévias).
 * Também inclui a estrutura `roots` compatível com o arquivo Bookmarks do Brave/Chrome para referência.
 * @param {Array} browserTree - Resultado de `chrome.bookmarks.getTree()`
 * @returns {Promise<object>}
 */
export async function buildBackupPayload(browserTree) {
  const metadataMap = await getAllMetadata();
  const flatBookmarks = flattenBookmarkNodes(browserTree);

  const enrichedItems = flatBookmarks.map((item) => {
    const key = normalizeUrlKey(item.url);
    const meta = metadataMap[key] || {};
    const category = meta.category || categorizeBookmark({ title: item.title, url: item.url, currentFolder: item.folder });
    return {
      title: item.title,
      url: item.url,
      folder: item.folder,
      category,
      note: meta.note || '',
      status: meta.status || 'unchecked',
      statusCode: meta.statusCode ?? null,
      preview: meta.preview || null,
      checkedAt: meta.checkedAt || null
    };
  });

  return {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    application: 'Brave Bookmark Architect',
    stats: {
      totalBookmarks: enrichedItems.length,
      withNotes: enrichedItems.filter((i) => Boolean(i.note && i.note.trim())).length
    },
    bookmarks: enrichedItems,
    metadataByUrl: metadataMap,
    rawBrowserTree: browserTree
  };
}

/**
 * Valida e interpreta um JSON de importação (tanto backup do plugin quanto arquivo `Bookmarks` nativo do Brave/Chrome).
 * @param {string|object} jsonInput
 * @returns {{ items: Array<{ title: string, url: string, category: string, note: string, status?: string, preview?: object }>, metadataPatches: Record<string, object> }}
 */
export function parseImportPayload(jsonInput) {
  const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
  if (!data || typeof data !== 'object') {
    throw new Error('Arquivo de importação inválido: não é um objeto JSON.');
  }

  const items = [];
  const metadataPatches = {};

  // Caso 1: Backup gerado pelo próprio Brave Bookmark Architect
  if (Array.isArray(data.bookmarks)) {
    if (data.metadataByUrl && typeof data.metadataByUrl === 'object') {
      Object.assign(metadataPatches, data.metadataByUrl);
    }

    for (const entry of data.bookmarks) {
      if (!entry?.url) continue;
      const category =
        entry.category ||
        categorizeBookmark({
          title: entry.title || '',
          url: entry.url,
          currentFolder: entry.folder || ''
        });
      const note = entry.note || metadataPatches[normalizeUrlKey(entry.url)]?.note || '';

      items.push({
        title: entry.title || entry.url,
        url: entry.url,
        category,
        note
      });

      const key = normalizeUrlKey(entry.url);
      metadataPatches[key] = {
        ...(metadataPatches[key] || {}),
        category,
        note,
        ...(entry.status ? { status: entry.status } : {}),
        ...(entry.statusCode !== undefined ? { statusCode: entry.statusCode } : {}),
        ...(entry.preview ? { preview: entry.preview } : {})
      };
    }

    return { items, metadataPatches };
  }

  // Caso 2: Arquivo `Bookmarks` nativo do Brave / Chrome (`{ roots: { bookmark_bar: ... } }`)
  if (data.roots && typeof data.roots === 'object') {
    const flat = flattenBookmarkNodes(data);
    for (const entry of flat) {
      if (!entry.url) continue;
      const category = categorizeBookmark({
        title: entry.title,
        url: entry.url,
        currentFolder: entry.folder
      });
      const note = entry.note || '';
      items.push({
        title: entry.title || entry.url,
        url: entry.url,
        category,
        note
      });

      const key = normalizeUrlKey(entry.url);
      metadataPatches[key] = {
        category,
        ...(note ? { note } : {})
      };
    }

    return { items, metadataPatches };
  }

  throw new Error('Formato não reconhecido. Use um backup JSON do plugin ou o arquivo Bookmarks do Brave/Chrome.');
}

/**
 * Persiste os metadados importados no storage.
 * @param {Record<string, object>} metadataPatches
 */
export async function applyImportedMetadata(metadataPatches) {
  if (!metadataPatches || Object.keys(metadataPatches).length === 0) return;
  await batchUpdateMetadata(metadataPatches);
}

