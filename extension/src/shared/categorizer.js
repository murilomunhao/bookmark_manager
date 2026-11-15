/**
 * Categorizer Module
 * Classifies bookmark URLs and titles into standardized categories for the Bookmarks Bar,
 * calibrated against the user's reference Bookmarks file.
 */

export const CATEGORIES = {
  AI: 'AI',
  PROGRAMACAO: 'Programação',
  DEV: 'Dev',
  APIS: 'APIs',
  DOCUMENTACAO: 'Documentação',
  GAME_ASSETS: 'GameAssets',
  VENDAS: 'Vendas',
  EDICAO: 'Edição',
  CRIPTO: 'Cripto',
  TESTE_INTERNET: 'TesteInternet',
  ESTUDO: 'Estudo',
  GOVERNO_UTILIDADES: 'Governo & Utilidades',
  GERAL: 'Geral'
};

export const CATEGORY_RULES = [
  {
    category: CATEGORIES.TESTE_INTERNET,
    domains: [
      'waveform.com',
      'simet.nic.br',
      'nperf.com',
      'devina.io',
      'speedtest.net',
      'fast.com'
    ],
    keywords: ['bufferbloat', 'speed test', 'speedtest', 'teste de velocidade', 'teste sua velocidade']
  },
  {
    category: CATEGORIES.CRIPTO,
    domains: [
      'pixswap.trade',
      'uniswap.org',
      'dexscreener.com',
      'cryptobubbles.net',
      'cos.tv',
      'coinmarketcap.com',
      'coingecko.com',
      'binance.com'
    ],
    keywords: ['cripto', 'crypto', 'blockchain', 'nft', 'uniswap', 'dex screener', 'web3', 'bitcoin']
  },
  {
    category: CATEGORIES.GAME_ASSETS,
    domains: [
      'itch.io',
      'gamedevmarket.net',
      'assetstore.unity.com',
      'kenney.nl',
      'gamedeveloperstudio.com',
      'spritefusion.com',
      'codeandweb.com',
      'opengameart.org',
      'sonniss.com',
      'freesound.org',
      'freesfx.co.uk',
      'newgrounds.com',
      'unrealengine.com',
      'sanderfrenken.github.io',
      'retroachievements.org',
      'oncehuman.th.gl',
      'codmunity.gg',
      'rdr2map.com',
      'dayz.ginfo.gg',
      'palworld.gg',
      'rockstargames.com'
    ],
    keywords: [
      'sprite', 'tile map', 'game asset', '2d game', 'texture atlas',
      'unity asset', 'lpc sprite', 'game audio', 'warzone', 'palworld', 'once human'
    ]
  },
  {
    category: CATEGORIES.AI,
    domains: [
      'notebooklm.google.com',
      'huggingface.co',
      'davinci.ai',
      'd-id.com',
      'agensi.io',
      'pika.art',
      'haiper.ai',
      'pixverse.ai',
      'leonardo.ai',
      'scenario.com',
      'you.com',
      'civitai.com',
      'gptbots.ai',
      'mistral.ai',
      'hedra.com',
      'vidnoz.com',
      'perplexity.ai',
      'claude.ai',
      'audiobox.metademolab.com',
      'aidemos.atmeta.com',
      'chatgpt.com',
      'aiva.ai',
      'beatoven.ai',
      'blackbox.ai',
      'hailuoai.video',
      'ideogram.ai',
      'lovable.dev',
      'deepseek.com',
      'qwenlm.ai',
      'napkin.ai',
      'gemini.google.com',
      'kive.ai',
      'grok.com',
      'bolt.new',
      'aicomicfactory.com',
      'theresanaiforthat.com',
      'apob.ai',
      'heygen.com',
      'labs.google',
      'tensor.art',
      'aifaceswap.io',
      'minimax.io',
      'vidu.com',
      'dreamina.capcut.com',
      'deepmind.google',
      'manus.im',
      'aistudio.google.com',
      'runwayml.com',
      'aitoggler.com',
      'speechma.com',
      'boolv.video',
      'replicate.com',
      'aiforwork.co',
      'akool.com',
      'openai.fm',
      'wan.video',
      'krea.ai',
      'seaart.ai',
      'assemblyai.com',
      'meta.ai',
      'lovart.ai',
      'open-design.ai'
    ],
    keywords: [
      'ai ', ' ai', 'ia ', ' ia', 'artificial intelligence', 'inteligência artificial',
      'chatgpt', 'gemini', 'llm', 'stable diffusion', 'text to speech', 'text to video',
      'prompts', 'ai agent', 'generative', 'face swap', 'sora'
    ]
  },
  {
    category: CATEGORIES.APIS,
    domains: [
      'omdbapi.com',
      'themoviedb.org',
      'serpapi.com',
      'public-api-lists.github.io',
      'free-apis.github.io',
      'freepublicapis.com',
      '18f.github.io',
      'apify.com'
    ],
    keywords: ['public api', 'free api', 'search api', 'omdb api', 'tmdb', 'serpapi']
  },
  {
    category: CATEGORIES.DOCUMENTACAO,
    domains: [
      'dart.dev',
      'developer.mozilla.org',
      'docs.stripe.com',
      'developers.google.com',
      'developers.tiktok.com'
    ],
    keywords: ['documentação', 'documentation', 'mdn', 'dart basics', 'sdk', 'api reference']
  },
  {
    category: CATEGORIES.VENDAS,
    domains: [
      'kyte.site',
      'perfectpay.com.br',
      'inlead.online',
      'logzz.com.br',
      'cakto.com.br',
      'cssbuy.com',
      'b4you.com.br',
      'shopee.com.br',
      'kalodata.com',
      'rifa.digital',
      'stripe.com',
      'mercadopago.com.br',
      'rakutenadvertising.com',
      'actionpay.com.br',
      'associados.amazon.com.br',
      'ko-fi.com',
      'livepix.gg',
      'xgrow.com',
      'uiclap.com',
      'upwork.com',
      'turbosociais.com'
    ],
    keywords: [
      'afiliados', 'vendas', 'checkout', 'vitrine', 'funis de vendas',
      'empreendedor', 'pagamento', 'stripe', 'mercadopago', 'shopee'
    ]
  },
  {
    category: CATEGORIES.EDICAO,
    domains: [
      'mixkit.co',
      'myinstants.com',
      'creatorset.com',
      'vlipsy.com',
      'postermywall.com',
      'veed.io',
      'zeemo.ai',
      '123apps.com',
      'submagic.co',
      'dlpanda.com',
      'bravedown.com',
      'bensound.com',
      'auto-editor.com',
      'online-video-cutter.com',
      'vdo.ninja',
      'streamelements.com',
      'tikfinity.zerody.one',
      'tokcomment.com',
      'docs.google.com'
    ],
    keywords: [
      'video downloader', 'green screen', 'miniatura do youtube', 'thumbnail',
      'video cutter', 'transcript generator', 'video clips', 'efeitos sonoros'
    ]
  },
  {
    category: CATEGORIES.DEV,
    domains: [
      'gitmoji.dev',
      'store.kde.org',
      'gist.github.com',
      'console.neon.tech',
      'console.aws.amazon.com',
      'vercel.com',
      'netlify.com',
      'mailtrap.io',
      'sendgrid.com',
      'whatsmydns.net',
      'sslshopper.com',
      'mobsf.live',
      'make.com',
      'n8n.mindsconnect.com.br',
      'play.google.com',
      'cookieyes.com',
      'metastatus.com',
      'localhost'
    ],
    keywords: ['gitmoji', 'tmux', 'aws', 'docker', 'deploy', 'dns', 'ssl checker', 'localhost']
  },
  {
    category: CATEGORIES.PROGRAMACAO,
    domains: [
      'github.com',
      'dribbble.com',
      'awwwards.com',
      'geracaocriativa.com',
      'animista.net',
      'brasilcode.com.br',
      'usehooks-ts.com',
      'http.cat',
      'fastify.dev',
      'matheuslao.dev',
      'terrakok.github.io',
      'uiverse.io',
      'flowbite.com',
      'creative-tim.com',
      'daisyui.com',
      'freefigmatemplates.com',
      'htmlrev.com',
      'os.click',
      'scrollxui.dev',
      'appicon.co',
      'tldraw.com',
      'flogisoft.com',
      'autotic.com.br',
      'miyuru.lk'
    ],
    keywords: [
      'css', 'javascript', 'typescript', 'tailwind', 'react', 'bash', 'linux',
      'commits', 'ui components', 'svg icons', 'html templates', 'node'
    ]
  },
  {
    category: CATEGORIES.ESTUDO,
    domains: [
      'coddy.tech',
      'codecademy.com',
      'moodle.ifrs.edu.br',
      'aprendamais.mec.gov.br',
      'fasuleducacional.edu.br',
      'vunesp.com.br',
      'annas-archive.li',
      'annas-archive.org',
      'annas-archive.gl',
      'welib.org',
      'cursosheliocouto.com.br',
      'heliocouto.com',
      'emailestudante.com.br',
      'archive.org'
    ],
    keywords: ['curso', 'estudo', 'moodle', 'livro', 'library', 'educacional', 'python', 'aprenda']
  },
  {
    category: CATEGORIES.GOVERNO_UTILIDADES,
    domains: [
      'tjsp.jus.br',
      'bcb.gov.br',
      'ourinhos.sp.gov.br',
      'saobernardo.sp.gov.br',
      'gsinima.com.br',
      'eloweb.net',
      'tabelatacoonline.com.br',
      'tdeecalculator.net',
      'gsuplementos.com.br'
    ],
    keywords: ['eproc', 'prefeitura', 'gov.br', 'processual', 'contribuinte', 'recadastramento', 'tabela nutricional']
  }
];

