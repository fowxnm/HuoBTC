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
  }
}

function AppKitBridgeInner() {
  const { open, close } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155') as { walletProvider?: unknown };
  const authDoneRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.__openAppKit = (opts) => open(opts || { view: 'Connect' });
    window.__closeAppKit = close;
    return () => {
      delete window.__openAppKit;
      delete window.__closeAppKit;
    };
  }, [open, close]);

  useEffect(() => {
    if (!isConnected || !address || !walletProvider || authDoneRef.current.has(address)) return;

    const runAuth = async () => {
      setWalletLoading(true);
      setWalletError(null);
      try {
        const nonceRes = await api.get('/api/auth/nonce', { address }) as { type: string; nonce?: string };
        if (nonceRes.type !== 'ok' || !nonceRes.nonce) {
          setWalletError('获取签名随机数失败');
          return;
        }
        const nonce = nonceRes.nonce;
        const provider = new BrowserProvider(walletProvider as import('ethers').Eip1193Provider);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(nonce);

        const response = await api.post('/api/auth/verify', {
          address,
          signature,
          nonce,
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
          setWalletError('签名验证失败，请重试');
        }
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        if (e?.code === 4001) {
          setWalletError('您已取消签名');
        } else {
          setWalletError((e?.message as string) || '连接失败，请重试');
        }
      } finally {
        setWalletLoading(false);
      }
    };

    runAuth();
  }, [isConnected, address, walletProvider]);

  return null;
}

export default AppKitBridgeInner;
