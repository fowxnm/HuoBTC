import { For, Show } from 'solid-js';
import './RecentTrades.css';

export interface Trade {
  id: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface RecentTradesProps {
  trades?: Trade[];
}

const RecentTrades = (props: RecentTradesProps) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  };

  const list = () => props.trades || [];

  return (
    <div class="recent-trades">
      <h3>Recent Trades</h3>
      <div class="trades-list">
        <div class="trade-header">
          <span>Price</span>
          <span>Amount</span>
          <span>Time</span>
        </div>
        <Show when={list().length > 0} fallback={<div class="trade-empty">No trades</div>}>
          <For each={list()}>
            {(trade) => (
              <div class="trade">
                <span class="mono" style={{ color: trade.side === 'buy' ? '#2ebd85' : '#f6465d' }}>
                  {trade.price.toFixed(2)}
                </span>
                <span class="mono">{trade.amount.toFixed(4)}</span>
                <span class="mono">{formatTime(trade.timestamp)}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default RecentTrades;
