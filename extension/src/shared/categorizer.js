/**
 * Categorizer Module
 * Classifica URLs e títulos de favoritos em categorias padronizadas para a Barra de Favoritos,
 * baseadas no arquivo Bookmarks de referência do usuário.
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
 * Determina a categoria ideal para um favorito.
 * @param {object} bookmark - Objeto { title, url, currentFolder }
 * @returns {string} Nome da categoria
 */
export function categorizeBookmark({ title = '', url = '', currentFolder = '' }) {
  // 1. Se já estiver em uma pasta de categoria reconhecida (exceto "Barra de favoritos", "Outros favoritos", "Importado"), preserva/normaliza
  if (currentFolder) {
    const normalizedFolder = currentFolder.trim().toLowerCase();
    if (FOLDER_ALIAS_MAP[normalizedFolder]) {
      // Porém, no arquivo de referência do usuário há casos como "Agencia Virtual GS Inima" dentro de AI por engano.
      // Vamos verificar se o domínio bate fortemente com outra regra específica primeiro; se não bater, mantém a pasta atual.
      const domainMatch = matchByDomainOnly(url);
      if (domainMatch) {
        return domainMatch;
      }
      return FOLDER_ALIAS_MAP[normalizedFolder];
    }
  }

  const lowerUrl = (url || '').toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  // 2. Esquemas especiais
  if (lowerUrl.startsWith('javascript:')) {
    return CATEGORIES.DEV;
  }
  if (lowerUrl.startsWith('file://') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
    return CATEGORIES.DEV;
  }

  // 3. Verifica por domínio exato/sufixo
  const domainCategory = matchByDomainOnly(url);
  if (domainCategory) {
    return domainCategory;
  }

  // 4. Verifica por palavras-chave no título ou URL
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
 * Verifica apenas correspondência de domínio nas regras.
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
 * Retorna a lista de todas as categorias disponíveis.
 * @returns {string[]}
 */
export function getAllCategories() {
  return Object.values(CATEGORIES);
}

