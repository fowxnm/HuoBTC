/**
 * 共享连接钱包逻辑
 * 优先使用 Web3Modal (AppKit)：打开选择器 Modal，连接后走后端 nonce → sign → verify
 * 供 Header、Connect 页、移动端统一调用
 */
import { api } from './api';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    __openAppKit?: (options?: { view?: string }) => void;
  }
}

/** 打开 Web3Modal 选择器（530+ 钱包，PC 优先插件 / 移动端二维码或 App 列表） */
export function openAppKit(): void {
  if (typeof window !== 'undefined' && window.__openAppKit) {
    window.__openAppKit({ view: 'Connect' });
  }
}

export type WalletLoginFn = (address: string, signature: string, nonce: string, refCode?: string) => Promise<boolean>;

/** 使用原生 window.ethereum.request 请求账户（与 viem 兼容） */
async function requestAccounts(): Promise<string> {
  const win = typeof window !== 'undefined' ? window : undefined;
  if (!win?.ethereum) {
    throw new Error('NO_ETHEREUM');
  }
  const result = await win.ethereum.request({ method: 'eth_requestAccounts', params: [] });
  const accounts = Array.isArray(result) ? result : [];
  const address = (accounts[0] as string)?.trim?.();
  if (!address) {
    throw new Error('NO_ACCOUNT');
  }
  return address;
}

/**
 * 执行完整连接流程并登录
 * @param walletLogin 来自 useAuth().walletLogin
 * @param refCode 可选邀请码
 */
export async function connectAndLogin(
  walletLogin: WalletLoginFn,
  refCode?: string
): Promise<{ ok: boolean; address?: string; error?: string }> {
  try {
    const address = await requestAccounts();
    console.log('Wallet connected:', address);

    const nonceRes = await api.get('/api/auth/nonce', { address }) as { type: string; nonce?: string };
    if (nonceRes.type !== 'ok' || !nonceRes.nonce) {
      return { ok: false, error: '获取签名随机数失败' };
    }
    const nonce = nonceRes.nonce;

    const win = typeof window !== 'undefined' ? window : undefined;
    if (!win?.ethereum) return { ok: false, error: '请安装 MetaMask 或其它 Web3 钱包' };

    let signature: string;
    try {
      const { createWalletClient, custom } = await import('viem');
      const { mainnet } = await import('viem/chains');
      const client = createWalletClient({
        chain: mainnet,
        transport: custom(win.ethereum),
      });
      const [acc] = await client.getAddresses();
      if (!acc) return { ok: false, error: '未获取到钱包地址' };
      signature = await client.signMessage({ account: acc, message: nonce });
    } catch {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(win.ethereum);
      const signer = await provider.getSigner();
      signature = await signer.signMessage(nonce);
    }

    const success = await walletLogin(address, signature, nonce, refCode);
    if (success) {
      console.log('Wallet connected (verified):', address);
      return { ok: true, address };
    }
    return { ok: false, error: '签名验证失败，请重试' };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 4001) {
      return { ok: false, error: '您已取消签名' };
    }
    if ((e?.message as string)?.includes?.('NO_ETHEREUM')) {
      return { ok: false, error: '请安装 MetaMask 或其它 Web3 钱包' };
    }
    if ((e?.message as string)?.includes?.('NO_ACCOUNT')) {
      return { ok: false, error: '未获取到钱包地址' };
    }
    const msg = (e?.message as string) || '连接失败，请重试';
    return { ok: false, error: msg };
  }
}

/** 缩写地址显示，如 0x1234...5678 */
export function shortenAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
