/**
 * Service Worker (Manifest V3) — Brave Bookmark Architect
 * Responsável por:
 * - Abrir o Side Panel / Dashboard ao clicar no ícone da extensão
 * - Criar menu de contexto para abrir o Dashboard em tela cheia ou salvar nota rápida
 * - Orquestrar a varredura assíncrona de links (teste de validade + extração de prévia)
 * - Categorizar e organizar os favoritos em pastas de categoria diretamente na Barra de Favoritos (`id: "1"`)
 * - Importar e exportar backups (incluindo o formato nativo `Bookmarks` do Brave/Chrome)
 */

import { categorizeBookmark } from '../shared/categorizer.js';
import { checkLinksBatch, checkSingleUrl, LINK_STATUS } from '../shared/link-checker.js';
import {
  batchUpdateMetadata,
  getAllMetadata,
  getScanState,
  normalizeUrlKey,
  setScanState,
  updateBookmarkMetadata
} from '../shared/storage-service.js';
import {
  applyImportedMetadata,
  buildBackupPayload,
  flattenBookmarkNodes,
  parseImportPayload
} from '../shared/backup-service.js';

const BOOKMARKS_BAR_ID = '1'; // ID padrão da Barra de Favoritos no Chromium / Brave

// Configura abertura automática do Side Panel ao clicar no ícone da extensão
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error('Erro ao configurar sidePanel behavior:', err);
  }

  // Cria itens no menu de contexto
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-full-dashboard',
      title: 'Abrir Gerenciador de Favoritos em Tela Cheia',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'organize-bookmarks-now',
      title: 'Categorizar e Organizar Barra de Favoritos Agora',
      contexts: ['action']
    });
  });
});

// Fallback caso setPanelBehavior não dispare em alguma versão específica
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/manager.html') });
    }
  }
});

// Menu de contexto com confirmação visual (notificação / badge)
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'open-full-dashboard') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/manager.html') });
    await showUserNotification(
      'Bookmark Architect',
      'Painel aberto em uma nova guia para visualização expandida.'
    );
  } else if (info.menuItemId === 'organize-bookmarks-now') {
    const result = await organizeBookmarksIntoCategoryFolders({ removeBroken: false });
    await showUserNotification(
      'Favoritos Organizados!',
      `${result.movedCount} links foram organizados em ${result.categoriesUsed} pastas na Barra de Favoritos.`
    );
  }
});

async function showUserNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message
    });
  } catch (err) {
    console.warn('Notificação falhou:', err);
  }
}

/**
 * Lê toda a árvore de favoritos do navegador e enriquece cada link com os metadados salvos
 * (categoria, nota de observação, status de validação e prévia).
 */
async function getEnrichedBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const flat = flattenBookmarkNodes(tree);
  const metadataMap = await getAllMetadata();

  return flat.map((item) => {
    const key = normalizeUrlKey(item.url);
    const meta = metadataMap[key] || {};
    const category =
      meta.category ||
      categorizeBookmark({
        title: item.title,
        url: item.url,
        currentFolder: item.folder
      });

    return {
      ...item,
      category,
      note: meta.note || '',
      status: meta.status || LINK_STATUS.UNCHECKED,
      statusCode: meta.statusCode ?? null,
      error: meta.error || null,
      preview: meta.preview || null,
      checkedAt: meta.checkedAt || null
    };
  });
}

/**
 * Percorre todos os favoritos, testa se os links são válidos e salva status + prévia.
 */
async function scanAllBookmarks({ onlyUnchecked = false } = {}) {
  const currentScan = await getScanState();
  if (currentScan.status === 'scanning') {
    return { alreadyRunning: true, state: currentScan };
  }

  const allItems = await getEnrichedBookmarks();
  const targets = onlyUnchecked
    ? allItems.filter((b) => !b.status || b.status === LINK_STATUS.UNCHECKED)
    : allItems;

  const total = targets.length;
  if (total === 0) {
    return { completed: 0, total: 0 };
  }

  await setScanState({
    status: 'scanning',
    completed: 0,
    total,
    startedAt: new Date().toISOString()
  });
  await chrome.action.setBadgeBackgroundColor({ color: '#FB542B' });
  await chrome.action.setBadgeText({ text: '0%' });

  const pendingPatches = {};

  try {
    await checkLinksBatch(targets, 6, async ({ completed, total: tot, item, result }) => {
      pendingPatches[item.url] = {
        status: result.status,
        statusCode: result.statusCode,
        error: result.error || null,
        preview: result.preview || item.preview || null,
        checkedAt: result.checkedAt,
        category: item.category
      };

      // Persiste a cada 8 links ou no último para manter a UI reativa sem sobrecarregar I/O
      if (completed % 8 === 0 || completed === tot) {
        await batchUpdateMetadata({ ...pendingPatches });
        for (const k of Object.keys(pendingPatches)) delete pendingPatches[k];

        const pct = Math.round((completed / tot) * 100);
        await chrome.action.setBadgeText({ text: `${pct}%` });
        await setScanState({
          status: 'scanning',
          completed,
          total: tot,
          startedAt: currentScan.startedAt
        });

        chrome.runtime
          .sendMessage({
            type: 'SCAN_PROGRESS',
            payload: { completed, total: tot, percentage: pct }
          })
          .catch(() => {});
      }
    });
  } finally {
    await setScanState({
      status: 'idle',
      completed: total,
      total,
      finishedAt: new Date().toISOString()
    });
    await chrome.action.setBadgeText({ text: '' });
    chrome.runtime
      .sendMessage({
        type: 'SCAN_COMPLETED',
        payload: { total }
      })
      .catch(() => {});
  }

  return { completed: total, total };
}

