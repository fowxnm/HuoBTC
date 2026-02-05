/**
 * Capacitor 配置：将前端 dist 同步到手机壳子（Android/iOS）
 * 全程用 Bun，不用 npm：
 *   1. 构建：cd frontend && bun run build
 *   2. 物理同步到手机项目：bunx cap copy（必须），bunx cap sync（可选，会更新原生依赖）
 * 根目录快捷：bun run build:frontend && bun run cap:copy
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.btcexchange.app',
  appName: 'BTC Exchange',
  webDir: 'dist',
  server: {
    // 若需开发时直连电脑后端，可设 androidCleartextTrafficPermitted
  },
};

export default config;