const KNOWN_CATEGORY_NAMES = new Set(Object.values(CATEGORIES).map((c) => c.toLowerCase()));
// Map legacy folder names from reference Bookmarks file (e.g. "IAs" -> "AI")
const FOLDER_ALIAS_MAP = {
  'ias': CATEGORIES.AI,
  'ai': CATEGORIES.AI,
  'dev': CATEGORIES.DEV,
  'programação': CATEGORIES.PROGRAMACAO,
  'programacao': CATEGORIES.PROGRAMACAO,
  'cripto': CATEGORIES.CRIPTO,
  'apis': CATEGORIES.APIS,
  'documentação': CATEGORIES.DOCUMENTACAO,
  'documentacao': CATEGORIES.DOCUMENTACAO,
  'vendas': CATEGORIES.VENDAS,
  'edição': CATEGORIES.EDICAO,
  'edicao': CATEGORIES.EDICAO,
  'gameassets': CATEGORIES.GAME_ASSETS,
  'testeinternet': CATEGORIES.TESTE_INTERNET,
  'estudo': CATEGORIES.ESTUDO,
  'governo & utilidades': CATEGORIES.GOVERNO_UTILIDADES,
  'geral': CATEGORIES.GERAL
};

/**
 * Determines the best category for a bookmark.
 * @param {object} bookmark - Object { title, url, currentFolder }
 * @returns {string} Category name
 */