/**
 * Garante que uma pasta de categoria exista diretamente na Barra de Favoritos (`id: "1"`)
 * e retorna seu ID.
 */
async function ensureCategoryFolderOnBar(categoryName, existingBarFoldersMap) {
  const normalized = categoryName.trim().toLowerCase();
  if (existingBarFoldersMap.has(normalized)) {
    return existingBarFoldersMap.get(normalized);
  }

  const created = await chrome.bookmarks.create({
    parentId: BOOKMARKS_BAR_ID,
    title: categoryName.trim()
  });
  existingBarFoldersMap.set(normalized, created.id);
  return created.id;
}

/**
 * Categoriza cada link e move para pastas correspondentes na Barra de Favoritos (`id: "1"`).
 * Opcionalmente move links quebrados para uma pasta `_Links Quebrados` ou os remove se solicitado.
 */
async function organizeBookmarksIntoCategoryFolders({
  quarantineBroken = true,
  removeEmptyFolders = true
} = {}) {
  const tree = await chrome.bookmarks.getTree();
  const metadataMap = await getAllMetadata();

  // Mapeia as pastas diretas que já existem na Barra de Favoritos (id '1')
  const barChildren = await chrome.bookmarks.getChildren(BOOKMARKS_BAR_ID);
  const existingBarFoldersMap = new Map();
  for (const child of barChildren) {
    if (!child.url && child.title) {
      existingBarFoldersMap.set(child.title.trim().toLowerCase(), child.id);
    }
  }

  // Coleta todos os links em toda a árvore de favoritos (Barra de Favoritos + Outros Favoritos + subpastas)
  const allLinks = [];
  const allFolders = [];

  function collectNodes(node, currentFolderName = '', parentId = null) {
    if (!node) return;
    if (node.url) {
      allLinks.push({
        id: node.id,
        parentId: node.parentId || parentId,
        title: node.title || node.url,
        url: node.url,
        currentFolderName
      });
      return;
    }

    if (node.id && !['0', '1', '2', '3'].includes(String(node.id))) {
      allFolders.push({ id: node.id, title: node.title || '', parentId: node.parentId });
    }

    if (Array.isArray(node.children)) {
      const nextFolderName = ['0', '1', '2', '3'].includes(String(node.id))
        ? currentFolderName
        : node.title || currentFolderName;
      for (const child of node.children) {
        collectNodes(child, nextFolderName, node.id);
      }
    }
  }

  for (const root of tree) {
    collectNodes(root, '');
  }

  let movedCount = 0;
  const usedCategories = new Set();
  const metadataUpdates = {};

  for (const link of allLinks) {
    const key = normalizeUrlKey(link.url);
    const meta = metadataMap[key] || {};

    let targetCategory =
      meta.category ||
      categorizeBookmark({
        title: link.title,
        url: link.url,
        currentFolder: link.currentFolderName
      });

    if (quarantineBroken && meta.status === LINK_STATUS.BROKEN) {
      targetCategory = '⚠️ Links Quebrados';
    }

    usedCategories.add(targetCategory);
    metadataUpdates[link.url] = { category: targetCategory };

    const targetFolderId = await ensureCategoryFolderOnBar(targetCategory, existingBarFoldersMap);

    if (String(link.parentId) !== String(targetFolderId)) {
      try {
        await chrome.bookmarks.move(String(link.id), { parentId: String(targetFolderId) });
        movedCount++;
      } catch (err) {
        console.warn(`Não foi possível mover o favorito ${link.id}:`, err);
      }
    }
  }

  await batchUpdateMetadata(metadataUpdates);

  // Remove pastas antigas que ficaram vazias (como "IAs" antiga ou "Importado")
  let removedFoldersCount = 0;
  if (removeEmptyFolders) {
    // Percorre em ordem reversa (subpastas mais profundas primeiro)
    for (const folder of allFolders.reverse()) {
      try {
        const remainingChildren = await chrome.bookmarks.getChildren(String(folder.id));
        if (remainingChildren.length === 0) {
          await chrome.bookmarks.remove(String(folder.id));
          removedFoldersCount++;
        }
      } catch {
        // Pasta já removida ou protegida
      }
    }
  }

  return {
    totalProcessed: allLinks.length,
    movedCount,
    categoriesUsed: usedCategories.size,
    removedFoldersCount
  };
}

/**
 * Importa favoritos de um JSON (Backup do plugin ou arquivo `Bookmarks` nativo do Brave/Chrome),
 * evita duplicatas na mesma categoria e organiza tudo nas pastas da Barra de Favoritos.
 */
