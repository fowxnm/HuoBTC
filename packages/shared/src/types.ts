/**
 * @btc/shared - Shared Types
 * 
 * Type definitions shared between backend and frontend
 */

/**
 * User entity
 */
export interface User {
    id: number;
    accountNumber: string;
    phone: string;
    email: string;
    walletAddress?: string;
    status: number;
    risk: number; // 0=normal, 1=must-win, -1=must-lose
    createTime: number;
}

/**
 * Wallet balance types
 */
export type BalanceType = 'legal' | 'change' | 'lever' | 'micro';

/**
 * Wallet entity
 */
export interface Wallet {
    id: number;
    userId: number;
    currency: number;
    legalBalance: string;
    changeBalance: string;
    leverBalance: string;
    microBalance: string;
    lockLegalBalance: string;
    lockChangeBalance: string;
    lockLeverBalance: string;
    lockMicroBalance: string;
    address: string;
}

/**
 * Currency entity
 */
export interface Currency {
    id: number;
    name: string;
    logo: string;
    type: string; // 'crypto' | 'forex' | 'stock' | 'metal'
    isDisplay: number;
    isMatch: number;
    isLegal: number;
}

/**
 * Trading pair
 */
export interface TradingPair {
    id: number;
    currency: number;
    legal: number;
    currencyName: string;
    legalName: string;
    openMicro: number;
}

/**
 * Order status
 */
export type OrderStatus = 0 | 1 | 2 | 3; // pending, partial, filled, cancelled

/**
 * Spot order
 */
export interface SpotOrder {
    id: number;
    userId: number;
    currencyId: number;
    legalId: number;
    type: number; // 1=limit, 2=market
    side: 'buy' | 'sell';
    price: string;
    number: string;
    dealNumber: string;
    dealMoney: string;
    status: OrderStatus;
    createTime: number;
}

/**
 * Lever transaction
 */
export interface LeverTransaction {
    id: number;
    userId: number;
    currency: number;
    legal: number;
    type: number; // 1=long, 2=short
    multiple: number;
    price: string;
    number: string;
    status: number; // 0=open, 1=closed, 2=liquidated
    factProfits: string;
    createTime: number;
}

/**
 * Micro order (options)
 */
export interface MicroOrder {
    id: number;
    userId: number;
    matchId: number;
    currencyId: number;
    type: number; // 1=up, 2=down
    seconds: number;
    number: string;
    openPrice: string;
    endPrice?: string;
    profitRatio: string;
    fee: string;
    status: number; // 0=trading, 1=settled
    preResult?: number; // for risk control
    factProfit?: string;
    handledAt: number;
    createdAt: number;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
    type: 'ok' | 'error';
    message?: string;
    data?: T;
    token?: string;
}

/**
 * Pagination params
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    list: T[];
    page: number;
    limit: number;
    total?: number;
}