export function categorizeBookmark({ title = '', url = '', currentFolder = '' }) {
  // 1. If already inside a recognized category folder (except root containers or "Importado"), preserve/normalize it
  if (currentFolder) {
    const normalizedFolder = currentFolder.trim().toLowerCase();
    if (FOLDER_ALIAS_MAP[normalizedFolder]) {
      // Check if domain strongly matches a specific rule first to fix misplaced bookmarks
      const domainMatch = matchByDomainOnly(url);
      if (domainMatch) {
        return domainMatch;
      }
      return FOLDER_ALIAS_MAP[normalizedFolder];
    }
  }

  const lowerUrl = (url || '').toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  // 2. Special schemes
  if (lowerUrl.startsWith('javascript:')) {
    return CATEGORIES.DEV;
  }
  if (lowerUrl.startsWith('file://') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
    return CATEGORIES.DEV;
  }

  // 3. Exact or suffix domain match
  const domainCategory = matchByDomainOnly(url);
  if (domainCategory) {
    return domainCategory;
  }

  // 4. Keyword match in title or URL
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lowerTitle.includes(kw) || lowerUrl.includes(kw)) {
        return rule.category;
      }
    }
  }

  return CATEGORIES.GERAL;
}

/**
 * Checks domain-only match against category rules.
 * @param {string} url
 * @returns {string|null}
 */
