import { createSignal, onMount, For, createEffect } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { api } from '../utils/api';
import { getNewsCache, setNewsCache } from '../utils/newsCache';

/** 新闻无图或加载失败时使用的占位图（与 Home 一致） */
const DEFAULT_NEWS_IMAGE = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=200&fit=crop';

interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  thumbnail?: string;
}

function newsImageUrl(item: NewsItem, index: number): string {
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  return `${DEFAULT_NEWS_IMAGE}&sig=${index}`;
}

/** 比较新闻列表是否与当前一致（按 title+url），避免相同数据时 setNews 导致闪烁 */
function isNewsEqual(a: NewsItem[], b: { title: string; url: string }[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].title !== b[i].title || a[i].url !== b[i].url) return false;
  }
  return true;
}

const NewsFeed = () => {
  const { t, locale } = useI18n();
  const [news, setNews] = createSignal<NewsItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchNews = async (lang: string) => {
    const l = lang || 'en';
    const cached = getNewsCache(l);
    if (cached && cached.length > 0) {
      setNews(cached.map((it, i) => ({
        id: i,
        title: it.title,
        url: it.link,
        source: it.source || 'Crypto',
        published_at: it.pubDate || new Date().toISOString(),
        thumbnail: it.image,
      })));
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await api.get('/api/news', { lang: l });
      if (response.type === 'ok' && response.data && Array.isArray((response.data as { items?: Array<{ title: string; link: string; pubDate: string; source: string; image?: string }> }).items)) {
        const items = (response.data as { items: Array<{ title: string; link: string; pubDate: string; source: string; image?: string }> }).items;
        setNewsCache(l, items);
        const next = items.map((it, i) => ({
          id: i,
          title: it.title,
          url: it.link,
          source: it.source || 'Crypto',
          published_at: it.pubDate || new Date().toISOString(),
          thumbnail: it.image,
        }));
        const current = news();
        if (!isNewsEqual(current, items.map((it) => ({ title: it.title, url: it.link })))) {
          setNews(next);
        }
      } else if (!cached?.length) {
        setNews([]);
      }
    } catch {
      if (!cached?.length) {
        setError(t('news.fetchFailed'));
        setNews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const lang = locale();
    if (lang) fetchNews(lang);
  });

  onMount(() => {
    if (!locale()) fetchNews('en');
  });

  if (loading()) return <div class="news-feed p-2 text-gray-500 text-sm">{t('news.loading')}</div>;
  if (error()) return <div class="news-feed p-2 text-gray-500 text-sm">{error()}</div>;

  return (
    <div class="news-feed bg-[#0b0e11] text-gray-400 p-2">
      <h3 class="text-xs font-medium mb-2 mono">{t('news.title')}</h3>
      <div class="news-grid flex gap-2 overflow-x-auto pb-1">
        <For each={news()}>
          {(item, i) => (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              class="news-card flex-shrink-0 w-[240px] rounded border border-[#2c2c3e] overflow-hidden bg-[#1e2329] hover:border-[#4dd0e1]/50 transition"
            >
              <img
                src={newsImageUrl(item, i())}
                alt=""
                class="news-thumbnail w-full h-[100px] object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  if (el && !el.dataset.fallback) {
                    el.dataset.fallback = '1';
                    el.src = DEFAULT_NEWS_IMAGE + '&sig=' + i();
                  }
                }}
              />
              <div class="p-2">
                <div class="news-title text-xs text-white line-clamp-2 mb-1">{item.title}</div>
                <div class="news-meta flex justify-between text-[10px] mono">
                  <span>{item.source}</span>
                  <span>{new Date(item.published_at).toLocaleTimeString()}</span>
                </div>
              </div>
            </a>
          )}
        </For>
      </div>
    </div>
  );
};

export default NewsFeed;
