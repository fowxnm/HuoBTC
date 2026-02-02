import { onMount, onCleanup, createEffect } from 'solid-js';
import { createMockPriceEngine, getSymbolConfig, seedFromSymbol } from '../engine/mockPriceEngine';
import type { Accessor } from 'solid-js';

export function useMockPriceEngine(symbol: Accessor<string>) {
  const initial = getSymbolConfig(symbol());
  const engine = createMockPriceEngine({
    basePrice: initial.basePrice,
    sigmaPerSec: initial.sigmaPerSec,
    tickMs: 1500,
    tradeIntervalMin: 1500,
    tradeIntervalMax: 3500,
    seed: seedFromSymbol(symbol()),
  });

  onMount(() => {
    const stop = engine.start();
    onCleanup(stop);
  });

  createEffect(() => {
    const sym = symbol();
    const { basePrice, sigmaPerSec } = getSymbolConfig(sym);
    engine.reset({ basePrice, sigmaPerSec, seed: seedFromSymbol(sym) });
  });

  return engine;
}
