/**
 * Link Checker & Preview Extractor Module
 * Verifica se cada URL dos favoritos é válida e extrai metadados de prévia (OpenGraph / description / title).
 */

export const LINK_STATUS = {
  UNCHECKED: 'unchecked',
  CHECKING: 'checking',
  VALID: 'valid',
  RESTRICTED: 'restricted', // 401, 403, 429 (ex: Cloudflare / Login Required, mas o servidor existe)
  BROKEN: 'broken',         // 404, 410, 500+, DNS/Connection Failure
  SPECIAL: 'special'        // javascript:, file://, chrome://, brave://
};

/**
 * Extrai metadados seguros (título, descrição, imagem OG) de um trecho de HTML usando regex leve
 * (compatível com Service Worker que não possui DOMParser nativo).
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{ pageTitle?: string, description?: string, image?: string }}
 */
export function extractPreviewMetadata(html, baseUrl) {
  if (!html || typeof html !== 'string') return {};

  const headChunk = html.slice(0, 65536); // Analisa apenas os primeiros 64KB para performance

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
      // ignora URL de imagem inválida
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
 * Testa um único link com timeout, validação de status HTTP e extração de metadados de prévia.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<{ status: string, statusCode: number|null, error?: string, preview?: object, checkedAt: string }>}
 */
export async function checkSingleUrl(url, timeoutMs = 8000) {
  const checkedAt = new Date().toISOString();

  if (!url || typeof url !== 'string') {
    return { status: LINK_STATUS.BROKEN, statusCode: null, error: 'URL vazia', checkedAt };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Esquemas especiais (Bookmarklets, arquivos locais, páginas internas)
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
        pageTitle: scheme === 'javascript' ? 'Bookmarklet JavaScript' : `Recurso Local (${scheme}://)`,
        description:
          scheme === 'javascript'
            ? 'Script executável diretamente na barra de favoritos.'
            : `Caminho local ou interno do navegador: ${trimmed.slice(0, 120)}`
      },
      checkedAt
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { status: LINK_STATUS.BROKEN, statusCode: null, error: 'Formato de URL inválido', checkedAt };
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
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const statusCode = response.status;
    let preview = {};

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') && response.body) {
      try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let htmlSnippet = '';
        while (htmlSnippet.length < 48000) {
          const { done, value } = await reader.read();
          if (done) break;
          htmlSnippet += decoder.decode(value, { stream: true });
          if (htmlSnippet.toLowerCase().includes('</head>')) break;
        }
        await reader.cancel().catch(() => { });
        preview = extractPreviewMetadata(htmlSnippet, response.url || trimmed);
      } catch {
        // Ignora erro de leitura parcial de stream
      }
    }

    clearTimeout(timer);

    // Verifica se o próprio título indica 502 Bad Gateway / 404 Not Found mesmo que um proxy retorne 200
    if (preview.pageTitle && /502 bad gateway|404 not found|503 service temporarily unavailable/i.test(preview.pageTitle)) {
      return {
        status: LINK_STATUS.BROKEN,
        statusCode: statusCode >= 400 ? statusCode : 502,
        error: `Página reportou erro: ${preview.pageTitle}`,
        preview,
        checkedAt
      };
    }

    if (statusCode >= 200 && statusCode < 400) {
      return { status: LINK_STATUS.VALID, statusCode, preview, checkedAt };
    }

    if (statusCode === 401 || statusCode === 403 || statusCode === 405 || statusCode === 429) {
      return {
        status: LINK_STATUS.RESTRICTED,
        statusCode,
        error: `Acesso restrito / Protegido (HTTP ${statusCode})`,
        preview,
        checkedAt
      };
    }

    return {
      status: LINK_STATUS.BROKEN,
      statusCode,
      error: `Erro HTTP ${statusCode}`,
      preview,
      checkedAt
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError';
    return {
      status: LINK_STATUS.BROKEN,
      statusCode: null,
      error: isTimeout ? `Tempo limite excedido (${timeoutMs / 1000}s)` : 'Falha de conexão ou DNS inexistente',
      checkedAt
    };
  }
}

/**
 * Executa verificação concorrente com limite de workers e callback de progresso.
 * @param {Array<{ id: string, url: string }>} items
 * @param {number} concurrency
 * @param {(progress: { completed: number, total: number, lastResult: object }) => Promise<void>|void} onProgress
 */
export async function checkLinksBatch(items, concurrency = 6, onProgress = null) {
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

