/**
 * TRON 钱包桥 - 触发钱包选择弹窗
 * 此文件保留以兼容旧代码，实际逻辑已移至 WalletModal
 */
import { openWalletModal } from '../components/WalletModal';

declare global {
  interface Window {
    __openTronWallet?: () => void;
    __closeTronWallet?: () => void;
  }
}

// 初始化全局函数
if (typeof window !== 'undefined') {
  window.__openTronWallet = () => {
    openWalletModal();
  };

  window.__closeTronWallet = () => {
    // 断开连接逻辑在 walletStore 中处理
  };
}

// React 组件（兼容 AppKitRoot）
function TronWalletBridge() {
  return null;
}

export default TronWalletBridge;
