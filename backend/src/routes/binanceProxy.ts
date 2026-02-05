/**
 * Binance API Proxy Routes
 * Proxies Binance REST API requests to avoid CORS issues in the frontend
 */

import { Elysia, t } from 'elysia';

const BINANCE_API = 'https://api.binance.com/api/v3';

export const binanceProxyRoutes = new Elysia({ prefix: '/binance' })
  // Proxy depth (order book)
  .get('/depth', async ({ query }) => {
    const { symbol, limit } = query;
    try {
      const res = await fetch(`${BINANCE_API}/depth?symbol=${symbol}&limit=${limit || 100}`);
      if (!res.ok) {
        return { type: 'error', message: `Binance API error: ${res.status}` };
      }
      return await res.json();
    } catch (e) {
      return { type: 'error', message: 'Failed to fetch depth' };
    }
  }, {
    query: t.Object({
      symbol: t.String(),
      limit: t.Optional(t.String())
    })
  })

  // Proxy trades
  .get('/trades', async ({ query }) => {
    const { symbol, limit } = query;
    try {
      const res = await fetch(`${BINANCE_API}/trades?symbol=${symbol}&limit=${limit || 100}`);
      if (!res.ok) {
        return { type: 'error', message: `Binance API error: ${res.status}` };
      }
      return await res.json();
    } catch (e) {
      return { type: 'error', message: 'Failed to fetch trades' };
    }
  }, {
    query: t.Object({
      symbol: t.String(),
      limit: t.Optional(t.String())
    })
  })

  // Proxy klines (candlestick)
  .get('/klines', async ({ query }) => {
    const { symbol, interval, limit } = query;
    try {
      const res = await fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit || 500}`);
      if (!res.ok) {
        return { type: 'error', message: `Binance API error: ${res.status}` };
      }
      return await res.json();
    } catch (e) {
      return { type: 'error', message: 'Failed to fetch klines' };
    }
  }, {
    query: t.Object({
      symbol: t.String(),
      interval: t.String(),
      limit: t.Optional(t.String())
    })
  })

  // Proxy exchangeInfo
  .get('/exchangeInfo', async () => {
    try {
      const res = await fetch(`${BINANCE_API}/exchangeInfo`);
      if (!res.ok) {
        return { type: 'error', message: `Binance API error: ${res.status}` };
      }
      return await res.json();
    } catch (e) {
      return { type: 'error', message: 'Failed to fetch exchangeInfo' };
    }
  });
