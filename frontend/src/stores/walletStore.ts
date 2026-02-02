/**
 * Web3 钱包全局状态 - createMutable 实时存储，全系统共享
 * 连接状态、地址、token、用户信息 持久化到 localStorage 并响应式更新
 */
import { createMutable } from 'solid-js/store';

const STORAGE_KEY_TOKEN = 'token';
const STORAGE_KEY_WALLET = 'wallet_state';

export interface WalletUser {
  id: number;
  account_number: string;
  wallet_address?: string;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  token: string | null;
  user: WalletUser | null;
  error: string | null;
  loading: boolean;
}

function loadPersisted(): Partial<WalletState> {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const raw = localStorage.getItem(STORAGE_KEY_WALLET);
    if (!token && !raw) return {};
    const data = raw ? JSON.parse(raw) : {};
    return {
      token: token || null,
      address: data.address || null,
      user: data.user || null,
      connected: !!(token && (data.address || data.user)),
    };
  } catch {
    return {};
  }
}

function persist(state: WalletState) {
  try {
    if (state.token) localStorage.setItem(STORAGE_KEY_TOKEN, state.token);
    else localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify({
      address: state.address,
      user: state.user,
    }));
  } catch {}
}

const initialState: WalletState = {
  connected: false,
  address: null,
  token: null,
  user: null,
  error: null,
  loading: false,
  ...loadPersisted(),
};

export const walletStore = createMutable<WalletState>(initialState);

export function setWalletConnected(payload: {
  address: string;
  token: string;
  user: WalletUser;
}) {
  walletStore.connected = true;
  walletStore.address = payload.address;
  walletStore.token = payload.token;
  walletStore.user = payload.user;
  walletStore.error = null;
  walletStore.loading = false;
  persist(walletStore);
}

export function setWalletDisconnect() {
  walletStore.connected = false;
  walletStore.address = null;
  walletStore.token = null;
  walletStore.user = null;
  walletStore.error = null;
  walletStore.loading = false;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_WALLET);
}

export function setWalletError(message: string) {
  walletStore.error = message;
  walletStore.loading = false;
}

export function setWalletLoading(loading: boolean) {
  walletStore.loading = loading;
  if (!loading) walletStore.error = null;
}

/** 仅持久化当前 store（如 fetchUserInfo 后更新了 user） */
export function persistWallet() {
  persist(walletStore);
}
