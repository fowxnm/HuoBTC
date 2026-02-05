import { Component, For, Show } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { formatFiatPrice } from '../utils/priceLocale';
import './OrderBook.css';

export interface OrderBookEntry {
  price: number;
  amount: number;
}

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  currentPrice?: number;
  flashClass?: string;
}

const OrderBook: Component<OrderBookProps> = (props) => {
  const { t, locale } = useI18n();
  const maxAmount = () => {
    const maxBid = Math.max(0, ...props.bids.map((b) => b.amount));
    const maxAsk = Math.max(0, ...props.asks.map((a) => a.amount));
    return Math.max(maxBid, maxAsk, 1);
  };
  const asksWithCum = () => {
    let acc = 0;
    return props.asks.map((a) => {
      acc += a.amount;
      return { ...a, cumulative: acc };
    });
  };
  const bidsWithCum = () => {
    let acc = 0;
    return props.bids.map((b) => {
      acc += b.amount;
      return { ...b, cumulative: acc };
    });
  };

  return (
    <div class="order-book">
      <div class="ob-header">
        <span>{t('trade.priceUsdt')}</span>
        <span>{t('trade.amountCol')}</span>
        <span>{t('trade.accumulatedCol')}</span>
      </div>
      <div class="asks">
        <For each={asksWithCum()}>
          {(ask) => {
            const widthPercentage = (ask.amount / maxAmount()) * 100;
            return (
              <div class="ask ob-row">
                <div class="depth-bar depth-bar-ask" style={{ width: `${widthPercentage}%` }} />
                <span class="price mono" style={{ color: '#f6465d' }}>{ask.price.toFixed(2)}</span>
                <span class="amount mono">{ask.amount.toFixed(4)}</span>
                <span class="cumulative mono">{ask.cumulative.toFixed(4)}</span>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={props.currentPrice != null}>
        <div class={`current-price mono ${props.flashClass || ''}`}>
          {props.currentPrice?.toFixed(2)} {formatFiatPrice(locale(), props.currentPrice!)}
        </div>
      </Show>
      <div class="bids">
        <For each={bidsWithCum()}>
          {(bid) => {
            const widthPercentage = (bid.amount / maxAmount()) * 100;
            return (
              <div class="bid ob-row">
                <div class="depth-bar depth-bar-bid" style={{ width: `${widthPercentage}%` }} />
                <span class="price mono" style={{ color: '#2ebd85' }}>{bid.price.toFixed(2)}</span>
                <span class="amount mono">{bid.amount.toFixed(4)}</span>
                <span class="cumulative mono">{bid.cumulative.toFixed(4)}</span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default OrderBook;
