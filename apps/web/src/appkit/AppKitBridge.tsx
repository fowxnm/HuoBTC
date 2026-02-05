/**
 * React 桥：挂载 AppKit 并暴露 open 给 Solid；连接后走后端 nonce → sign → verify
 */
import { useEffect, useRef } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import '../appkit/config';
import { api } from '../utils/api';
import { setWalletConnected, setWalletLoading, setWalletError } from '../stores/walletStore';

declare global {
  interface Window {
    __openAppKit?: (options?: { view?: string }) => void;
    __closeAppKit?: () => void;
    tronWeb?: any;
  }
}

function AppKitBridgeInner() {
  const { open, close } = useAppKit();
  // We minimize AppKit usage for Tron to prefer native tronWeb
  const authDoneRef = useRef<Set<string>>(new Set());

  // Expose open/close to global
  useEffect(() => {
    window.__openAppKit = async (opts) => {
      // 优先检测 TronWeb
      if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
        // Already connected to Tron
        runTronAuth(window.tronWeb.defaultAddress.base58);
      } else if (window.tronWeb) {
        // Request Tron connection
        const res = await window.tronWeb.request({ method: 'tron_requestAccounts' });
        if (res && res.code === 200) {
          runTronAuth(window.tronWeb.defaultAddress.base58);
        } else {
          open(opts || { view: 'Connect' });
        }
      } else {
        // @ts-ignore - view type mismatch workaround
        open(opts || { view: 'Connect' });
      }
    };
    window.__closeAppKit = close;
    return () => {
      delete window.__openAppKit;
      delete window.__closeAppKit;
    };
  }, [open, close]);

  const runTronAuth = async (address: string) => {
    if (authDoneRef.current.has(address)) return;
    setWalletLoading(true);
    setWalletError('');
    try {
      // 1. Get Nonce
      const nonceRes = await api.get('/api/auth/nonce', { address }) as { type: string; nonce?: string };
      if (nonceRes.type !== 'ok' || !nonceRes.nonce) {
        throw new Error('获取签名随机数失败');
      }
      const nonce = nonceRes.nonce;

      // 2. Offline Sign (Tron)
      const signedStr = await window.tronWeb.trx.sign(nonce);

      // 3. Verify
      const response = await api.post('/api/auth/verify', {
        address,
        signature: signedStr,
        nonce,
        type: 'tron'
      });

      if (response.type === 'ok') {
        setWalletConnected({
          address: response.data.address,
          token: response.token,
          user: {
            id: response.data.user_id,
            account_number: response.data.account,
            wallet_address: response.data.address,
          },
        });
        authDoneRef.current.add(address);
        window.__closeAppKit?.();
      } else {
        throw new Error((response.message as string) || '签名验证失败');
      }
    } catch (e: any) {
      console.error(e);
      setWalletError((e?.message as string) || 'Tron 授权失败');
    } finally {
      setWalletLoading(false);
    }
  };

  // Keep Ethers/AppKit listener for non-Tron fallback (if any)
  const { address: ethAddress, isConnected: isEthConnected } = useAppKitAccount();
  useEffect(() => {
    if (isEthConnected && ethAddress && !authDoneRef.current.has(ethAddress)) {
      // Regular ETH Auth logic (omitted or kept same as before)
      // For "Only Tron", we might want to ignore this or show error
    }
  }, [isEthConnected, ethAddress]);

  return null;
}

export default AppKitBridgeInner;