async function importBookmarksFromJson(jsonPayload) {
  const { items, metadataPatches } = parseImportPayload(jsonPayload);
  await applyImportedMetadata(metadataPatches);

  // Obtém os links já existentes no navegador para não duplicar URLs idênticas
  const existingBookmarks = await getEnrichedBookmarks();
  const existingByUrl = new Map();
  for (const bm of existingBookmarks) {
    existingByUrl.set(normalizeUrlKey(bm.url), bm);
  }

  const barChildren = await chrome.bookmarks.getChildren(BOOKMARKS_BAR_ID);
  const existingBarFoldersMap = new Map();
  for (const child of barChildren) {
    if (!child.url && child.title) {
      existingBarFoldersMap.set(child.title.trim().toLowerCase(), child.id);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const key = normalizeUrlKey(item.url);
    const targetFolderId = await ensureCategoryFolderOnBar(
      item.category || 'Geral',
      existingBarFoldersMap
    );

    if (existingByUrl.has(key)) {
      const existing = existingByUrl.get(key);
      if (String(existing.parentId) !== String(targetFolderId) && existing.id) {
        try {
          await chrome.bookmarks.move(String(existing.id), { parentId: String(targetFolderId) });
        } catch {
          // ignora falha se ID mudou
        }
      }
      updatedCount++;
    } else {
      try {
        const created = await chrome.bookmarks.create({
          parentId: String(targetFolderId),
          title: item.title || item.url,
          url: item.url
        });
        existingByUrl.set(key, created);
        createdCount++;
      } catch (err) {
        console.warn('Falha ao criar favorito importado:', item.url, err);
      }
    }
  }

  return {
    totalInFile: items.length,
    createdCount,
    updatedCount
  };
}

// Roteador central de mensagens Assíncrono (sempre retorna true para manter o canal aberto)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case 'GET_BOOKMARKS': {
          const bookmarks = await getEnrichedBookmarks();
          const scanState = await getScanState();
          sendResponse({ ok: true, bookmarks, scanState });
          break;
        }

        case 'CHECK_SINGLE_LINK': {
          const { url, category } = message.payload || {};
          const res = await checkSingleUrl(url);
          const updated = await updateBookmarkMetadata(url, {
            status: res.status,
            statusCode: res.statusCode,
            error: res.error || null,
            preview: res.preview || null,
            checkedAt: res.checkedAt,
            ...(category ? { category } : {})
          });
          sendResponse({ ok: true, result: updated });
          break;
        }

        case 'SCAN_ALL_LINKS': {
          const { onlyUnchecked = false } = message.payload || {};
          // Inicia em background e responde imediatamente que iniciou, ou aguarda conclusão
          const result = await scanAllBookmarks({ onlyUnchecked });
          sendResponse({ ok: true, result });
          break;
        }

        case 'ORGANIZE_BOOKMARKS': {
          const options = message.payload || {};
          const result = await organizeBookmarksIntoCategoryFolders(options);
          sendResponse({ ok: true, result });
          break;
        }

        case 'SAVE_NOTE_AND_CATEGORY': {
          const { bookmarkId, url, title, note, category, moveNow } = message.payload || {};
          const updatedMeta = await updateBookmarkMetadata(url, {
            note: (note || '').trim(),
            category: (category || 'Geral').trim()
          });

          if (bookmarkId && title) {
            try {
              await chrome.bookmarks.update(String(bookmarkId), { title: title.trim() });
            } catch {
              // ignora se bookmarkId for de pré-visualização
            }
          }

          if (moveNow && bookmarkId && category) {
            const barChildren = await chrome.bookmarks.getChildren(BOOKMARKS_BAR_ID);
            const folderMap = new Map();
            for (const c of barChildren) {
              if (!c.url && c.title) folderMap.set(c.title.trim().toLowerCase(), c.id);
            }
            const targetFolderId = await ensureCategoryFolderOnBar(category, folderMap);
            try {
              await chrome.bookmarks.move(String(bookmarkId), { parentId: String(targetFolderId) });
            } catch {
              // ignora falha
            }
          }

          sendResponse({ ok: true, metadata: updatedMeta });
          break;
        }

        case 'DELETE_BOOKMARK': {
          const { bookmarkId } = message.payload || {};
          if (bookmarkId) {
            await chrome.bookmarks.remove(String(bookmarkId));
          }
          sendResponse({ ok: true });
          break;
        }

        case 'EXPORT_BACKUP': {
          const tree = await chrome.bookmarks.getTree();
          const backup = await buildBackupPayload(tree);
          sendResponse({ ok: true, backup });
          break;
        }

        case 'IMPORT_BACKUP': {
          const { jsonContent } = message.payload || {};
          const result = await importBookmarksFromJson(jsonContent);
          sendResponse({ ok: true, result });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Ação desconhecida: ${message?.type}` });
      }
    } catch (err) {
      console.error('Erro no Service Worker:', err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();

  return true; // Mantém o canal de mensagem aberto para respostas assíncronas
});

