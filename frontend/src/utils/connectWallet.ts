/**
 * 共享连接钱包逻辑 - 纯 TRON 模式
 * - 优先使用 TronLink (window.tronWeb)
 * - 无 TronLink 时通过 WalletConnect 支持其他 TRON 钱包
 * - 已移除所有 ETH/EVM 相关逻辑
 */

declare global {
  interface Window {
    __openTronWallet?: () => void;
    __closeTronWallet?: () => void;
  }
}

/** 打开 TRON 钱包连接（TronLink 或 WalletConnect） */
export function openTronWallet(): void {
  if (typeof window !== 'undefined' && window.__openTronWallet) {
    window.__openTronWallet();
  }
}

/** 关闭/断开 TRON 钱包连接 */
export function closeTronWallet(): void {
  if (typeof window !== 'undefined' && window.__closeTronWallet) {
    window.__closeTronWallet();
  }
}

/** 检查 TronLink 是否已安装 */
export function hasTronLink(): boolean {
  return typeof window !== 'undefined' && !!window.tronWeb;
}

/** 获取当前连接的 TRON 地址 */
export function getTronAddress(): string | null {
  if (typeof window !== 'undefined' && window.tronWeb?.defaultAddress?.base58) {
    return window.tronWeb.defaultAddress.base58;
  }
  return null;
}

/** 缩写 TRON 地址显示，如 T1234...5678 */
export function shortenAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** @deprecated 使用 openTronWallet() 代替 */
export function openAppKit(): void {
  openTronWallet();
}
