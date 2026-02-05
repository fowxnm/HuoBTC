/**
 * Solid 组件：挂载 React 版 AppKit 桥，使「连接钱包」打开 Web3Modal
 */
import { onMount } from 'solid-js';
import { createRoot } from 'react-dom/client';
import React from 'react';
import AppKitBridge from '../appkit/AppKitBridge';

export default function AppKitRoot() {
  let container: HTMLDivElement | undefined;

  onMount(() => {
    if (!container) return;
    const root = createRoot(container);
    root.render(React.createElement(AppKitBridge));
    return () => root.unmount();
  });

  return <div ref={container} />;
}
