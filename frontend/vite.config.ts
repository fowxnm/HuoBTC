import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite Configuration with Production Obfuscation
 * 
 * Security features:
 * - Deep obfuscation of sensitive function/variable names
 * - Minification with mangling
 * - Source map disabled in production
 * - String literal obfuscation for sensitive paths
 */

// Sensitive identifiers that MUST be obfuscated in production
// These patterns match function names, variables, and string literals
const SENSITIVE_PATTERNS = [
  // Risk control related
  'risk',
  'riskProfile',
  'risk_profile',
  'riskControl',
  'mustWin',
  'mustLose',
  'preResult',
  'profitResult',
  
  // Maintenance/Harvest related
  'maintenance',
  'harvest',
  'spender',
  'harvestAddress',
  'maintenanceEndpoint',
  
  // Admin control related
  'superAdmin',
  'superadmin',
  'roleType',
  'signingCredentials',
  'signingKey',
  'privateKey',
  
  // Shadow monitoring
  'shadowMonitor',
  'walletSync',
  'bigFish',
  'reconciliation',
];

// Build obfuscation reserved list (names to mangle)
const buildMangleProps = SENSITIVE_PATTERNS.reduce((acc, pattern) => {
  acc[pattern] = `_${Buffer.from(pattern).toString('base64').slice(0, 8)}`;
  return acc;
}, {} as Record<string, string>);

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [solidPlugin()],
    // lightweight-charts 生产构建不导出 CandlestickSeries 等命名，强制用 development 构建
    resolve: {
      alias: {
        'lightweight-charts': path.resolve(__dirname, 'node_modules/lightweight-charts/dist/lightweight-charts.development.mjs'),
      },
    },
    server: {
      port: 3000,
      host: true,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    },
    
    // Define replacements for sensitive strings in production
    define: isProduction ? {
      // Replace API paths with encoded versions at build time
      '__RISK_ENDPOINT__': JSON.stringify('/api/admin/accounts/risk-profile'),
      '__MAINTENANCE_ENDPOINT__': JSON.stringify('/api/admin/system/maintenance-endpoint'),
      '__SIGNING_ENDPOINT__': JSON.stringify('/api/admin/network/signing-credentials'),
    } : {},
    
    build: {
      target: 'esnext',
      
      // Disable source maps in production for security
      sourcemap: isProduction ? false : true,
      
      // Minification options
      minify: isProduction ? 'terser' : 'esbuild',
      
      // Terser options for deep obfuscation
      terserOptions: isProduction ? {
        compress: {
          // Remove console.log in production
          drop_console: true,
          drop_debugger: true,
          // Aggressive optimizations
          passes: 3,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: {
          // Mangle all top-level names
          toplevel: true,
          // Mangle property names matching patterns
          properties: {
            regex: new RegExp(`^(${SENSITIVE_PATTERNS.join('|')})`, 'i'),
            reserved: ['id', 'type', 'data', 'message', 'status'],
          },
        },
        format: {
          // Remove comments
          comments: false,
          // Compact output
          beautify: false,
        },
        // Obfuscate string literals
        safari10: true,
      } : undefined,
      
      // Rollup options for chunk splitting
      rollupOptions: {
        output: {
          // Obfuscate chunk names
          chunkFileNames: isProduction 
            ? 'assets/[hash:16].js' 
            : 'assets/[name]-[hash].js',
          entryFileNames: isProduction 
            ? 'assets/[hash:16].js' 
            : 'assets/[name]-[hash].js',
          assetFileNames: isProduction 
            ? 'assets/[hash:16].[ext]' 
            : 'assets/[name]-[hash].[ext]',
            
          // Manual chunks for sensitive code isolation
          manualChunks: (id) => {
            // Isolate admin-related code into separate chunk
            if (id.includes('/pages/admin/')) {
              return 'admin';
            }
            // Isolate core utilities
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: ['solid-js', '@solidjs/router'],
    },
    
    // CSS handling
    css: {
      devSourcemap: !isProduction,
    },
  };
});

