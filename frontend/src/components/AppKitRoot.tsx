/**
 * Solid 组件：挂载 TronLink 钱包桥
 * 纯 TRON 模式，已移除 AppKit
 */
import { onMount } from 'solid-js';
import { createRoot } from 'react-dom/client';
import React from 'react';
import TronWalletBridge from '../appkit/AppKitBridge';

export default function AppKitRoot() {
  let container: HTMLDivElement | undefined;

  onMount(() => {
    if (!container) return;
    const root = createRoot(container);
    root.render(React.createElement(TronWalletBridge));
    return () => root.unmount();
  });

  return <div ref={container} />;
}
