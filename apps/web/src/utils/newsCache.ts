/**
 * 新闻预加载缓存：应用启动时预取，首页/NewsFeed 优先用缓存再后台刷新
 */
import { api } from './api';

export interface CachedNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  image?: string;
}

const CACHE_KEY = 'news_cache';
const TTL_MS = 5 * 60 * 1000; // 5 分钟

interface CacheEntry {
  lang: string;
  items: CachedNewsItem[];
  ts: number;
}

function getStored(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry?.lang || !Array.isArray(entry?.items)) return null;
    if (Date.now() - entry.ts > TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export function getNewsCache(lang: string): CachedNewsItem[] | null {
  const entry = getStored();
  if (!entry || entry.lang !== lang) return null;
  return entry.items;
}

export function setNewsCache(lang: string, items: CachedNewsItem[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lang, items, ts: Date.now() }));
  } catch (_) {}
}

/** 预加载新闻（应用启动或切换语言时调用） */
export function prefetchNews(lang: string): void {
  api.get('/api/news', { lang: lang || 'en' }).then((response) => {
    if (response.type === 'ok' && response.data && Array.isArray((response.data as { items?: CachedNewsItem[] }).items)) {
      const items = (response.data as { items: CachedNewsItem[] }).items;
      setNewsCache(lang || 'en', items);
    }
  }).catch(() => {});
}