export function matchByDomainOnly(url) {
  if (!url) return null;
  let hostname = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const rule of CATEGORY_RULES) {
    for (const domain of rule.domains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return rule.category;
      }
    }
  }
  return null;
}

/**
 * Returns the list of all available categories.
 * @returns {string[]}
 */
export function getAllCategories() {
  return Object.values(CATEGORIES);
}

const GENERIC_SUBDOMAINS = new Set(['www', 'app', 'pt', 'br', 'en', 'm', 'web', 'login', 'auth', 'dashboard', 'console', 'studio', 'my', 'beta']);
const COMPOUND_TLDS = new Set([
  'com.br', 'gov.br', 'edu.br', 'jus.br', 'org.br', 'net.br', 'nic.br',
  'co.uk', 'org.uk', 'co.jp', 'com.au'
]);
const GENERIC_SLDS = new Set(['sp', 'rj', 'mg', 'pr', 'rs', 'sc', 'ba', 'df', 'go', 'pe', 'ce', 'gov', 'edu', 'com', 'org', 'net']);

/**
 * Extracts the default bookmark name from the URL domain (without extension) in UPPERCASE.
 * Example: "https://www.meusite.com/pagina" -> "MEUSITE"
 *          "https://app.cakto.com.br/home" -> "CAKTO"
 * @param {string} url
 * @param {string} fallbackTitle
 * @returns {string}
 */
export function extractDomainNameUppercase(url, fallbackTitle = '') {
  if (!url || typeof url !== 'string') {
    return (fallbackTitle || 'LINK').trim().toUpperCase();
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('javascript:')) {
    return 'BOOKMARKLET';
  }

  if (lower.startsWith('file://')) {
    const cleanPath = trimmed.replace(/\/+$/, '');
    const lastSegment = cleanPath.split('/').pop() || 'LOCAL';
    const withoutExt = lastSegment.includes('.') ? lastSegment.split('.')[0] : lastSegment;
    return (withoutExt || 'LOCAL').toUpperCase();
  }

  let hostname = '';
  try {
    const parsed = new URL(trimmed);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return (fallbackTitle || trimmed).trim().toUpperCase();
  }

  if (!hostname) {
    return (fallbackTitle || 'LINK').trim().toUpperCase();
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname === '127.0.0.1' ? 'LOCALHOST' : hostname.toUpperCase();
  }

  // Strip common prefixes and split hostname
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].toUpperCase();
  }

  // Special case: <username>.github.io or <creator>.itch.io
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if ((lastTwo === 'github.io' || lastTwo === 'itch.io') && parts.length >= 3) {
    return parts[0].toUpperCase();
  }

  // Strip compound TLD (e.g. .com.br, .gov.br, .co.uk) or simple TLD (e.g. .com, .io, .ai)
  let remaining = [...parts];
  if (remaining.length >= 3 && COMPOUND_TLDS.has(`${remaining[remaining.length - 2]}.${remaining[remaining.length - 1]}`)) {
    remaining.splice(remaining.length - 2, 2);
  } else {
    remaining.pop();
  }

  // Strip state/generic SLD in government domains (e.g. ourinhos.sp.gov.br -> sp)
  if (remaining.length >= 2 && GENERIC_SLDS.has(remaining[remaining.length - 1])) {
    remaining.pop();
  }

  // Pick main domain label unless it is a generic subdomain
  let candidate = remaining[remaining.length - 1] || parts[0];
  if (GENERIC_SUBDOMAINS.has(candidate) && remaining.length > 1) {
    candidate = remaining[0];
  }

  return candidate.toUpperCase();
}


