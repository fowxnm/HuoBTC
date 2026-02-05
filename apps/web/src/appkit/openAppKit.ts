/**
 * 供 Solid 调用的 AppKit 入口
 * - 点击连接：打开 530+ 钱包选择 Modal
 * - 自适应：USDT-TRC20 时提示切 Tron，ETH 时保持主网
 */

declare global {
  interface Window {
    __openAppKit?: (options?: { view?: string }) => void;
    __openAppKitNetworks?: () => void;
  }
}

/** 打开连接钱包 Modal（默认 Connect 视图） */
export function openConnectModal(): void {
  window.__openAppKit?.({ view: 'Connect' });
}

/** 打开网络切换视图（用于提示用户切换到 Tron / 以太坊） */
export function openNetworksModal(): void {
  window.__openAppKit?.({ view: 'Networks' });
}

/**
 * 自适应授权：根据业务场景建议网络
 * - 交易/充值 USDT-TRC20 时提示切换到 Tron
 * - 处理 ETH 时保持在以太坊主网（无需操作）
 */
/**
 * 根据资产类型建议网络：
 * - USDT-TRC20：打开网络切换 Modal，提示切换到 Tron
 * - ETH：保持在以太坊主网，无需操作
 */
export function suggestNetworkForAsset(asset: 'USDT-TRC20' | 'ETH'): void {
  if (asset === 'USDT-TRC20') {
    openNetworksModal();
  }
  // ETH：保持当前主网，无需弹窗
}
