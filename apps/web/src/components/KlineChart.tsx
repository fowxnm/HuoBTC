/**
 * K 线图：lightweight-charts，含底部 VOL 柱状图，稳定挂载与清理
 */

import { Component, onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { marketWs } from '../utils/websocket';

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface KlineChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  useMock?: boolean;
  /** 真实 K 线（如 Binance），有则优先使用，无则用 getMockBars */
  realBars?: OHLCBar[];
  getMockBars?: () => OHLCBar[];
  getMockCurrentBar?: () => { open: number; high: number; low: number };
  getMockLastPrice?: () => number;
  /** 当前周期 K 线起始时间（UTC 秒），用于实时更新时对齐时间轴 */
  getMockCurrentBarStartTime?: () => number;
}

const MA_PERIODS = [5, 10, 30, 60] as const;
const MA_COLORS = ['#2ebd85', '#f0b90b', '#b87cff', '#00a4d8'];
const CHART_HEIGHT = 420;
const VOL_PANE_RATIO = 0.25;

/** lightweight-charts 内部按 UTC 处理；转为“本地时间等价 UTC”后传入，时间轴即显示为本地时间 */
function utcSecToLocalFakeUTC(utcSec: number): number {
  const d = new Date(utcSec * 1000);
  return (
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds()
    ) / 1000
  );
}

function toUTCTimestamp(utcSec: number): UTCTimestamp {
  return Math.floor(utcSec) as UTCTimestamp;
}

function computeMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

