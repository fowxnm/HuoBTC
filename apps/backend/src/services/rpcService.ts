/**
 * RPC Service - Multi-Node Redundancy (多节点冗余)
 * 
 * Features:
 * - Multiple RPC endpoint support with automatic failover
 * - Health checking and node rotation
 * - Weighted selection for load balancing
 * - Automatic recovery when nodes come back online
 * 
 * Supported Chains:
 * - ETH (Ethereum Mainnet)
 * - BSC (Binance Smart Chain)
 * - TRON (Tron Network)
 */

import { createPublicClient, http, PublicClient } from 'viem';
import { mainnet, bsc } from 'viem/chains';
import { setTimeout } from 'timers/promises';

// Node health status
interface NodeHealth {
  url: string;
  isHealthy: boolean;
  lastCheck: number;
  latency: number;
  failCount: number;
  successCount: number;
}

// Chain configuration
interface ChainConfig {
  name: string;
  nodes: NodeHealth[];
  currentIndex: number;
  lastRotation: number;
}

// RPC Manager class
class RPCManager {
  private chains: Map<string, ChainConfig> = new Map();
  private healthCheckInterval: number = 30000; // 30 seconds
  private maxFailCount: number = 3;
  private healthCheckTimer: any = null;
  private circuitOpen: boolean = false;
  private lastFailureTime: number = 0;
  private failureCount: number = 0;

  constructor() {
    this.initializeChains();
    this.startHealthChecks();
  }

  /**
   * Initialize chains from environment variables
   */
  private initializeChains() {
    // ETH nodes
    const ethEndpoints = (process.env.ETH_RPC_ENDPOINTS || '').split(',').filter(Boolean);
    const ethBackups = (process.env.ETH_RPC_BACKUP || '').split(',').filter(Boolean);
    this.chains.set('ETH', {
      name: 'Ethereum',
      nodes: [...ethEndpoints, ...ethBackups].map(url => this.createNodeHealth(url.trim())),
      currentIndex: 0,
      lastRotation: Date.now(),
    });

    // BSC nodes
    const bscEndpoints = (process.env.BSC_RPC_ENDPOINTS || '').split(',').filter(Boolean);
    const bscBackups = (process.env.BSC_RPC_BACKUP || '').split(',').filter(Boolean);
    this.chains.set('BSC', {
      name: 'BSC',
      nodes: [...bscEndpoints, ...bscBackups].map(url => this.createNodeHealth(url.trim())),
      currentIndex: 0,
      lastRotation: Date.now(),
    });

    // TRON nodes
    const tronEndpoints = (process.env.TRON_RPC_ENDPOINTS || '').split(',').filter(Boolean);
    const tronBackups = (process.env.TRON_RPC_BACKUP || '').split(',').filter(Boolean);
    this.chains.set('TRON', {
      name: 'TRON',
      nodes: [...tronEndpoints, ...tronBackups].map(url => this.createNodeHealth(url.trim())),
      currentIndex: 0,
      lastRotation: Date.now(),
    });

    console.log('[RPC] Initialized chains:');
    this.chains.forEach((config, chain) => {
      console.log(`  ${chain}: ${config.nodes.length} nodes configured`);
    });
  }

  private createNodeHealth(url: string): NodeHealth {
    return {
      url,
      isHealthy: true,
      lastCheck: 0,
      latency: 0,
      failCount: 0,
      successCount: 0,
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.checkAllNodes();
    }, this.healthCheckInterval);

