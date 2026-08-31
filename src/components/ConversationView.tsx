import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  subscribeToConversations, 
  createConversation, 
  subscribeToMessages, 
  addMessage, 
  deleteConversation,
  updateConversationTitle,
  generateTitleFromMessage
} from '../lib/conversationService';
import { 
  subscribeToMemories, 
  createMemory, 
  isDuplicateMemory 
} from '../lib/memoryService';
import { 
  getFirewallPolicy, 
  recordPrivacyReceipt 
} from '../lib/firewallService';
import type { Conversation, Message, Memory, MemoryCategory, PrivacyXRayReceipt } from '../types';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Trash2, 
  Sparkles, 
  Loader2, 
  User as UserIcon,
  Bot,
  AlertCircle,
  Clock,
  Edit2,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Brain,
  Bookmark,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Lock
} from 'lucide-react';
import { PrivacyXRayModal } from './PrivacyXRayModal';
import { ContextFirewallModal } from './ContextFirewallModal';

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'Preference',
  'Goal',
  'Project',
  'Personal Context',
  'Habit',
  'Other'
];

export function ConversationView() {
  const { user, getIdToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  
  // Context Firewall & Privacy X-Ray modal states
  const [showFirewallModal, setShowFirewallModal] = useState(false);
  const [activeReceiptForModal, setActiveReceiptForModal] = useState<PrivacyXRayReceipt | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<PrivacyXRayReceipt | null>(null);

  // Mobile responsive sidebar toggle
  const [showMobileList, setShowMobileList] = useState(false);

  // Deletion modal state
  const [deletingConv, setDeletingConv] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename title state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Save to Memory modal state
  const [saveMemoryTarget, setSaveMemoryTarget] = useState<string | null>(null);
  const [saveMemoryContent, setSaveMemoryContent] = useState('');
  const [saveMemoryCategory, setSaveMemoryCategory] = useState<MemoryCategory>('Preference');
  const [saveMemoryError, setSaveMemoryError] = useState<string | null>(null);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [saveMemorySuccessToast, setSaveMemorySuccessToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeConvId]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isSending]);

  // Subscribe to Conversations list from Firestore
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveConvId(null);
      return;
    }

    const unsub = subscribeToConversations(
      user.uid,
      (list) => {
        setConversations(list);
        setActiveConvId((currentActive) => {
          if (currentActive === 'new') return 'new';
          if (currentActive && list.some((c) => c.id === currentActive)) {
            return currentActive;
          }
          return list.length > 0 ? list[0].id : 'new';
        });
      },
      (err) => {
        console.error('Failed to load conversations from Firestore:', err);
        setError('Failed to sync conversations with Firestore.');
      }
    );

    return () => unsub();
  }, [user]);

  // Subscribe to User's Memories for Gemini long-term context
  useEffect(() => {
    if (!user) {
      setMemories([]);
      return;
    }

    const unsub = subscribeToMemories(
      user.uid,
      (mems) => {
        setMemories(mems);
      },
      (err) => {
        console.warn('Memory sync warning for conversation context:', err);
      }
    );

    return () => unsub();
  }, [user]);

  // Subscribe to active Conversation's messages
  useEffect(() => {
    if (!user || !activeConvId || activeConvId === 'new') {
      setMessages([]);
      return;
    }

    const unsub = subscribeToMessages(
      user.uid,
      activeConvId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => {
        console.error('Failed to load messages from Firestore:', err);
        setError('Unable to load message history.');
      }
    );

    return () => unsub();
  }, [user, activeConvId]);

  // Handler: Start New Conversation Draft
  const handleStartNew = () => {
    setActiveConvId('new');
    setMessages([]);
    setInputText('');
    setError(null);
    setShowMobileList(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Handler: Select existing conversation
  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setError(null);
    setShowMobileList(false);
  };

  // Handler: Open Save to Memory Dialog
  const handleOpenSaveMemory = (content: string) => {
    setSaveMemoryContent(content);
    setSaveMemoryCategory('Preference');
    setSaveMemoryError(null);
    setSaveMemoryTarget(content);
  };

  // Handler: Confirm Save to Memory
  const handleConfirmSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSavingMemory) return;

    const trimmed = saveMemoryContent.trim();
    if (!trimmed) {
      setSaveMemoryError('Memory text cannot be empty.');
      return;
    }

    if (isDuplicateMemory(memories, trimmed)) {
      setSaveMemoryError('This memory already exists in your vault.');
      return;
    }

    setIsSavingMemory(true);
    setSaveMemoryError(null);

    try {
      await createMemory(user.uid, trimmed, saveMemoryCategory);
      setSaveMemoryTarget(null);
      setSaveMemorySuccessToast('Saved to your private Memory!');
      setTimeout(() => {
        setSaveMemorySuccessToast(null);
      }, 3500);
    } catch (err: any) {
      console.error('Error saving memory from conversation:', err);
      setSaveMemoryError(err?.message || 'Failed to save memory.');
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Handler: Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || isSending) return;

    const trimmed = inputText.trim();
    if (!trimmed) return;

    setError(null);
    setLastFailedMessage(null);
    setInputText('');
    setIsSending(true);

    let targetConvId = activeConvId;

    try {
      // 1. If currently in 'new' draft mode, create the conversation first
      if (!targetConvId || targetConvId === 'new') {
        const initialTitle = generateTitleFromMessage(trimmed);
        targetConvId = await createConversation(user.uid, initialTitle);
        setActiveConvId(targetConvId);
      }

      // 2. Save User message to Firestore
      await addMessage(user.uid, targetConvId, 'user', trimmed);

      // 3. Build multi-turn context
      const contextHistory = messages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      // 4. Request Gemini response with user long-term memories context & Context Firewall policy
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const activeFirewall = getFirewallPolicy();

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: contextHistory,
          currentMessage: trimmed,
          memories: memories.map((m) => ({ content: m.content, category: m.category })),
          firewallPolicy: activeFirewall
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      const reply = data.reply?.trim() || 'I am listening. Please continue sharing your thoughts.';

      if (data.privacyReceipt) {
        recordPrivacyReceipt(data.privacyReceipt);
        setLatestReceipt(data.privacyReceipt);
      }

      // 5. Save Gemini response to Firestore
      await addMessage(user.uid, targetConvId, 'model', reply);

    } catch (err: any) {
      console.error('Conversation error:', err);
      setError(err?.message || 'Failed to get a response from Gemini. Please try again.');
      setLastFailedMessage(trimmed);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Handle Retry
  const handleRetry = () => {
    if (lastFailedMessage) {
      setInputText(lastFailedMessage);
      setLastFailedMessage(null);
      setError(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Handler: Keydown on textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handler: Delete Conversation
  const handleConfirmDelete = async () => {
    if (!user || !deletingConv || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteConversation(user.uid, deletingConv.id);
      if (activeConvId === deletingConv.id) {
        const remaining = conversations.filter((c) => c.id !== deletingConv.id);
        setActiveConvId(remaining.length > 0 ? remaining[0].id : 'new');
      }
      setDeletingConv(null);
    } catch (err: any) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Rename Title Save
  const handleSaveTitle = async (convId: string) => {
    if (!user || !editTitleText.trim()) {
      setEditingTitleId(null);
      return;
    }
    try {
      await updateConversationTitle(user.uid, convId, editTitleText.trim());
      setEditingTitleId(null);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const isDraftMode = activeConvId === 'new';

  return (
    <div id="conversations-workspace" className="max-w-6xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {saveMemorySuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-neutral-900 text-white border border-neutral-800 shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom-5 text-xs font-semibold">
          <Brain className="w-4 h-4 text-purple-300" />
          <span>{saveMemorySuccessToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-2xs">
              <MessageSquare className="w-4 h-4 text-purple-200" />
            </div>
            <h1 className="text-xl font-bold text-neutral-950 tracking-tight">
              Conversations
            </h1>
          </div>
          <p className="text-xs text-neutral-500">
            Private multi-turn conversations with Gemini.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowMobileList(!showMobileList)}
            className="md:hidden inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Threads ({conversations.length})</span>
          </button>

          <button
            id="btn-new-conversation"
            onClick={handleStartNew}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Chat Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[580px] h-[calc(100vh-280px)]">
        
        {/* Left Column: Conversations List */}
        <div 
          className={`md:col-span-4 lg:col-span-3 bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-4 flex flex-col h-full ${
            showMobileList ? 'block fixed inset-4 z-40 md:relative md:inset-auto' : 'hidden md:flex'
          }`}
        >
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Conversations ({conversations.length})
            </span>
            {showMobileList && (
              <button
                onClick={() => setShowMobileList(false)}
                className="md:hidden p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {/* Active Draft Placeholder */}
            {isDraftMode && (
              <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 text-xs text-purple-950 font-medium flex items-center space-x-2 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">New Conversation (Draft)</span>
              </div>
            )}

            {conversations.length === 0 && !isDraftMode ? (
              <div className="text-center py-16 px-3 space-y-3 text-neutral-400">
                <div className="w-10 h-10 mx-auto rounded-full bg-neutral-50 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-neutral-300" />
                </div>
                <p className="text-xs leading-relaxed">
                  No conversations yet.
                </p>
                <button
                  onClick={handleStartNew}
                  className="px-3 py-1.5 text-[11px] font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  Start First Chat
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConvId === conv.id;
                const isEditingThis = editingTitleId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                    className={`group relative flex flex-col p-3 rounded-2xl text-xs transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-neutral-950 text-white border-neutral-900 shadow-2xs'
                        : 'bg-white hover:bg-neutral-50 text-neutral-800 border-transparent hover:border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-2">
                      {isEditingThis ? (
                        <div 
                          className="flex items-center space-x-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(conv.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            className="w-full text-xs px-2 py-1 rounded bg-white text-neutral-900 border border-neutral-300 focus:outline-hidden"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTitle(conv.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingTitleId(null)}
                            className="p-1 text-neutral-400 hover:text-neutral-600"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <span className="font-semibold truncate">
                              {conv.title}
                            </span>
                          </div>

                          <div 
                            className={`flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                              isActive ? 'opacity-100 text-neutral-400' : 'text-neutral-400'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setEditingTitleId(conv.id);
                                setEditTitleText(conv.title);
                              }}
                              className={`p-1 rounded hover:text-neutral-200 transition-colors ${
                                isActive ? 'hover:bg-neutral-800' : 'hover:bg-neutral-200 hover:text-neutral-800'
                              }`}
                              title="Rename Thread"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeletingConv(conv)}
                              className={`p-1 rounded hover:text-red-400 transition-colors ${
                                isActive ? 'hover:bg-neutral-800' : 'hover:bg-neutral-200 hover:text-red-600'
                              }`}
                              title="Delete Thread"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Subtitle / Timestamp */}
                    <div className="flex items-center justify-between text-[10px] mt-1 opacity-70 font-mono">
                      <span className="truncate">
                        {conv.lastMessage || 'Active thread'}
                      </span>
                      <span className="shrink-0 ml-2">
                        {conv.updatedAt?.toDate
                          ? conv.updatedAt.toDate().toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Just now'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat View & Message Stream */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col h-full overflow-hidden">
          
          {/* Active Conversation Top Bar */}
          <div className="p-4 md:px-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-purple-200 flex items-center justify-center shadow-2xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-950 truncate">
                  {isDraftMode ? 'New Conversation' : activeConv?.title || 'Conversation'}
                </h2>
                <div className="flex items-center space-x-2 text-[10px] text-neutral-400 font-mono">
                  <span>Multi-Turn Gemini Dialogue</span>
                  {memories.length > 0 && (
                    <span className="text-purple-600 font-sans">• {memories.length} memories connected</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {latestReceipt && (
                <button
                  id="btn-chat-privacy-xray"
                  type="button"
                  onClick={() => setActiveReceiptForModal(latestReceipt)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="View Context Firewall Privacy X-Ray"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Privacy X-Ray</span>
                </button>
              )}

              <button
                id="btn-chat-context-firewall"
                type="button"
                onClick={() => setShowFirewallModal(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Configure Gemini Context Firewall"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-600" />
                <span className="hidden sm:inline">Firewall</span>
              </button>

              {activeConv && !isDraftMode && (
                <button
                  onClick={() => setDeletingConv(activeConv)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  title="Delete Conversation"
                  aria-label="Delete Conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
            
            {/* Empty State / Welcome */}
            {(messages.length === 0 && !isSending) && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3 py-12">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {isDraftMode ? 'Start a New Reflection' : 'Begin Your Dialogue'}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Ask questions, unpack recent experiences, explore project strategies, or reflect on your mindset. Gemini maintains full conversation context and recalls your saved personal memories.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2 text-left">
                  <button
                    onClick={() => {
                      setInputText('What projects or goals am I currently working on?');
                      textareaRef.current?.focus();
                    }}
                    className="p-2.5 rounded-xl border border-neutral-200 hover:border-neutral-400 bg-neutral-50/70 hover:bg-white text-[11px] text-neutral-700 transition-all cursor-pointer"
                  >
                    "What projects am I currently working on?"
                  </button>
                  <button
                    onClick={() => {
                      setInputText('Help me brainstorm next steps for my project with a clear roadmap.');
                      textareaRef.current?.focus();
                    }}
                    className="p-2.5 rounded-xl border border-neutral-200 hover:border-neutral-400 bg-neutral-50/70 hover:bg-white text-[11px] text-neutral-700 transition-all cursor-pointer"
                  >
                    "Help me brainstorm next steps for my project..."
                  </button>
                </div>
              </div>
            )}

            {/* Message Items */}
            {messages.map((m) => {
              const isUser = m.role === 'user';

              return (
                <div
                  key={m.id}
                  className={`group flex items-start space-x-2.5 ${
                    isUser ? 'justify-end' : 'justify-start'
                  } animate-in fade-in duration-150`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-3.5 h-3.5 text-purple-300" />
                    </div>
                  )}

                  <div
                    className={`relative max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-neutral-950 text-white rounded-tr-xs shadow-2xs'
                        : 'bg-neutral-50/90 text-neutral-900 border border-neutral-200/90 rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    <div className="font-normal">{m.content}</div>

                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-200/20 text-[9px] font-mono">
                      {/* Save to Memory action button */}
                      <button
                        onClick={() => handleOpenSaveMemory(m.content)}
                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                          isUser
                            ? 'text-neutral-400 hover:text-purple-200 hover:bg-neutral-800'
                            : 'text-neutral-500 hover:text-purple-700 hover:bg-purple-50'
                        }`}
                        title="Save this statement to your private Memory context"
                      >
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span className="font-sans font-semibold">Save to Memory</span>
                      </button>

                      <span className={isUser ? 'text-neutral-400' : 'text-neutral-400'}>
                        {m.createdAt?.toDate
                          ? m.createdAt.toDate().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Just now'}
                      </span>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 mt-0.5 border border-neutral-200 shadow-2xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing / Loading indicator */}
            {isSending && (
              <div className="flex items-start space-x-2.5 animate-in fade-in">
                <div className="w-7 h-7 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <div className="p-3.5 rounded-2xl bg-neutral-50 text-neutral-700 border border-neutral-200/90 rounded-tl-xs flex items-center space-x-2 shadow-2xs">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-xs font-mono text-neutral-600">Gemini is reflecting...</span>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50/90 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-3 shadow-2xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {lastFailedMessage && (
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-semibold text-[11px] transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Composer Bottom Bar */}
          <div className="p-3.5 md:p-4 border-t border-neutral-100 bg-white">
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative flex items-end rounded-2xl border border-neutral-300 focus-within:border-neutral-900 bg-white shadow-2xs transition-colors">
                <textarea
                  ref={textareaRef}
                  id="chat-input-textarea"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message or reflection... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={isSending}
                  className="w-full resize-none px-4 py-3 text-xs md:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden bg-transparent max-h-32"
                />

                <div className="p-2 shrink-0">
                  <button
                    id="btn-chat-send"
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Send message (Enter)"
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                    ) : (
                      <Send className="w-4 h-4 text-purple-200" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono px-1">
                <span>Press Enter to send • Shift+Enter for newline</span>
                <span>{inputText.length} characters</span>
              </div>
            </form>
          </div>

        </div>

      </div>

      {/* SAVE TO MEMORY MODAL */}
      {saveMemoryTarget !== null && (
        <div 
          id="modal-save-to-memory"
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-2xs">
                  <Brain className="w-4 h-4 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-950">
                    Save to Memory
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Add this statement to your private long-term context.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSaveMemoryTarget(null)}
                disabled={isSavingMemory}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveMemory} className="space-y-4">
              {saveMemoryError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{saveMemoryError}</span>
                </div>
              )}

              {/* Memory Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">
                  Memory Text
                </label>
                <textarea
                  rows={3}
                  value={saveMemoryContent}
                  onChange={(e) => setSaveMemoryContent(e.target.value)}
                  className="w-full text-xs md:text-sm p-3.5 rounded-2xl border border-neutral-300 focus:border-neutral-900 focus:outline-hidden bg-white leading-relaxed resize-none"
                  required
                />
              </div>

              {/* Category Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MEMORY_CATEGORIES.map((cat) => {
                    const isSelected = saveMemoryCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setSaveMemoryCategory(cat)}
                        className={`p-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-950 text-white border-neutral-950 shadow-2xs'
                            : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSaveMemoryTarget(null)}
                  disabled={isSavingMemory}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMemory || !saveMemoryContent.trim()}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingMemory ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save to Memory</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONVERSATION CONFIRMATION MODAL */}
      {deletingConv && (
        <div 
          id="modal-delete-conversation"
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-950">
                  Delete Conversation?
                </h3>
                <p className="text-xs text-neutral-500">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
              <span className="font-semibold block truncate">
                Thread: {deletingConv.title}
              </span>
              <span className="text-[11px] text-neutral-500 block">
                All messages within this conversation will be permanently removed from your private Firestore partition.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingConv(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY X-RAY MODAL */}
      {activeReceiptForModal && (
        <PrivacyXRayModal
          receipt={activeReceiptForModal}
          onClose={() => setActiveReceiptForModal(null)}
        />
      )}

      {/* CONTEXT FIREWALL POLICY MODAL */}
      {showFirewallModal && (
        <ContextFirewallModal
          onClose={() => setShowFirewallModal(false)}
        />
      )}
    </div>
  );
}
