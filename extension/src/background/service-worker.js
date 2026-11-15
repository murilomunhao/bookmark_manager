/**
 * Service Worker (Manifest V3) — Brave Bookmark Architect
 * Responsibilities:
 * - Open the Side Panel / Dashboard when clicking the extension action icon
 * - Register context menu items to open the Dashboard in a full tab or organize bookmarks
 * - Orchestrate asynchronous batch link validation and preview extraction
 * - Categorize, standardize default domain names (UPPERCASE), and organize bookmarks into category folders on the Bookmarks Bar (`id: "1"`)
 * - Validate edited links before saving and support JSON backup export/import
 */

import { categorizeBookmark, extractDomainNameUppercase } from '../shared/categorizer.js';
import { checkLinksBatch, checkSingleUrl, LINK_STATUS } from '../shared/link-checker.js';
import { t } from '../shared/i18n.js';
import {
  batchUpdateMetadata,
  getAllMetadata,
  getSavedLanguage,
  getScanState,
  migrateBookmarkMetadataUrl,
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

const BOOKMARKS_BAR_ID = '1'; // Default Bookmarks Bar ID in Chromium / Brave

// Configure automatic Side Panel opening on extension action click
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error('Failed to configure sidePanel behavior:', err);
  }

  // Register context menu items
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-full-dashboard',
      title: 'Open Bookmark Manager in Full Screen',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'organize-bookmarks-now',
      title: 'Categorize and Organize Bookmarks Bar Now',
      contexts: ['action']
    });
  });
});

// Fallback if setPanelBehavior does not fire on a specific Chromium build
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/manager.html') });
    }
  }
});

// Context menu handler with user notification feedback
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'open-full-dashboard') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/manager.html') });
    await showUserNotification(
      'Bookmark Architect',
      'Dashboard opened in a new full-screen tab.'
    );
  } else if (info.menuItemId === 'organize-bookmarks-now') {
    const result = await organizeBookmarksIntoCategoryFolders({ removeBroken: false });
    await showUserNotification(
      'Bookmarks Organized!',
      `${result.movedCount} links organized into ${result.categoriesUsed} folders on the Bookmarks Bar.`
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
    console.warn('Notification failed:', err);
  }
}

/**
 * Reads the entire browser bookmark tree and enriches each link with stored metadata
 * (category, observation note, validation status, preview, and default uppercase domain name).
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

    // By default, use the domain name without extension in UPPERCASE (e.g. https://www.meusite.com -> MEUSITE)
    // unless the user explicitly saved a custom title (`customTitle: true`)
    const defaultDomainTitle = extractDomainNameUppercase(item.url, item.title);
    const displayTitle = meta.customTitle ? item.title : defaultDomainTitle;

    return {
      ...item,
      title: displayTitle,
      originalTitle: meta.originalTitle || item.title,
      customTitle: Boolean(meta.customTitle),
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
 * Scans all bookmarks, validates link reachability, and stores status + preview metadata.
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
    await checkLinksBatch(targets, 4, async ({ completed, total: tot, item, result }) => {
      pendingPatches[item.url] = {
        status: result.status,
        statusCode: result.statusCode,
        error: result.error || null,
        preview: result.preview || item.preview || null,
        checkedAt: result.checkedAt,
        category: item.category
      };

      // Persist every 8 links or on completion to keep UI reactive without saturating storage I/O
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
 * Ensures a category folder exists directly on the Bookmarks Bar (`id: "1"`) and returns its ID.
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
 * Categorizes each link, applies the default uppercase domain name (unless customized by the user),
 * and moves bookmarks into their corresponding category folders on the Bookmarks Bar (`id: "1"`).
 */
