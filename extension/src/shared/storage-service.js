/**
 * Storage Service Module
 * Gerencia a persistência segura em `chrome.storage.local` de:
 * - Metadados por favorito (chaveados pela URL normalizada e ID):
 *   - note: Nota de observação do usuário
 *   - category: Categoria atribuída (automática ou manual)
 *   - status: Status de validação do link (valid, restricted, broken, special, unchecked)
 *   - statusCode: Código HTTP da última checagem
 *   - error: Mensagem de erro se quebrado/restrito
 *   - preview: { pageTitle, description, image }
 *   - checkedAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 */

const STORAGE_KEYS = {
  METADATA_BY_URL: 'bm_metadata_by_url',
  SCAN_STATE: 'bm_scan_state'
};

/**
 * Normaliza uma URL como chave de metadados para que notas e prévias sobrevivam
 * à movimentação de favoritos entre pastas ou importação de backups.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrlKey(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
}

/**
 * Obtém todo o mapa de metadados indexado por URL.
 * @returns {Promise<Record<string, object>>}
 */
export async function getAllMetadata() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.METADATA_BY_URL);
  return data[STORAGE_KEYS.METADATA_BY_URL] || {};
}

/**
 * Obtém os metadados de uma URL específica.
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
 * Atualiza (merge) os metadados de uma URL específica.
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
 * Atualiza metadados em lote para múltiplas URLs (evita condições de corrida em scans paralelos).
 * @param {Record<string, object>} batchPatches - Mapa { [url]: patchObject }
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
 * Salva estado de progresso da varredura em `chrome.storage.session` (sobrevive a reinício do SW).
 * @param {object} state
 */
export async function setScanState(state) {
  await chrome.storage.session.set({ [STORAGE_KEYS.SCAN_STATE]: state });
}

/**
 * Lê o estado atual da varredura.
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

