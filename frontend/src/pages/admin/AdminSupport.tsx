/**
 * 在线客服管理 - 查看用户消息并回复
 */
import { Component, createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { api } from '../../utils/api';
import { checkMessageNotification, resetNotificationCounters } from '../../utils/notification';

interface Conversation {
  user_id: number;
  uid: string;
  last_message_at: string;
  unread_count: number;
  last_message: string;
}

interface Message {
  id: number;
  sender_type: 'user' | 'admin';
  content: string;
  image_url?: string;
  created_at: string;
}

const AdminSupport: Component = () => {
  const [conversations, setConversations] = createSignal<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = createSignal<number | null>(null);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [totalUnread, setTotalUnread] = createSignal(0);
  let messagesEndRef: HTMLDivElement | undefined;
  let pollInterval: number | undefined;

  const fetchConversations = async () => {
    try {
      const res = await api.get('/api/support/admin/conversations');
      if (res.type === 'ok' && res.data) {
        setConversations(res.data as Conversation[]);
      }
    } catch (e) {
      console.error('Failed to fetch conversations');
    }
  };

  const fetchUnreadTotal = async () => {
    try {
      const res = await api.get('/api/support/admin/unread-total');
      if (res.type === 'ok' && res.data) {
        setTotalUnread(res.data.count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch unread total');
    }
  };

  const fetchMessages = async (userId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/support/admin/messages/${userId}`);
      if (res.type === 'ok' && res.data) {
        setMessages(res.data);
        // 刷新会话列表以更新未读数
        await fetchConversations();
        await fetchUnreadTotal();
      }
    } catch (e) {
      console.error('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    resetNotificationCounters();
    fetchConversations();
    fetchUnreadTotalWithNotification();
    pollInterval = setInterval(() => {
      fetchConversations();
      fetchUnreadTotalWithNotification();
      if (selectedUserId()) {
        fetchMessages(selectedUserId()!);
      }
    }, 5000) as unknown as number;
  });

  // 带通知的未读消息检查
  const fetchUnreadTotalWithNotification = async () => {
    try {
      const res = await api.get('/api/support/admin/unread-total');
      if (res.type === 'ok' && res.data) {
        const count = res.data.count || 0;
        checkMessageNotification(count);
        setTotalUnread(count);
      }
    } catch (e) {
      console.error('Failed to fetch unread total');
    }
  };

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  createEffect(() => {
    const userId = selectedUserId();
    if (userId) {
      fetchMessages(userId);
    }
  });

  createEffect(() => {
    if (messagesEndRef && messages().length > 0) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const sendReply = async () => {
    const userId = selectedUserId();
    const content = input().trim();
    if (!userId || !content || sending()) return;

    setSending(true);
    try {
      const res = await api.post('/api/support/admin/reply', { user_id: userId, content });
      if (res.type === 'ok') {
        setInput('');
        await fetchMessages(userId);
      }
    } catch (e) {
      console.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedConv = () => conversations().find(c => c.user_id === selectedUserId());

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">在线客服</h1>
        <Show when={totalUnread() > 0}>
          <span class="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full">
            {totalUnread()} 条未读
          </span>
        </Show>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden" style="height: calc(100vh - 180px)">
        <div class="flex h-full">
          {/* 会话列表 */}
          <div class="w-80 border-r border-slate-200 flex flex-col">
            <div class="p-3 border-b border-slate-200 bg-slate-50">
              <h3 class="font-semibold text-slate-700">用户会话</h3>
            </div>
            <div class="flex-1 overflow-y-auto">
              <Show when={conversations().length === 0}>
                <div class="p-8 text-center text-slate-500 text-sm">
                  暂无用户消息
                </div>
              </Show>
              <For each={conversations()}>
                {(conv) => (
                  <div
                    class={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                      selectedUserId() === conv.user_id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => setSelectedUserId(conv.user_id)}
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-medium text-slate-800">UID: {conv.uid || conv.user_id}</span>
                      <Show when={conv.unread_count > 0}>
                        <span class="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      </Show>
                    </div>
                    <p class="text-sm text-slate-500 truncate">{conv.last_message || '...'}</p>
                    <p class="text-xs text-slate-400 mt-1">{formatTime(conv.last_message_at)}</p>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* 聊天区域 */}
          <div class="flex-1 flex flex-col">
            <Show when={selectedUserId()} fallback={
              <div class="flex-1 flex items-center justify-center text-slate-400">
                <div class="text-center">
                  <svg class="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>选择一个会话开始聊天</p>
                </div>
              </div>
            }>
              {/* 头部 */}
              <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <span class="font-semibold text-slate-800">用户 UID: {selectedConv()?.uid || selectedUserId()}</span>
                  <span class="text-sm text-slate-500 ml-2">(ID: {selectedUserId()})</span>
                </div>
              </div>

              {/* 消息区域 */}
              <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                <Show when={loading()}>
                  <div class="text-center text-slate-500">加载中...</div>
                </Show>
                <For each={messages()}>
                  {(msg) => (
                    <div class={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div class={`max-w-[70%] rounded-lg px-3 py-2 ${
                        msg.sender_type === 'admin' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}>
                        <Show when={msg.image_url}>
                          <img 
                            src={msg.image_url} 
                            alt="图片" 
                            class="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                            style="max-height: 300px"
                            onClick={() => window.open(msg.image_url, '_blank')}
                          />
                        </Show>
                        <Show when={msg.content}>
                          <p class="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        </Show>
                        <p class={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-blue-200' : 'text-slate-400'}`}>
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
                <div class="flex gap-2">
                  <input
                    type="text"
                    class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入回复内容..."
                    value={input()}
                    onInput={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sending()}
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending() || !input().trim()}
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    发送
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSupport;
