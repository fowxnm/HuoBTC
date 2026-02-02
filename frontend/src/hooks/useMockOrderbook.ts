import { createSignal, onCleanup, onMount } from 'solid-js';

export interface MockLevel {
  price: number;
  amount: number;
}

export interface MockTrade {
  id: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface MockState {
  bids: MockLevel[];
  asks: MockLevel[];
  trades: MockTrade[];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateLevels(mid: number, side: 'bid' | 'ask', count: number): MockLevel[] {
  const levels: MockLevel[] = [];
  for (let i = 0; i < count; i += 1) {
    const price =
      side === 'bid'
        ? mid * (1 - (i + 1) * 0.001)
        : mid * (1 + (i + 1) * 0.001);
    levels.push({ price, amount: randomBetween(0.2, 8) });
  }
  return levels;
}

export function useMockOrderbook(initialPrice: number = 50000) {
  const [state, setState] = createSignal<MockState>({
    bids: generateLevels(initialPrice, 'bid', 12),
    asks: generateLevels(initialPrice, 'ask', 12),
    trades: [],
  });

  onMount(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        const mid =
          prev.bids[0]?.price && prev.asks[0]?.price
            ? (prev.bids[0].price + prev.asks[0].price) / 2
            : initialPrice;
        const nextBids = prev.bids.map((b, i) => ({
          price: b.price,
          amount: Math.max(0.01, b.amount + randomBetween(-0.15, 0.2) + i * 0.002),
        }));
        const nextAsks = prev.asks.map((a, i) => ({
          price: a.price,
          amount: Math.max(0.01, a.amount + randomBetween(-0.15, 0.2) + i * 0.002),
        }));

        const isBuy = Math.random() > 0.5;
        const tradePrice = mid * (isBuy ? 1 + randomBetween(0, 0.0006) : 1 - randomBetween(0, 0.0006));
        const trade: MockTrade = {
          id: Date.now(),
          price: tradePrice,
          amount: randomBetween(0.01, 2),
          side: isBuy ? 'buy' : 'sell',
          timestamp: Date.now(),
        };

        return {
          bids: nextBids,
          asks: nextAsks,
          trades: [trade, ...prev.trades].slice(0, 20),
        };
      });
    }, 300);

    onCleanup(() => clearInterval(timer));
  });

  return state;
}
