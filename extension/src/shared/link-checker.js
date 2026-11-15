/**
 * Link Checker & Preview Extractor Module
 * Validates bookmark URLs and extracts preview metadata (OpenGraph / description / title).
 */

export const LINK_STATUS = {
  UNCHECKED: 'unchecked',
  CHECKING: 'checking',
  VALID: 'valid',
  RESTRICTED: 'restricted', // 401, 403, 429, 503 (e.g. Cloudflare / Login Required, server is alive)
  BROKEN: 'broken',         // 404, 410, 500+, DNS/Connection Failure
  SPECIAL: 'special'        // javascript:, file://, chrome://, brave://
};

/**
 * Safely extracts preview metadata (title, description, OG image) from an HTML snippet using lightweight regex
 * (compatible with MV3 Service Worker which has no native DOMParser).
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{ pageTitle?: string, description?: string, image?: string }}
 */
export function extractPreviewMetadata(html, baseUrl) {
  if (!html || typeof html !== 'string') return {};

  const headChunk = html.slice(0, 65536); // Inspect only the first 64KB for performance

  const getMetaContent = (attrName, attrValue) => {
    const pattern1 = new RegExp(
      `<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const match1 = headChunk.match(pattern1);
    if (match1?.[1]) return decodeHtmlEntities(match1[1].trim());

    const pattern2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attrValue}["']`,
      'i'
    );
    const match2 = headChunk.match(pattern2);
    if (match2?.[1]) return decodeHtmlEntities(match2[1].trim());

    return undefined;
  };

  const titleMatch = headChunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : undefined;

  const ogTitle = getMetaContent('property', 'og:title') || getMetaContent('name', 'twitter:title');
  const ogDesc =
    getMetaContent('property', 'og:description') ||
    getMetaContent('name', 'description') ||
    getMetaContent('name', 'twitter:description');
  let ogImage = getMetaContent('property', 'og:image') || getMetaContent('name', 'twitter:image');

  if (ogImage && baseUrl) {
    try {
      ogImage = new URL(ogImage, baseUrl).href;
    } catch {
      // ignore invalid image URL
    }
  }

  return {
    pageTitle: ogTitle || rawTitle,
    description: ogDesc ? ogDesc.slice(0, 300) : undefined,
    image: ogImage
  };
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Tests a single link with a generous timeout (18s default), automatic fallback probe (no-cors + origin ping)
 * to avoid false positives on slow servers or TLS/WAF fetch blocks,
 * and extracts preview metadata (OpenGraph / description / title).
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<{ status: string, statusCode: number|null, error?: string, preview?: object, checkedAt: string }>}
 */
