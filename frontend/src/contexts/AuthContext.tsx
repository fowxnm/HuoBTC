/**
 * 认证上下文 - Web3 钱包为唯一登录方式，状态来自 walletStore（createMutable）实时同步
 */
import { createContext, useContext, ParentComponent, Accessor, onMount } from 'solid-js';
import { api } from '../utils/api';
import {
  walletStore,
  setWalletConnected,
  setWalletDisconnect,
  persistWallet,
  type WalletUser,
} from '../stores/walletStore';

interface User {
  id: number;
  account_number: string;
  email?: string;
  phone?: string;
  extension_code?: string;
  user_level?: number;
  wallet_address?: string;
  /** 后端返回的 8 位 UID */
  uid?: string;
}

interface AuthContextType {
  user: Accessor<User | null>;
  token: Accessor<string | null>;
  isLoggedIn: Accessor<boolean>;
  walletLogin: (address: string, signature: string, nonce: string, refCode?: string) => Promise<boolean>;
  logout: () => void;
  fetchUserInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const user = (): User | null => {
    const u = walletStore.user;
    if (!u) return null;
    return {
      id: u.id,
      account_number: u.account_number,
      wallet_address: u.wallet_address,
      uid: u.uid,
    };
  };
  const token = (): string | null => walletStore.token;
  const isLoggedIn = (): boolean => walletStore.connected;

  const walletLogin = async (
    address: string,
    signature: string,
    nonce: string,
    refCode?: string
  ): Promise<boolean> => {
    try {
      const response = await api.post('/api/auth/verify', {
        address,
        signature,
        nonce,
        refCode,
      });
      if (response.type === 'ok') {
        const data = response.data as { user_id: number; account: string; address: string; uid?: string; user_uid?: string };
        const uid = data.uid ?? data.user_uid;
        setWalletConnected({
          address: data.address,
          token: response.token,
          user: {
            id: data.user_id,
            account_number: data.account,
            wallet_address: data.address,
            uid: uid ?? undefined,
          },
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Wallet login error:', error);
      return false;
    }
  };

  const logout = async () => {
    // 调用后端 logout 接口（忽略错误，前端直接清除状态）
    try {
      await api.post('/api/user/logout');
    } catch (e) {
      // ignore
    }
    setWalletDisconnect();
  };

  const fetchUserInfo = async () => {
    if (!walletStore.token) return;
    try {
      const response = await api.get('/api/user/info');
      if (response.type === 'ok' && response.message) {
        const msg = response.message as { id: number; account_number?: string; wallet_address?: string; uid?: string };
        const prev = walletStore.user;
        walletStore.user = {
          id: msg.id,
          account_number: msg.account_number ?? prev?.account_number ?? '',
          wallet_address: msg.wallet_address ?? prev?.wallet_address,
          uid: msg.uid ?? prev?.uid,
        };
        persistWallet();
      }
    } catch (error) {
      console.error('Fetch user info error:', error);
    }
  };

  onMount(() => {
    if (walletStore.token && !walletStore.user) {
      fetchUserInfo();
    }
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn,
        walletLogin,
        logout,
        fetchUserInfo,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
