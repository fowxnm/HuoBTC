/**
 * 钱包配置 - 纯 TRON 模式
 * - 优先使用 TronLink (window.tronWeb)
 * - 已完全移除 AppKit/ethers，避免 TronGrid 轮询错误
 */

declare global {
  interface Window {
    tronWeb?: {
      ready: boolean;
      defaultAddress: { base58: string; hex: string };
      request: (args: { method: string }) => Promise<{ code?: number }>;
      trx: {
        sign: (message: string) => Promise<string>;
        getBalance: (address: string) => Promise<number>;
      };
    };
  }
}

export const TRON_CONFIG = {
  name: 'Tron',
  chainId: '0x2b6653dc',
  nativeCurrency: { name: 'TRX', symbol: 'TRX', decimals: 6 },
  rpcUrl: 'https://api.trongrid.io',
  explorer: 'https://tronscan.org',
} as const;

const projectId = import.meta.env.VITE_WC_PROJECT_ID || import.meta.env.VITE_APPKIT_PROJECT_ID || '';

export { projectId };
