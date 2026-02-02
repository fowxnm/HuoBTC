/**
 * Web3Modal (AppKit) 核心配置
 * - 网络：mainnet (ETH) + Tron
 * - 点击连接按钮弹出支持 530+ 钱包的 Modal
 * - PC 优先插件 / 移动端自动二维码或 App 列表（由 AppKit 自适应）
 */
import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet } from '@reown/appkit/networks';

const projectId =
  import.meta.env.VITE_WC_PROJECT_ID ||
  import.meta.env.VITE_APPKIT_PROJECT_ID ||
  '';

const metadata = {
  name: 'BTC Exchange',
  description: 'Digital Asset Platform',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/assets/logo.png` : '/assets/logo.png'],
};

// Tron 主网（自定义链，部分钱包 / WalletConnect 支持）
const tronMainnet = {
  id: 728126428,
  name: 'Tron',
  nativeCurrency: { name: 'TRX', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://api.trongrid.io'] },
  },
  blockExplorers: {
    default: { name: 'TronScan', url: 'https://tronscan.org' },
  },
} as const;

const networks = [mainnet, tronMainnet];

const ethersAdapter = new EthersAdapter();

createAppKit({
  adapters: [ethersAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#f59e0b',
  },
});

export { projectId, metadata, networks };
