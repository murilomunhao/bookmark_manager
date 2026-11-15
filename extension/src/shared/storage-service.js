/**
 * Storage Service Module
 * Manages persistent state in `chrome.storage.local` and `chrome.storage.session`:
 * - Per-bookmark metadata (indexed by normalized URL):
 *   - note: User observation note
 *   - category: Assigned category (automatic or custom)
 *   - customTitle: Whether the user set a custom title overriding the default uppercase domain name
 *   - originalTitle: Original webpage title preserved for preview & search
 *   - status: Link validation status (valid, restricted, broken, special, unchecked)
 *   - statusCode: HTTP status code from the last check
 *   - error: Diagnostic message if broken/restricted
 *   - preview: { pageTitle, description, image }
 *   - checkedAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 */

const STORAGE_KEYS = {
  METADATA_BY_URL: 'bm_metadata_by_url',
  SCAN_STATE: 'bm_scan_state',
  UI_LANGUAGE: 'bm_ui_language'
};

/**
 * Normalizes a URL as a metadata key so notes and previews survive
 * moving bookmarks across folders or re-importing backups.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrlKey(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
}

/**
 * Retrieves the entire metadata map indexed by URL.
 * @returns {Promise<Record<string, object>>}
 */
export async function getAllMetadata() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.METADATA_BY_URL);
  return data[STORAGE_KEYS.METADATA_BY_URL] || {};
}

/**
 * Retrieves metadata for a specific URL.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getBookmarkMetadata(url) {
  const key = normalizeUrlKey(url);
  if (!key) return {};
  const map = await getAllMetadata();
  return map[key] || {};
}

/**
 * Merges and updates metadata for a specific URL.
 * @param {string} url
 * @param {object} patch
 * @returns {Promise<object>}
 */
export async function updateBookmarkMetadata(url, patch) {
  const key = normalizeUrlKey(url);
  if (!key) return {};
  const map = await getAllMetadata();
  const existing = map[key] || {};
  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  map[key] = updated;
  await chrome.storage.local.set({ [STORAGE_KEYS.METADATA_BY_URL]: map });
  return updated;
}

/**
 * Migrates metadata when the user edits a bookmark's URL,
 * preserving notes, category and history under the new address.
 * @param {string} oldUrl
 * @param {string} newUrl
 * @param {object} patch
 * @returns {Promise<object>}
 */
export async function migrateBookmarkMetadataUrl(oldUrl, newUrl, patch = {}) {
  const oldKey = normalizeUrlKey(oldUrl);
  const newKey = normalizeUrlKey(newUrl);
  if (!newKey) return {};

  const map = await getAllMetadata();
  const oldData = oldKey && map[oldKey] ? map[oldKey] : {};
  const existingNewData = map[newKey] || {};

  const merged = {
    ...oldData,
    ...existingNewData,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  map[newKey] = merged;
  if (oldKey && oldKey !== newKey) {
    delete map[oldKey];
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.METADATA_BY_URL]: map });
  return merged;
}

/**
 * Batch updates metadata for multiple URLs (avoids race conditions during parallel scans).
 * @param {Record<string, object>} batchPatches - Map { [url]: patchObject }
 * @returns {Promise<Record<string, object>>}
 */
export async function batchUpdateMetadata(batchPatches) {
  const map = await getAllMetadata();
  const now = new Date().toISOString();

  for (const [rawUrl, patch] of Object.entries(batchPatches)) {
    const key = normalizeUrlKey(rawUrl);
    if (!key) continue;
    map[key] = {
      ...(map[key] || {}),
      ...patch,
      updatedAt: now
    };
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.METADATA_BY_URL]: map });
  return map;
}

/**
 * Saves scan progress state in `chrome.storage.session` (survives Service Worker restarts).
 * @param {object} state
 */
export async function setScanState(state) {
  await chrome.storage.session.set({ [STORAGE_KEYS.SCAN_STATE]: state });
}

/**
 * Reads the current scan state.
 * @returns {Promise<object>}
 */
export async function getScanState() {
  const data = await chrome.storage.session.get(STORAGE_KEYS.SCAN_STATE);
  return (
    data[STORAGE_KEYS.SCAN_STATE] || {
      status: 'idle', // 'idle' | 'scanning' | 'organizing'
      completed: 0,
      total: 0,
      startedAt: null
    }
  );
}

/**
 * Retrieves the user's saved UI language (default: 'en').
 * @returns {Promise<string>}
 */
export async function getSavedLanguage() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.UI_LANGUAGE);
  return data[STORAGE_KEYS.UI_LANGUAGE] || 'en';
}

/**
 * Persists the user's preferred UI language ('en', 'pt-BR', 'es').
 * @param {string} lang
 */
export async function setSavedLanguage(lang) {
  await chrome.storage.local.set({ [STORAGE_KEYS.UI_LANGUAGE]: lang });
}
