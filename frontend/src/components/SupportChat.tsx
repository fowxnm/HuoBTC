/**
 * 用户端在线客服聊天组件
 */
import { Component, createSignal, createEffect, For, Show, onCleanup } from 'solid-js';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface Message {
  id: number;
  sender_type: 'user' | 'admin';
  content: string;
  image_url?: string;
  created_at: string;
}

const SupportChat: Component = () => {
  const { isLoggedIn } = useAuth();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = createSignal(false);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal('');
  const [sending, setSending] = createSignal(false);
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [uploading, setUploading] = createSignal(false);
  let messagesEndRef: HTMLDivElement | undefined;
  let pollInterval: number | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const fetchMessages = async () => {
    if (!isLoggedIn()) return;
    try {
      const res = await api.get('/api/support/messages');
      if (res.type === 'ok' && res.data) {
        setMessages(res.data);
        if (isOpen()) setUnreadCount(0);
      }
    } catch (e) {
      console.error('Failed to fetch messages');
    }
  };

  const checkUnread = async () => {
    if (!isLoggedIn() || isOpen()) return;
    try {
      const res = await api.get('/api/support/unread');
      if (res.type === 'ok' && res.data) {
        setUnreadCount(res.data.count || 0);
      }
    } catch (e) {
      console.error('Failed to check unread');
    }
  };

  createEffect(() => {
    if (!isLoggedIn()) return;
    
    checkUnread();
    pollInterval = setInterval(() => {
      if (isOpen()) {
        fetchMessages();
      } else {
        checkUnread();
      }
    }, 5000) as unknown as number;

    onCleanup(() => {
      if (pollInterval) clearInterval(pollInterval);
    });
  });

  createEffect(() => {
    if (isOpen()) {
      fetchMessages();
      setUnreadCount(0);
    }
  });

  createEffect(() => {
    if (messagesEndRef && messages().length > 0) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const sendMessage = async (imageUrl?: string) => {
    const content = input().trim();
    if (!content && !imageUrl) return;
    if (sending()) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      console.log('[SupportChat] Sending message:', { content, imageUrl, hasToken: !!token, token: token?.slice(0, 20) + '...' });
      const res = await api.post('/api/support/send', { 
        content: content || undefined, 
        image_url: imageUrl || undefined 
      });
      console.log('[SupportChat] Response:', res);
      if (res.type === 'ok') {
        setInput('');
        await fetchMessages();
      } else {
        console.error('[SupportChat] Send failed:', res.message);
      }
    } catch (e) {
      console.error('[SupportChat] Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert(t('support.selectImage'));
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('support.imageTooLarge'));
      return;
    }

    setUploading(true);
    try {
      // 转换为 base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await sendMessage(base64);
        setUploading(false);
      };
      reader.onerror = () => {
        alert(t('support.readFileFailed'));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Failed to upload image');
      setUploading(false);
    }

    // 清空文件输入
    target.value = '';
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Show when={isLoggedIn()}>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="fixed bottom-24 md:bottom-6 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title={t('support.title')}
      >
        <Show when={!isOpen()}>
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <Show when={unreadCount() > 0}>
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount()}
            </span>
          </Show>
        </Show>
        <Show when={isOpen()}>
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Show>
      </button>

      {/* 聊天窗口 */}
      <Show when={isOpen()}>
        <div class="fixed bottom-24 md:bottom-24 right-4 z-50 w-80 md:w-96 h-[450px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          {/* 头部 */}
          <div class="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span class="font-semibold">{t('support.title')}</span>
            </div>
            <button onClick={() => setIsOpen(false)} class="p-1 hover:bg-white/20 rounded">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 消息区域 */}
          <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            <Show when={messages().length === 0}>
              <div class="text-center text-slate-500 text-sm py-8">
                <p>{t('support.greeting')}</p>
                <p class="text-xs mt-2">{t('support.hint')}</p>
              </div>
            </Show>
            <For each={messages()}>
              {(msg) => (
                <div class={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div class={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.sender_type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-slate-800 border border-slate-200'
                  }`}>
                    <Show when={msg.image_url}>
                      <img 
                        src={msg.image_url} 
                        alt="图片" 
                        class="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                        style="max-height: 200px"
                        onClick={() => window.open(msg.image_url, '_blank')}
                      />
                    </Show>
                    <Show when={msg.content}>
                      <p class="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </Show>
                    <p class={`text-xs mt-1 ${msg.sender_type === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )}
            </For>
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div class="p-3 border-t border-slate-200 bg-white">
            <div class="flex gap-2 items-center">
              {/* 图片上传按钮 */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                class="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef?.click()}
                disabled={uploading() || sending()}
                class="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                title={t('support.sendImage')}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                type="text"
                class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={uploading() ? t('support.uploading') : t('support.placeholder')}
                value={input()}
                onInput={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sending() || uploading()}
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending() || uploading() || !input().trim()}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('support.send')}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
};

export default SupportChat;
