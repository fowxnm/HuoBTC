/**
 * 后台管理通知音效工具
 */

// 使用 Web Audio API 生成提示音
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * 播放通知提示音
 * @param type 提示音类型: 'deposit' | 'withdraw' | 'message'
 */
export function playNotificationSound(type: 'deposit' | 'withdraw' | 'message' = 'message') {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // 不同类型使用不同频率
    const frequencies: Record<string, number[]> = {
      deposit: [800, 1000, 1200],  // 充值：上升音调
      withdraw: [600, 800, 600],   // 提现：中等音调
      message: [880, 880],         // 消息：双响
    };
    
    const freqs = frequencies[type] || frequencies.message;
    const duration = 0.1;
    const now = ctx.currentTime;
    
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, now);
    
    // 播放音调序列
    freqs.forEach((freq, i) => {
      oscillator.frequency.setValueAtTime(freq, now + i * duration);
    });
    
    // 淡出
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + freqs.length * duration);
    
    oscillator.start(now);
    oscillator.stop(now + freqs.length * duration);
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
}

// 记录上次数据，用于检测新增
let lastDepositCount = 0;
let lastWithdrawCount = 0;
let lastMessageCount = 0;

/**
 * 检查并播放充值提示音
 */
export function checkDepositNotification(currentCount: number) {
  if (lastDepositCount > 0 && currentCount > lastDepositCount) {
    playNotificationSound('deposit');
  }
  lastDepositCount = currentCount;
}

/**
 * 检查并播放提现提示音
 */
export function checkWithdrawNotification(currentCount: number) {
  if (lastWithdrawCount > 0 && currentCount > lastWithdrawCount) {
    playNotificationSound('withdraw');
  }
  lastWithdrawCount = currentCount;
}

/**
 * 检查并播放消息提示音
 */
export function checkMessageNotification(currentCount: number) {
  if (lastMessageCount > 0 && currentCount > lastMessageCount) {
    playNotificationSound('message');
  }
  lastMessageCount = currentCount;
}

/**
 * 重置计数器（用于页面切换时）
 */
export function resetNotificationCounters() {
  lastDepositCount = 0;
  lastWithdrawCount = 0;
  lastMessageCount = 0;
}