export async function checkSingleUrl(url, timeoutMs = 18000) {
  const checkedAt = new Date().toISOString();

  if (!url || typeof url !== 'string') {
    return { status: LINK_STATUS.BROKEN, statusCode: null, error: 'Empty URL', checkedAt };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Special schemes (Bookmarklets, local files, browser internal pages)
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('file://') ||
    lower.startsWith('chrome://') ||
    lower.startsWith('brave://') ||
    lower.startsWith('about:')
  ) {
    const scheme = lower.split(':')[0];
    return {
      status: LINK_STATUS.SPECIAL,
      statusCode: null,
      preview: {
        pageTitle: scheme === 'javascript' ? 'JavaScript Bookmarklet' : `Local Resource (${scheme}://)`,
        description:
          scheme === 'javascript'
            ? 'Executable script directly on the Bookmarks Bar.'
            : `Local or internal browser path: ${trimmed.slice(0, 120)}`
      },
      checkedAt
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { status: LINK_STATUS.BROKEN, statusCode: null, error: 'Invalid URL format', checkedAt };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { status: LINK_STATUS.SPECIAL, statusCode: null, checkedAt };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,es;q=0.7'
      }
    });

    const statusCode = response.status;
    let preview = {};

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') && response.body) {
      try {
        // Separate 5s deadline for reading the body stream so slow streaming never aborts an established HTTP response
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let htmlSnippet = '';
        const readDeadline = Date.now() + 5000;

        while (htmlSnippet.length < 48000 && Date.now() < readDeadline) {
          const { done, value } = await reader.read();
          if (done) break;
          htmlSnippet += decoder.decode(value, { stream: true });
          if (htmlSnippet.toLowerCase().includes('</head>')) break;
        }
        await reader.cancel().catch(() => {});
        preview = extractPreviewMetadata(htmlSnippet, response.url || trimmed);
      } catch {
        // Ignore partial stream read errors
      }
    }

    clearTimeout(timer);

    // Check if the page title itself reports 502 Bad Gateway / 503 Service Unavailable even if a reverse proxy returned 200
    if (preview.pageTitle && /502 bad gateway|503 service temporarily unavailable/i.test(preview.pageTitle)) {
      return {
        status: LINK_STATUS.BROKEN,
        statusCode: statusCode >= 400 ? statusCode : 502,
        error: `Page reported error: ${preview.pageTitle}`,
        preview,
        checkedAt
      };
    }

    if (statusCode >= 200 && statusCode < 400) {
      return { status: LINK_STATUS.VALID, statusCode, preview, checkedAt };
    }

    // Status codes where the server is alive and responding, but blocks automated fetch or requires login/session
    if (
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 405 ||
      statusCode === 406 ||
      statusCode === 429 ||
      statusCode === 503 // Cloudflare Under Attack / JS Challenge frequently uses 503
    ) {
      return {
        status: LINK_STATUS.RESTRICTED,
        statusCode,
        error: `Active server / Protected or login required (HTTP ${statusCode})`,
        preview,
        checkedAt
      };
    }

    return {
      status: LINK_STATUS.BROKEN,
      statusCode,
      error: `HTTP Error ${statusCode}`,
      preview,
      checkedAt
    };
  } catch (err) {
    clearTimeout(timer);

    // Second-chance fallback probe: some servers reject extension fetch headers or take longer on initial TLS handshake.
    // Perform a lightweight `no-cors` probe against the target URL or domain origin to confirm if the host is alive.
    const fallbackAlive = await probeFallbackConnectivity(trimmed, parsed.origin, 10000);
    if (fallbackAlive) {
      return {
        status: LINK_STATUS.VALID,
        statusCode: 200,
        preview: {
          pageTitle: parsed.hostname,
          description: 'Link validated via direct connection probe (active server).'
        },
        checkedAt
      };
    }

    const isTimeout = err?.name === 'AbortError';
    return {
      status: LINK_STATUS.BROKEN,
      statusCode: null,
      error: isTimeout ? `Connection timed out (${Math.round(timeoutMs / 1000)}s)` : 'Connection failed or DNS unreachable',
      checkedAt
    };
  }
}

/**
 * Secondary `no-cors` probe to confirm if the host is online when the primary GET fails due to
 * WAF filtering, complex redirects or slow initial DNS/TLS handshake.
 * @param {string} targetUrl
 * @param {string} originUrl
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function probeFallbackConnectivity(targetUrl, originUrl, timeoutMs = 10000) {
  for (const candidate of [targetUrl, originUrl]) {
    if (!candidate) continue;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      await fetch(candidate, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        signal: ctrl.signal
      });
      clearTimeout(t);
      return true;
    } catch {
      clearTimeout(t);
    }
  }
  return false;
}

/**
 * Executes concurrent link validation with a worker limit and progress callback.
 * @param {Array<{ id: string, url: string }>} items
 * @param {number} concurrency
 * @param {(progress: { completed: number, total: number, lastResult: object }) => Promise<void>|void} onProgress
 */
export async function checkLinksBatch(items, concurrency = 4, onProgress = null) {
  const results = {};
  const total = items.length;
  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < total) {
      const currentIdx = index++;
      const item = items[currentIdx];
      const res = await checkSingleUrl(item.url);
      results[item.id] = { ...res, url: item.url };
      completed++;
      if (onProgress) {
        await onProgress({ completed, total, item, result: results[item.id] });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  return results;
}