async function organizeBookmarksIntoCategoryFolders({
  quarantineBroken = true,
  removeEmptyFolders = true,
  normalizeNamesToDomain = true
} = {}) {
  const tree = await chrome.bookmarks.getTree();
  const metadataMap = await getAllMetadata();
  const lang = await getSavedLanguage();

  // Map direct child folders already present on the Bookmarks Bar (id '1')
  const barChildren = await chrome.bookmarks.getChildren(BOOKMARKS_BAR_ID);
  const existingBarFoldersMap = new Map();
  for (const child of barChildren) {
    if (!child.url && child.title) {
      existingBarFoldersMap.set(child.title.trim().toLowerCase(), child.id);
    }
  }

  // Collect all links and non-root folders across the entire bookmark tree
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
  let renamedCount = 0;
  const usedCategories = new Set();
  const metadataUpdates = {};

  for (const link of allLinks) {
    const key = normalizeUrlKey(link.url);
    const meta = metadataMap[key] || {};

    let targetCategory =
      meta.category ||
      categorizeBookmark({
        title: meta.originalTitle || link.title,
        url: link.url,
        currentFolder: link.currentFolderName
      });

    if (quarantineBroken && meta.status === LINK_STATUS.BROKEN) {
      targetCategory = t(lang, 'brokenFolderTitle');
    }

    usedCategories.add(targetCategory);

    // Default to uppercase domain name without extension (e.g. MEUSITE),
    // preserving the original title in metadata for hover preview and search
    const domainUpper = extractDomainNameUppercase(link.url, link.title);
    const desiredTitle = meta.customTitle ? link.title : domainUpper;

    metadataUpdates[link.url] = {
      category: targetCategory,
      ...(meta.originalTitle ? {} : { originalTitle: link.title })
    };

    if (normalizeNamesToDomain && !meta.customTitle && link.title !== desiredTitle) {
      try {
        await chrome.bookmarks.update(String(link.id), { title: desiredTitle });
        renamedCount++;
      } catch (err) {
        console.warn(`Could not rename bookmark ${link.id}:`, err);
      }
    }

    const targetFolderId = await ensureCategoryFolderOnBar(targetCategory, existingBarFoldersMap);

    if (String(link.parentId) !== String(targetFolderId)) {
      try {
        await chrome.bookmarks.move(String(link.id), { parentId: String(targetFolderId) });
        movedCount++;
      } catch (err) {
        console.warn(`Could not move bookmark ${link.id}:`, err);
      }
    }
  }

  await batchUpdateMetadata(metadataUpdates);

  // Remove legacy folders that became empty after reorganization
  let removedFoldersCount = 0;
  if (removeEmptyFolders) {
    for (const folder of allFolders.reverse()) {
      try {
        const remainingChildren = await chrome.bookmarks.getChildren(String(folder.id));
        if (remainingChildren.length === 0) {
          await chrome.bookmarks.remove(String(folder.id));
          removedFoldersCount++;
        }
      } catch {
        // Folder already removed or protected
      }
    }
  }

  return {
    totalProcessed: allLinks.length,
    movedCount,
    renamedCount,
    categoriesUsed: usedCategories.size,
    removedFoldersCount
  };
}

/**
 * Imports bookmarks from a JSON payload (extension backup or native Brave/Chrome `Bookmarks` file),
 * avoids duplicating existing URLs, and organizes them into category folders on the Bookmarks Bar.
 */
async function importBookmarksFromJson(jsonPayload) {
  const { items, metadataPatches } = parseImportPayload(jsonPayload);
  await applyImportedMetadata(metadataPatches);

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
          // ignore if ID changed
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
        console.warn('Failed to create imported bookmark:', item.url, err);
      }
    }
  }

  return {
    totalInFile: items.length,
    createdCount,
    updatedCount
  };
}

// Central asynchronous message router (always returns true to keep the channel open)
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
          const { bookmarkId, oldUrl, url, title, note, category, moveNow } = message.payload || {};
          const finalUrl = (url || oldUrl || '').trim();
          const previousUrl = (oldUrl || finalUrl).trim();

          // Validate that the link (URL) is not broken before saving
          const checkResult = await checkSingleUrl(finalUrl);
          if (checkResult.status === LINK_STATUS.BROKEN) {
            sendResponse({
              ok: false,
              brokenUrl: true,
              error: `The provided link is unreachable or broken (${checkResult.error || 'Offline'}). Please fix the URL before saving.`
            });
            break;
          }

          const defaultDomainTitle = extractDomainNameUppercase(finalUrl, title);
          const finalTitle = (title || defaultDomainTitle).trim();
          const isCustomTitle = finalTitle.toUpperCase() !== defaultDomainTitle.toUpperCase();

          const metadataPatch = {
            note: (note || '').trim(),
            category: (category || 'Geral').trim(),
            customTitle: isCustomTitle,
            status: checkResult.status,
            statusCode: checkResult.statusCode,
            error: checkResult.error || null,
            preview: checkResult.preview || null,
            checkedAt: checkResult.checkedAt
          };

          const updatedMeta =
            previousUrl !== finalUrl
              ? await migrateBookmarkMetadataUrl(previousUrl, finalUrl, metadataPatch)
              : await updateBookmarkMetadata(finalUrl, metadataPatch);

          if (bookmarkId) {
            try {
              await chrome.bookmarks.update(String(bookmarkId), {
                title: finalTitle,
                url: finalUrl
              });
            } catch (err) {
              console.warn('Failed to update bookmark title/URL:', err);
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
              // ignore move failure
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
          sendResponse({ ok: false, error: `Unknown action: ${message?.type}` });
      }
    } catch (err) {
      console.error('Service Worker error:', err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();

  return true; // Keep message channel open for async response
});
