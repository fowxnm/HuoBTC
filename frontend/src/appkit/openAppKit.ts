/**
 * TRON 钱包连接入口 - 纯 TRON 模式
 * - 优先使用 TronLink (window.tronWeb)
 * - 无 TronLink 时通过 WalletConnect 支持其他 TRON 钱包
 * - 已移除所有 ETH/EVM 相关逻辑
 */

/** 打开 TRON 钱包连接（TronLink 或 WalletConnect） */
export function openConnectModal(): void {
  window.__openTronWallet?.();
}

/** @deprecated 纯 TRON 模式无需切换网络 */
export function openNetworksModal(): void {
  openConnectModal();
}

/** @deprecated 纯 TRON 模式，直接打开连接 */
export function suggestNetworkForAsset(_asset?: string): void {
  openConnectModal();
}
