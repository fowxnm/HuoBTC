/**
 * Eden Treaty Client for Type-Safe API Communication
 * 
 * This client provides full type safety between frontend and backend
 * by leveraging the exported App type from the Elysia backend
 */

import { edenTreaty } from '@elysiajs/eden';
import type { App } from '@btc/backend';

// Create the Eden client
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = edenTreaty<App>(BASE_URL, {
    fetch: {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    // Add interceptor for auth token
    onRequest: (path, options) => {
        const isAdmin = path.startsWith('/api/admin') || path.startsWith('/api/agent');
        const token = isAdmin
            ? localStorage.getItem('admin_token')
            : localStorage.getItem('token');

        if (token && options.headers) {
            (options.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }

        const lang = localStorage.getItem('lang') || 'en';
        if (options.headers) {
            (options.headers as Record<string, string>)['Accept-Language'] = lang;
        }

        return options;
    }
});

// Export typed API client
export default api;

/**
 * Example usage:
 * 
 * // Type-safe API call
 * const { data, error } = await api.api.user.info.get();
 * if (error) {
 *   console.error(error);
 * } else {
 *   console.log(data); // Fully typed!
 * }
 * 
 * // POST request
 * const result = await api.api.trade.buy.post({
 *   currency_id: 1,
 *   legal_id: 3,
 *   price: 50000,
 *   number: 0.1,
 *   type: 1
 * });
 */