    // Initial check
    this.checkAllNodes();
  }

  /**
   * Check health of all nodes
   */
  private async checkAllNodes() {
    for (const [chain, config] of this.chains) {
      for (const node of config.nodes) {
        await this.checkNodeHealth(chain, node);
      }
    }
  }

  /**
   * Check health of a single node
   */
  private async checkNodeHealth(chain: string, node: NodeHealth) {
    const startTime = Date.now();
    
    try {
      if (chain === 'TRON') {
        // TRON uses different API
        const response = await fetch(`${node.url}/wallet/getnowblock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) throw new Error('TRON node unhealthy');
      } else {
        // ETH/BSC use JSON-RPC
        const response = await fetch(node.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) throw new Error('RPC node unhealthy');
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
      }

      // Success
      node.latency = Date.now() - startTime;
      node.lastCheck = Date.now();
      node.failCount = 0;
      node.successCount++;
      
      if (!node.isHealthy) {
        node.isHealthy = true;
        console.log(`[RPC] ${chain} node recovered: ${this.maskUrl(node.url)}`);
      }
    } catch (error) {
      // Failure
      node.lastCheck = Date.now();
      node.failCount++;
      
      if (node.failCount >= this.maxFailCount && node.isHealthy) {
        node.isHealthy = false;
        console.warn(`[RPC] ${chain} node marked unhealthy: ${this.maskUrl(node.url)}`);
        
        // Trigger failover if this was the current node
        const config = this.chains.get(chain);
        if (config && config.nodes[config.currentIndex] === node) {
          this.failover(chain);
        }
      }
    }
  }

  /**
   * Get the current active RPC URL for a chain
   */
  public getActiveUrl(chain: string): string | null {
    const config = this.chains.get(chain);
    if (!config || config.nodes.length === 0) {
      return null;
    }

    // Find a healthy node
    let attempts = 0;
    while (attempts < config.nodes.length) {
      const node = config.nodes[config.currentIndex];
      if (node.isHealthy) {
        return node.url;
      }
      
      // Move to next node
      config.currentIndex = (config.currentIndex + 1) % config.nodes.length;
      attempts++;
    }

    // No healthy nodes, return first one anyway
    console.warn(`[RPC] ${chain}: No healthy nodes, using first available`);
    return config.nodes[0]?.url || null;
  }

  /**
   * Manually trigger failover to next node
   */
  public async failover(chain: string): Promise<boolean> {
    const config = this.chains.get(chain);
    if (!config || config.nodes.length <= 1) {
      return false;
    }

    const oldIndex = config.currentIndex;
    
    // Find next healthy node
    for (let i = 1; i < config.nodes.length; i++) {
      const nextIndex = (oldIndex + i) % config.nodes.length;
      if (config.nodes[nextIndex].isHealthy) {
        config.currentIndex = nextIndex;
        config.lastRotation = Date.now();
        
        console.log(`[RPC] ${chain} failover: ${this.maskUrl(config.nodes[oldIndex].url)} → ${this.maskUrl(config.nodes[nextIndex].url)}`);
        return true;
      }
    }

    console.warn(`[RPC] ${chain}: No healthy backup nodes available`);
    return false;
  }

  /**
   * Get health status of all nodes for a chain
   */
  public getChainStatus(chain: string): NodeHealth[] | null {
    return this.chains.get(chain)?.nodes || null;
  }

  /**
   * Get summary of all chains
   */
  public getStatus(): Record<string, { healthy: number; total: number; activeUrl: string | null }> {
    const status: Record<string, any> = {};
    
    for (const [chain, config] of this.chains) {
      const healthy = config.nodes.filter(n => n.isHealthy).length;
      status[chain] = {
        healthy,
        total: config.nodes.length,
        activeUrl: this.maskUrl(this.getActiveUrl(chain) || ''),
      };
    }
    
    return status;
  }

  /**
   * Mask URL for logging (hide API keys)
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.length > 10) {
        return `${parsed.origin}/${parsed.pathname.slice(1, 8)}...`;
      }
      return `${parsed.origin}/***`;
    } catch {
      return url.slice(0, 20) + '...';
    }
  }

  /**
   * Exponential backoff with jitter
   */
  private async waitForRetry() {
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(2, this.failureCount), maxDelay);
    const jitter = delay * 0.2 * Math.random();
    await setTimeout(delay + jitter);
  }

  /**
   * Execute RPC call with automatic retry and failover
   */
  public async executeWithRetry<T>(
    chain: string,
    method: string,
    params: any[],
    maxRetries: number = 3
  ): Promise<T> {
    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.lastFailureTime < 30000) {
        throw new Error('RPC circuit breaker open');
      }
      this.circuitOpen = false;
    }

    for (let i = 0; i < this.chains.get(chain)?.nodes.length; i++) {
      const url = this.getActiveUrl(chain);
      if (!url) {
        throw new Error(`No RPC endpoints configured for ${chain}`);
      }

      try {
        if (chain === 'TRON') {
          // TRON API call
          const response = await fetch(`${url}${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params[0] || {}),
            signal: AbortSignal.timeout(10000),
          });
          return await response.json();
        } else {
          // ETH/BSC JSON-RPC call
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method,
              params,
              id: Date.now(),
            }),
            signal: AbortSignal.timeout(10000),
          });
          
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error.message);
          }
          return data.result;
        }
      } catch (error: any) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= 3) {
          this.circuitOpen = true;
        }

        if (i < this.chains.get(chain)?.nodes.length - 1) {
          await this.waitForRetry();
          await this.failover(chain);
        }
      }
    }
    throw new Error('All RPC providers failed');
  }

  /**
   * Cleanup
   */
  public destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }
}

// Singleton instance
let rpcManager: RPCManager | null = null;

export function getRPCManager(): RPCManager {
  if (!rpcManager) {
    rpcManager = new RPCManager();
  }
  return rpcManager;
}

export function getActiveRpcUrl(chain: string): string | null {
  return getRPCManager().getActiveUrl(chain);
}

export async function executeRpc<T>(
  chain: string,
  method: string,
  params: any[] = []
): Promise<T> {
  return getRPCManager().executeWithRetry<T>(chain, method, params);
}

export function getRpcStatus() {
  return getRPCManager().getStatus();
}

export default RPCManager;