const KlineChart: Component<KlineChartProps> = (props) => {
  const { t } = useI18n();
  let chartContainer: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let candlestickSeries: ISeriesApi<'Candlestick'> | undefined;
  let volumeSeries: ISeriesApi<'Histogram'> | undefined;
  let maSeries: ISeriesApi<'Line'>[] = [];
  const closeHistory: number[] = [];
  const timeHistory: UTCTimestamp[] = [];
  const MAX_HISTORY = 120;
  let unsubKline: () => void = () => {};
  let mockTickId: ReturnType<typeof setInterval> | null = null;

  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const subscribe = (symbol: string, interval: string) => {
    return marketWs.subscribeKline(symbol, interval, (data: any) => {
      setIsLoading(false);
      setError(null);
      const utcSec = Math.floor((data.time || Date.now()) / 1000);
      const t = toUTCTimestamp(utcSecToLocalFakeUTC(utcSec));
      const vol = data.volume ?? (data.high - data.low) * 100;
      candlestickSeries?.update({ time: t, open: data.open, high: data.high, low: data.low, close: data.close });
      volumeSeries?.update({ time: t, value: vol, color: data.close >= data.open ? 'rgba(46,189,133,0.5)' : 'rgba(246,70,93,0.5)' });
      closeHistory.push(data.close);
      timeHistory.push(t);
      if (closeHistory.length > MAX_HISTORY) {
        closeHistory.shift();
        timeHistory.shift();
      }
      MA_PERIODS.forEach((period, i) => {
        const ma = computeMA(closeHistory, period);
        if (ma != null && maSeries[i]) maSeries[i].update({ time: t, value: ma } as LineData);
      });
    });
  };

  const initChart = () => {
    if (!chartContainer) return;
    const w = chartContainer.clientWidth || 400;
    const h = props.height || CHART_HEIGHT;
    if (w < 10) return;

    try {
      chart = createChart(chartContainer, {
        width: w,
        height: h,
        layout: { background: { color: '#0b0e11' }, textColor: '#d9d9d9', attributionLogo: false },
        grid: { vertLines: { color: 'rgba(42,46,53,0.8)' }, horzLines: { color: 'rgba(42,46,53,0.8)' } },
        rightPriceScale: { borderColor: '#2c2c3e' },
        timeScale: {
          borderColor: '#2c2c3e',
          timeVisible: true,
          secondsVisible: false,
          rightBarOffset: 12,
          minBarSpacing: 2,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
      });

      candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#2ebd85',
        downColor: '#f6465d',
        borderDownColor: '#f6465d',
        borderUpColor: '#2ebd85',
        wickDownColor: '#f6465d',
        wickUpColor: '#2ebd85',
      });

      MA_PERIODS.forEach((_, i) => {
        const line = chart!.addSeries(LineSeries, { color: MA_COLORS[i], lineWidth: 2, priceLineVisible: false });
        maSeries.push(line);
      });

      chart.addPane(false);
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        scaleMargins: { top: 0.9, bottom: 0 },
      }, 1);
      const volPane = chart.panes()[1];
      if (volPane) volPane.setStretchFactor(VOL_PANE_RATIO);

      if (props.useMock && (props.realBars != null || props.getMockBars) && props.getMockCurrentBar && props.getMockLastPrice) {
        const bars = (props.realBars && props.realBars.length > 0) ? props.realBars : (props.getMockBars?.() ?? []);
        const toCandle = (b: OHLCBar): CandlestickData => ({
          time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        });
        const toVol = (b: OHLCBar): HistogramData => ({
          time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)),
          value: b.volume ?? (b.high - b.low) * 50,
          color: b.close >= b.open ? 'rgba(46,189,133,0.5)' : 'rgba(246,70,93,0.5)',
        });
        if (bars.length > 0) {
          candlestickSeries.setData(bars.map(toCandle));
          volumeSeries.setData(bars.map(toVol));
          bars.forEach((b) => closeHistory.push(b.close));
          const closes = bars.map((b) => b.close);
          MA_PERIODS.forEach((period, i) => {
            const vals: LineData[] = bars
              .map((b, j) => ({ time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)), value: computeMA(closes.slice(0, j + 1), period) ?? b.close }))
              .filter((v) => v.value != null) as LineData[];
            if (vals.length > 0) maSeries[i].setData(vals);
          });
        }
        setIsLoading(false);
        setError(null);
        mockTickId = setInterval(() => {
          const bar = props.getMockCurrentBar!();
          const close = props.getMockLastPrice!();
          const utcSec = props.getMockCurrentBarStartTime ? props.getMockCurrentBarStartTime() : Math.floor(Date.now() / 1000);
          const t = toUTCTimestamp(utcSecToLocalFakeUTC(utcSec));
          const candle: CandlestickData = { time: t, open: bar.open, high: Math.max(bar.high, close), low: Math.min(bar.low, close), close };
          candlestickSeries?.update(candle);
          volumeSeries?.update({ time: t, value: (Math.max(bar.high, close) - Math.min(bar.low, close)) * 50, color: close >= bar.open ? 'rgba(46,189,133,0.5)' : 'rgba(246,70,93,0.5)' });
          closeHistory.push(close);
          if (closeHistory.length > MAX_HISTORY) closeHistory.shift();
          MA_PERIODS.forEach((period, i) => {
            const ma = computeMA(closeHistory, period);
            if (ma != null && maSeries[i]) maSeries[i].update({ time: t, value: ma });
          });
        }, 500);
      } else {
        unsubKline = subscribe(props.symbol, props.interval || '1m');
      }

      const handleResize = () => {
        if (chart && chartContainer) {
          const width = chartContainer.clientWidth || 400;
          const height = props.height || CHART_HEIGHT;
          if (width > 0) chart.applyOptions({ width, height });
        }
      };
      window.addEventListener('resize', handleResize);
      onCleanup(() => {
        window.removeEventListener('resize', handleResize);
        unsubKline();
        if (mockTickId) clearInterval(mockTickId);
        chart?.remove();
        chart = undefined;
        candlestickSeries = undefined;
        volumeSeries = undefined;
        maSeries = [];
      });

      const timeout = setTimeout(() => {
        if (isLoading()) {
          setError(t('common.klineTimeout'));
          setIsLoading(false);
        }
      }, 15000);
      onCleanup(() => clearTimeout(timeout));
    } catch (err) {
      console.error('[KlineChart]', err);
      setError('图表初始化失败');
      setIsLoading(false);
    }
  };

  onMount(() => {
    const raf = requestAnimationFrame(() => {
      initChart();
    });
    onCleanup(() => cancelAnimationFrame(raf));
  });

  createEffect(() => {
    const sym = props.symbol;
    const int = props.interval || '1m';
    if (!candlestickSeries || !chart) return;
    if (props.useMock && (props.realBars != null || props.getMockBars) && props.getMockCurrentBar && props.getMockLastPrice) {
      if (mockTickId) {
        clearInterval(mockTickId);
        mockTickId = null;
      }
      const bars = (props.realBars && props.realBars.length > 0) ? props.realBars : (props.getMockBars?.() ?? []);
      const toCandle = (b: OHLCBar): CandlestickData => ({
        time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      });
      const toVol = (b: OHLCBar): HistogramData => ({
        time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)),
        value: b.volume ?? (b.high - b.low) * 50,
        color: b.close >= b.open ? 'rgba(46,189,133,0.5)' : 'rgba(246,70,93,0.5)',
      });
      closeHistory.length = 0;
      timeHistory.length = 0;
      if (bars.length > 0) {
        candlestickSeries.setData(bars.map(toCandle));
        volumeSeries?.setData(bars.map(toVol));
        bars.forEach((b) => closeHistory.push(b.close));
        const closes = bars.map((b) => b.close);
        MA_PERIODS.forEach((period, i) => {
          const vals: LineData[] = bars
            .map((b, j) => ({ time: toUTCTimestamp(utcSecToLocalFakeUTC(b.time)), value: computeMA(closes.slice(0, j + 1), period) ?? b.close }))
            .filter((v) => v.value != null) as LineData[];
          if (vals.length > 0) maSeries[i]?.setData(vals);
        });
      }
      return;
    }
    unsubKline();
    closeHistory.length = 0;
    timeHistory.length = 0;
    candlestickSeries.setData([]);
    volumeSeries?.setData([]);
    maSeries.forEach((s) => s.setData([]));
    setIsLoading(true);
    setError(null);
    unsubKline = subscribe(sym, int);
    onCleanup(() => unsubKline());
  });

  return (
    <div class="kline-chart-container relative w-full min-h-[400px]" style={{ height: `${props.height || CHART_HEIGHT}px` }}>
      {isLoading() && (
        <div class="absolute inset-0 flex items-center justify-center bg-dark-300/50 backdrop-blur-sm z-10">
          <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div class="text-gray-400 text-sm">{t('common.loadingRealtime')}</div>
          </div>
        </div>
      )}
      {error() && (
        <div class="absolute inset-0 flex items-center justify-center bg-dark-300/90 backdrop-blur-sm z-10">
          <div class="flex flex-col items-center gap-3 text-center px-4">
            <div class="text-danger font-medium">{error()}</div>
            <button type="button" onClick={() => window.location.reload()} class="px-4 py-2 bg-primary text-black rounded-md hover:opacity-90">
              刷新页面
            </button>
          </div>
        </div>
      )}
      <div
        ref={(el) => { chartContainer = el; }}
        class="w-full h-full"
        style={{ minHeight: '360px' }}
      />
    </div>
  );
};

export default KlineChart;
