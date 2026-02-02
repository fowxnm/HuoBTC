/**
 * 加密货币资讯接口：带图片、每日更新
 * 1) 若配置 CRYPTO_NEWS_API_KEY，优先使用 Crypto News API（保证有图、每日更新）
 * 2) 否则使用多个带图 RSS 源（Cointelegraph、CoinDesk、Decrypt 等）聚合
 */

import { Elysia, t } from 'elysia';

const LANG_TO_GOOGLE: Record<string, { hl: string; gl: string; ceid: string }> = {
  en: { hl: 'en', gl: 'US', ceid: 'US:en' },
  zh: { hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' },
  zhHant: { hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  ja: { hl: 'ja', gl: 'JP', ceid: 'JP:ja' },
  ko: { hl: 'ko', gl: 'KR', ceid: 'KR:ko' },
};

// 诈骗/欺诈相关关键词（多语言），标题或描述包含则过滤
const SCAM_KEYWORDS = [
  '诈骗', '骗局', '传销', '杀猪盘', '詐騙', '騙局', '傳銷',
  'scam', 'fraud', 'phishing', 'ponzi', 'ponzi scheme',
  '詐欺', '詐騙集團', '投資詐騙', 'crypto scam', 'cryptocurrency scam',
  'rug pull', 'rugpull', 'honeypot',
].map((s) => s.toLowerCase());

function containsScamKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SCAM_KEYWORDS.some((kw) => lower.includes(kw));
}

function normalizeImageUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return u;
}

function getImageFromBlock(block: string, description: string): string {
  let out = '';
  // media:content url="..."
  const mediaContent = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaContent?.[1]) out = mediaContent[1].trim();
  else {
    const mediaThumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (mediaThumb?.[1]) out = mediaThumb[1].trim();
  }
  if (!out) {
    const enclosure = block.match(/<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["']/i)
      || block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i);
    if (enclosure?.[1]) out = enclosure[1].trim();
  }
  if (!out && description) {
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1]) out = imgMatch[1].trim();
  }
  return normalizeImageUrl(out);
}

export type NewsItemOut = { title: string; link: string; pubDate: string; source: string; image: string };

function parseRssItems(xml: string): NewsItemOut[] {
  const items: NewsItemOut[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const getTag = (block: string, tag: string): string => {
    const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
    const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = block.match(cdata) || block.match(plain);
    return (m && (m[1] || '').trim()) || '';
  };
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = getTag(block, 'title').replace(/<[^>]+>/g, '').trim();
    const link = getTag(block, 'link').trim();
    const pubDate = getTag(block, 'pubDate').trim();
    const source = getTag(block, 'source').replace(/<[^>]+>/g, '').trim();
    const description = getTag(block, 'description').replace(/<[^>]+>/g, '').trim();
    const image = getImageFromBlock(block, description);
    if (title && link && !containsScamKeyword(title) && !(description && containsScamKeyword(description))) {
      items.push({ title, link, pubDate, source, image });
    }
  }
  return items;
}

const UA = 'Mozilla/5.0 (compatible; CryptoNewsBot/1.0)';

async function fetchRss(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return res.text();
}

// 带图且每日更新的 RSS 源（主流加密媒体）
const RSS_WITH_IMAGES = [
  'https://cointelegraph.com/rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://decrypt.co/feed',
  'https://cryptoslate.com/feed/',
  'https://beincrypto.com/feed/',
  'https://bitcoinmagazine.com/.rss/full',
  'https://coingape.com/feed/',
  'https://www.newsbtc.com/feed/',
  'https://cryptopotato.com/feed/',
  'https://dailycoin.com/feed/',
  'https://www.theblock.co/rss.xml',
  'https://www.coinspeaker.com/feed/',
];

async function fetchFromCryptoNewsApi(token: string): Promise<NewsItemOut[]> {
  const url = `https://cryptonews-api.com/api/v1/category?section=general&items=20&page=1&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: Array<{ title?: string; news_url?: string; image_url?: string; date?: string; source_name?: string }> };
  const data = json?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((n) => n?.title && n?.news_url)
    .map((n) => ({
      title: String(n.title),
      link: String(n.news_url),
      pubDate: n.date ? new Date(n.date).toUTCString() : new Date().toUTCString(),
      source: n.source_name ? String(n.source_name) : 'Crypto News',
      image: normalizeImageUrl(n.image_url || ''),
    }));
}

export const newsRoutes = new Elysia({ prefix: '/news' })
  .get(
    '/',
    async ({ query }) => {
      const lang = String(query.lang || 'en').toLowerCase();
      const params = LANG_TO_GOOGLE[lang] || LANG_TO_GOOGLE.en;
      const apiKey = process.env.CRYPTO_NEWS_API_KEY?.trim();
      const seen = new Set<string>();
      const all: NewsItemOut[] = [];

      const push = (items: NewsItemOut[]) => {
        for (const it of items) {
          if (!it.link || seen.has(it.link)) continue;
          seen.add(it.link);
          all.push(it);
        }
      };

      try {
        // 1) 若配置了 API Key，优先拉取带图、每日更新的 Crypto News API
        if (apiKey) {
          const apiItems = await fetchFromCryptoNewsApi(apiKey);
          push(apiItems);
        }

        // 2) 聚合带图 RSS：Google 按语言 + 多个主流加密媒体（每日更新）
        const q = encodeURIComponent('cryptocurrency OR bitcoin OR ethereum');
        const googleUrl = `https://news.google.com/rss/search?q=${q}&hl=${params.hl}&gl=${params.gl}&ceid=${params.ceid}`;
        const rssUrls = [googleUrl, ...RSS_WITH_IMAGES];
        const results = await Promise.allSettled(rssUrls.map((u) => fetchRss(u)));
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            push(parseRssItems(result.value));
          }
        }

        // 有图的排前面，再按日期倒序；最多 18 条
        const sorted = all
          .sort((a, b) => {
            const aHasImg = !!a.image;
            const bHasImg = !!b.image;
            if (aHasImg !== bHasImg) return bHasImg ? 1 : -1;
            return (b.pubDate || '').localeCompare(a.pubDate || '');
          })
          .slice(0, 18);

        return { type: 'ok' as const, data: { items: sorted } };
      } catch (e) {
        console.warn('[news] fetch failed:', (e as Error).message);
        return { type: 'ok' as const, data: { items: [] } };
      }
    },
    {
      query: t.Object({ lang: t.Optional(t.String()) }),
    }
  );
