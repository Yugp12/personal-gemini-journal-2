import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SecurityPanel } from './SecurityPanel';
import { 
  createJournalEntry, 
  subscribeToJournalEntries, 
  updateJournalEntry, 
  deleteJournalEntry,
  saveJournalAIReflection,
  addJournalTags
} from '../lib/journalService';
import { generateJournalReflection, ReflectionError } from '../lib/geminiService';
import { AIReflectionPanel } from './AIReflectionPanel';
import { ConversationView } from './ConversationView';
import { MemoryView } from './MemoryView';
import { PrivacyVault } from './PrivacyVault';
import type { JournalEntry } from '../types';
import { 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  Brain, 
  Lock, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  Save,
  Clock,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  Eye,
  Plus,
  Tag as TagIcon,
  ArrowUpDown,
  RotateCcw,
  Smile
} from 'lucide-react';

export type JournalNavSection = 'journal' | 'conversations' | 'memory' | 'vault' | 'security';

export interface MoodOption {
  id: string;
  emoji: string;
  label: string;
  fullName: string;
}

export const AVAILABLE_MOODS: MoodOption[] = [
  { id: 'Happy', emoji: '😊', label: 'Happy', fullName: '😊 Happy' },
  { id: 'Calm', emoji: '😌', label: 'Calm', fullName: '😌 Calm' },
  { id: 'Neutral', emoji: '😐', label: 'Neutral', fullName: '😐 Neutral' },
  { id: 'Sad', emoji: '😔', label: 'Sad', fullName: '😔 Sad' },
  { id: 'Frustrated', emoji: '😤', label: 'Frustrated', fullName: '😤 Frustrated' },
  { id: 'Anxious', emoji: '😰', label: 'Anxious', fullName: '😰 Anxious' },
  { id: 'Excited', emoji: '🤩', label: 'Excited', fullName: '🤩 Excited' },
  { id: 'Grateful', emoji: '❤️', label: 'Grateful', fullName: '❤️ Grateful' },
];

export type SortOption = 'newest' | 'oldest' | 'updated';

// Helper to convert Firestore Timestamp to milliseconds
function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof ts === 'object' && 'seconds' in (ts as Record<string, unknown>)) {
    const s = (ts as { seconds: number; nanoseconds?: number }).seconds;
    const ns = (ts as { seconds: number; nanoseconds?: number }).nanoseconds || 0;
    return s * 1000 + ns / 1000000;
  }
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

// Helper to format date cleanly
function formatDate(ts: unknown): string {
  const millis = getTimestampMillis(ts);
  if (!millis) return 'Just now';
  return new Date(millis).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function JournalShell() {
  const { user, signOut, getIdToken } = useAuth();
  const [activeSection, setActiveSection] = useState<JournalNavSection>('journal');
  
  // Journal entries state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // New Journal composer state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('😊 Happy');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string | null>(null);
  const tagInputRef = React.useRef<HTMLInputElement>(null);

  // Search & Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // View modal state
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);

  // Edit entry modal/state
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMood, setEditMood] = useState('😊 Happy');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editTagInputRef = React.useRef<HTMLInputElement>(null);

  // Delete entry modal/state
  const [deletingEntry, setDeletingEntry] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AI Reflection state
  const [reflectingEntryId, setReflectingEntryId] = useState<string | null>(null);
  const [reflectionError, setReflectionError] = useState<{ entryId: string; message: string } | null>(null);
  const [addingTag, setAddingTag] = useState<string | null>(null);
  const [isAddingAllTags, setIsAddingAllTags] = useState<boolean>(false);

  // Global notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Memory prefill state from Journal entries
  const [memoryPrefill, setMemoryPrefill] = useState<{ content: string; category?: string } | null>(null);

  const handleSaveJournalAsMemory = (content: string, category: string = 'Personal Context') => {
    setMemoryPrefill({ content, category });
    setActiveSection('memory');
    setViewingEntry(null);
  };

  const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'there';
  const fullDisplayName = user?.displayName || 'Journalist';

  // Navigation tabs definition
  const navItems = [
    { id: 'journal' as JournalNavSection, label: 'Journal', icon: BookOpen },
    { id: 'conversations' as JournalNavSection, label: 'Conversations', icon: MessageSquare },
    { id: 'memory' as JournalNavSection, label: 'Memory', icon: Brain },
    { id: 'vault' as JournalNavSection, label: 'Privacy Vault', icon: Lock },
    { id: 'security' as JournalNavSection, label: 'Security', icon: ShieldCheck }
  ];

  // Subscribe to real-time entries when user is authenticated
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }

    setLoadingEntries(true);
    setFetchError(null);

    const unsubscribe = subscribeToJournalEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setLoadingEntries(false);
        setFetchError(null);
      },
      (err) => {
        console.error('Error in journal subscription:', err);
        setFetchError('Unable to load your journal entries.');
        setLoadingEntries(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Show a temporary toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Collect all unique tags across entries for filtering
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => {
      if (Array.isArray(e.tags)) {
        e.tags.forEach((t) => {
          const clean = t.trim().replace(/^#/, '');
          if (clean) tagSet.add(clean);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [entries]);

  // Filter and sort entries locally
  const filteredAndSortedEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries
      .filter((entry) => {
        // Search filter (title, content, tags)
        if (query) {
          const titleMatch = entry.title.toLowerCase().includes(query);
          const contentMatch = entry.content.toLowerCase().includes(query);
          const tagsMatch = Array.isArray(entry.tags) && entry.tags.some((t) => 
            t.toLowerCase().replace(/^#/, '').includes(query.replace(/^#/, ''))
          );
          if (!titleMatch && !contentMatch && !tagsMatch) {
            return false;
          }
        }

        // Mood filter
        if (selectedMoodFilter !== 'all') {
          const entryMood = (entry.mood || '').toLowerCase();
          const targetMood = selectedMoodFilter.toLowerCase();
          if (!entryMood.includes(targetMood)) {
            return false;
          }
        }

        // Tag filter
        if (selectedTagFilter !== 'all') {
          const targetTag = selectedTagFilter.toLowerCase().replace(/^#/, '');
          const hasTag = Array.isArray(entry.tags) && entry.tags.some(
            (t) => t.toLowerCase().replace(/^#/, '') === targetTag
          );
          if (!hasTag) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'oldest') {
          return getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt);
        }
        if (sortOption === 'updated') {
          const aUpdated = getTimestampMillis(a.updatedAt || a.createdAt);
          const bUpdated = getTimestampMillis(b.updatedAt || b.createdAt);
          return bUpdated - aUpdated;
        }
        // Default newest first
        return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      });
  }, [entries, searchQuery, selectedMoodFilter, selectedTagFilter, sortOption]);

  const isFilterActive = searchQuery.trim() !== '' || selectedMoodFilter !== 'all' || selectedTagFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedMoodFilter('all');
    setSelectedTagFilter('all');
  };

  // Handle Tag Addition in Composer
  const handleAddTag = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e) {
      if ('key' in e && e.key !== 'Enter') return;
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    const clean = tagInput.trim().replace(/^#+/, '').trim();
    if (!clean) return;

    if (clean.length > 30) {
      setComposerError('Tag length must be 30 characters or less.');
      return;
    }
    if (tags.length >= 10) {
      setComposerError('Maximum 10 tags allowed per entry.');
      return;
    }
    const alreadyExists = tags.some((t) => t.toLowerCase() === clean.toLowerCase());
    if (!alreadyExists) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
    setComposerError(null);
    setTimeout(() => {
      tagInputRef.current?.focus();
    }, 0);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Handle Tag Addition in Edit Modal
  const handleAddEditTag = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e) {
      if ('key' in e && e.key !== 'Enter') return;
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    const clean = editTagInput.trim().replace(/^#+/, '').trim();
    if (!clean) return;

    if (clean.length > 30) {
      setEditError('Tag length must be 30 characters or less.');
      return;
    }
    if (editTags.length >= 10) {
      setEditError('Maximum 10 tags allowed per entry.');
      return;
    }
    const alreadyExists = editTags.some((t) => t.toLowerCase() === clean.toLowerCase());
    if (!alreadyExists) {
      setEditTags((prev) => [...prev, clean]);
    }
    setEditTagInput('');
    setEditError(null);
    setTimeout(() => {
      editTagInputRef.current?.focus();
    }, 0);
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Handle Save New Entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    // Validation
    if (!trimmedTitle && !trimmedContent) {
      setComposerError('Please provide a title and journal content.');
      return;
    }
    if (!trimmedTitle) {
      setComposerError('Title cannot be empty.');
      return;
    }
    if (!trimmedContent) {
      setComposerError('Journal entry cannot be empty.');
      return;
    }

    setComposerError(null);
    setIsSaving(true);

    try {
      await createJournalEntry(user.uid, {
        title: trimmedTitle,
        content: trimmedContent,
        mood: selectedMood,
        tags: tags
      });
      setTitle('');
      setContent('');
      setSelectedMood('😊 Happy');
      setTags([]);
      setTagInput('');
      setComposerSuccess('Entry saved');
      triggerToast('Entry saved');
      setTimeout(() => {
        setComposerSuccess(null);
      }, 3500);
    } catch (err: unknown) {
      console.error('Failed to create journal entry:', err);
      setComposerError('Unable to save this entry.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setEditMood(entry.mood || '😊 Happy');
    setEditTags(Array.isArray(entry.tags) ? [...entry.tags] : []);
    setEditTagInput('');
    setEditError(null);
  };

  // Handle Save Edited Entry
  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingEntry) return;

    const trimmedTitle = editTitle.trim();
    const trimmedContent = editContent.trim();

    if (!trimmedTitle) {
      setEditError('Title cannot be empty.');
      return;
    }
    if (!trimmedContent) {
      setEditError('Journal content cannot be empty.');
      return;
    }

    setIsUpdating(true);
    setEditError(null);

    try {
      await updateJournalEntry(user.uid, editingEntry.id, {
        title: trimmedTitle,
        content: trimmedContent,
        mood: editMood,
        tags: editTags
      });
      
      // Update viewing entry if open
      if (viewingEntry && viewingEntry.id === editingEntry.id) {
        setViewingEntry({
          ...viewingEntry,
          title: trimmedTitle,
          content: trimmedContent,
          mood: editMood,
          tags: editTags
        });
      }

      setEditingEntry(null);
      triggerToast('Entry updated');
    } catch (err: unknown) {
      console.error('Failed to update journal entry:', err);
      setEditError('Unable to update this entry.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Confirm Delete
  const handleConfirmDelete = async () => {
    if (!user || !deletingEntry) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteJournalEntry(user.uid, deletingEntry.id);
      
      // Close viewing modal if it's the deleted entry
      if (viewingEntry && viewingEntry.id === deletingEntry.id) {
        setViewingEntry(null);
      }

      setDeletingEntry(null);
      triggerToast('Entry deleted');
    } catch (err: unknown) {
      console.error('Failed to delete journal entry:', err);
      setDeleteError('Unable to delete this entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Generate Gemini AI Reflection
  const handleGenerateReflection = async (entry: JournalEntry) => {
    if (!user) return;

    const content = (entry.content || '').trim();
    if (!content || content.length < 15) {
      triggerToast('Write a little more before asking Gemini to reflect.');
      setReflectionError({
        entryId: entry.id,
        message: 'Write a little more before asking Gemini to reflect.'
      });
      return;
    }

    setReflectingEntryId(entry.id);
    setReflectionError(null);

    try {
      const idToken = await getIdToken();
      const result = await generateJournalReflection(
        {
          title: entry.title,
          content: entry.content,
          mood: entry.mood,
          tags: entry.tags
        },
        idToken
      );

      // Persist to Firestore under users/{uid}/journalEntries/{entryId}
      await saveJournalAIReflection(user.uid, entry.id, {
        summary: result.summary,
        insights: result.insights,
        questions: result.questions,
        suggestedTags: result.suggestedTags
      });

      const updatedAIReflection = {
        summary: result.summary,
        insights: result.insights,
        questions: result.questions,
        suggestedTags: result.suggestedTags,
        generatedAt: new Date()
      };

      // Update viewing entry if open
      if (viewingEntry && viewingEntry.id === entry.id) {
        setViewingEntry({
          ...viewingEntry,
          aiReflection: updatedAIReflection
        });
      }

      triggerToast('Gemini reflection generated');
    } catch (err: unknown) {
      console.error('Reflection generation error:', err);
      const isShort = err instanceof ReflectionError && err.isUserContentShort;
      const message = err instanceof ReflectionError && err.isUserFacing
        ? err.message
        : 'Gemini reflection is temporarily unavailable. Your journal entry is safe. You can try again.';

      setReflectionError({
        entryId: entry.id,
        message
      });

      if (isShort) {
        triggerToast('Write a little more before asking Gemini to reflect.');
      } else {
        triggerToast('Reflection unavailable. Try again.');
      }
    } finally {
      setReflectingEntryId(null);
    }
  };

  // Handle adding an individual suggested tag
  const handleAddSuggestedTag = async (entry: JournalEntry, tagToAdd: string) => {
    if (!user) return;
    const cleanTag = tagToAdd.trim().replace(/^#/, '');
    if (!cleanTag) return;

    setAddingTag(cleanTag);
    try {
      const currentTags = Array.isArray(entry.tags) ? entry.tags : [];
      const updatedTags = await addJournalTags(user.uid, entry.id, currentTags, [cleanTag]);

      if (viewingEntry && viewingEntry.id === entry.id) {
        setViewingEntry({
          ...viewingEntry,
          tags: updatedTags
        });
      }

      triggerToast(`Added #${cleanTag}`);
    } catch (err: unknown) {
      console.error('Failed to add tag:', err);
      triggerToast('Unable to add tag');
    } finally {
      setAddingTag(null);
    }
  };

  // Handle adding all suggested tags at once
  const handleAddAllSuggestedTags = async (entry: JournalEntry, tagsToAdd: string[]) => {
    if (!user || tagsToAdd.length === 0) return;

    setIsAddingAllTags(true);
    try {
      const currentTags = Array.isArray(entry.tags) ? entry.tags : [];
      const updatedTags = await addJournalTags(user.uid, entry.id, currentTags, tagsToAdd);

      if (viewingEntry && viewingEntry.id === entry.id) {
        setViewingEntry({
          ...viewingEntry,
          tags: updatedTags
        });
      }

      triggerToast(`Added ${tagsToAdd.length} tags`);
    } catch (err: unknown) {
      console.error('Failed to add all tags:', err);
      triggerToast('Unable to add tags');
    } finally {
      setIsAddingAllTags(false);
    }
  };

  return (
    <div id="journal-shell-root" className="min-h-screen bg-neutral-50 flex flex-col text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Header & Navigation Bar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo / Brand */}
            <div 
              id="brand-logo-btn"
              className="flex items-center space-x-3 cursor-pointer" 
              onClick={() => setActiveSection('journal')}
            >
              <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-neutral-950 block leading-tight">
                  Personal Gemini Journal
                </span>
                <span className="text-[10px] font-mono text-emerald-600 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Zero-Trust Firestore Partition</span>
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-950 font-semibold shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User Profile & Sign Out */}
            <div className="flex items-center space-x-3">
              {user && (
                <div className="flex items-center space-x-2.5 pl-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={fullDisplayName}
                      className="w-8 h-8 rounded-full border border-neutral-300 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-semibold text-neutral-900 truncate max-w-[120px]">
                      {fullDisplayName}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-400 truncate max-w-[120px]">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}

              <button
                id="btn-signout"
                onClick={signOut}
                title="Sign Out"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Tabs Bar */}
          <div className="md:hidden flex items-center justify-between py-2 border-t border-neutral-100 overflow-x-auto space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-neutral-900 text-white px-4 py-2.5 rounded-2xl shadow-lg border border-neutral-800 text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* JOURNAL VIEW */}
        {activeSection === 'journal' && (
          <div id="journal-view-container" className="space-y-8">
            {/* Welcome Banner with Clear Workflow Steps */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 md:p-8 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-100 text-xs font-medium text-neutral-700 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Personal Journal Space</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">
                    Welcome back, {displayName}
                  </h1>
                  <p className="text-xs md:text-sm text-neutral-500 max-w-xl leading-relaxed">
                    Your private, AI-augmented sanctuary for daily reflections, habits, and secure journaling.
                  </p>
                </div>

                {/* Workflow Stepper Guide */}
                <div className="flex items-center space-x-2 bg-neutral-50 p-2 rounded-2xl border border-neutral-200/80 text-[11px] font-medium text-neutral-600 shrink-0">
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white text-neutral-900 shadow-2xs font-semibold">
                    <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Write</span>
                  </div>
                  <span className="text-neutral-300 font-mono">→</span>
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white text-neutral-900 shadow-2xs font-semibold">
                    <span className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Save</span>
                  </div>
                  <span className="text-neutral-300 font-mono">→</span>
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/70 font-semibold">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Reflect</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Journal Card with Mood & Tag Selectors */}
            <div id="card-todays-journal" className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 md:p-8 space-y-5">
              <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                    Today's Journal
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Express your current thoughts, feelings, or daily highlights.
                  </p>
                </div>
                <div className="flex items-center space-x-1 text-[11px] font-mono text-neutral-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              {/* Validation / Error Message */}
              {composerError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{composerError}</span>
                </div>
              )}

              {/* Success Notification */}
              {composerSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{composerSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveEntry} className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="journal-title-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Title
                  </label>
                  <input
                    id="journal-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (composerError) setComposerError(null);
                    }}
                    placeholder="What's on your mind?"
                    disabled={isSaving}
                    className="w-full text-sm font-medium px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </div>

                {/* Mood Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5 flex items-center space-x-1.5">
                    <Smile className="w-3.5 h-3.5 text-neutral-500" />
                    <span>How are you feeling?</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_MOODS.map((m) => {
                      const isSelected = selectedMood.includes(m.label);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMood(m.fullName)}
                          disabled={isSaving}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-900 text-white shadow-xs font-semibold'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80'
                          }`}
                        >
                          <span>{m.emoji}</span>
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags Input & Chips */}
                <div>
                  <label htmlFor="tag-input-field" className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5 flex items-center space-x-1.5">
                    <TagIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Tags (press Enter to add)</span>
                  </label>
                  
                  {/* Tag Chips */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 text-xs font-mono border border-neutral-200"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            disabled={isSaving}
                            className="text-neutral-400 hover:text-neutral-700 ml-0.5 cursor-pointer"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input field + Add button */}
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-2.5 text-neutral-400 font-mono text-xs">#</span>
                      <input
                        ref={tagInputRef}
                        id="tag-input-field"
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          if (composerError) setComposerError(null);
                        }}
                        onKeyDown={handleAddTag}
                        placeholder="college, project, reflection..."
                        disabled={isSaving || tags.length >= 10}
                        className="w-full text-xs font-mono pl-7 pr-3 py-2 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-50"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={isSaving || !tagInput.trim() || tags.length >= 10}
                      className="px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                      aria-label="Add tag"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Journal Entry Area */}
                <div>
                  <label htmlFor="journal-entry-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Journal entry
                  </label>
                  <textarea
                    id="journal-entry-input"
                    rows={6}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (composerError) setComposerError(null);
                    }}
                    placeholder="Start writing..."
                    disabled={isSaving}
                    className="w-full text-sm leading-relaxed px-4 py-3 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 text-neutral-800 placeholder:text-neutral-400 resize-y disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Firestore Path: /users/{'{uid}'}/journalEntries
                  </span>
                  <button
                    id="btn-save-entry"
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Entry</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* RECENT ENTRIES SECTION WITH SEARCH, FILTERS & SORT */}
            <div id="section-recent-entries" className="space-y-4">
              
              {/* Header & Dynamic Counter */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-neutral-700" />
                  <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                    Recent Entries
                  </h3>
                </div>

                {/* Dynamic Entry Summary & Clear Filters */}
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-mono text-neutral-500">
                    {loadingEntries ? (
                      'Loading...'
                    ) : isFilterActive ? (
                      `Showing ${filteredAndSortedEntries.length} of ${entries.length} entries`
                    ) : (
                      `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
                    )}
                  </span>
                  {isFilterActive && (
                    <button
                      id="btn-clear-filters"
                      onClick={clearAllFilters}
                      className="inline-flex items-center space-x-1 text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 font-medium cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear filters</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SEARCH, FILTERS & SORT BAR */}
              {!loadingEntries && entries.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-4 space-y-3.5">
                  {/* Row 1: Search Box & Dropdown Controls (Tag Filter + Sort Selector) */}
                  <div className="flex flex-col lg:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
                      <input
                        id="search-journal-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search your journal by title, content, or tags..."
                        className="w-full text-xs pl-9 pr-8 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-900 placeholder:text-neutral-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Secondary Controls (Tag Selector & Sort Selector) */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                      {/* Tag Filter Dropdown */}
                      {allUniqueTags.length > 0 && (
                        <div className="relative flex-1 sm:flex-none">
                          <TagIcon className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
                          <select
                            id="tag-filter-select"
                            value={selectedTagFilter}
                            onChange={(e) => setSelectedTagFilter(e.target.value)}
                            className="w-full sm:w-auto text-xs pl-8 pr-7 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-800 font-mono focus:outline-hidden focus:border-neutral-900 cursor-pointer"
                          >
                            <option value="all">All Tags ({allUniqueTags.length})</option>
                            {allUniqueTags.map((tag) => (
                              <option key={tag} value={tag}>
                                #{tag}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Sort Selector */}
                      <div className="relative flex-1 sm:flex-none">
                        <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
                        <select
                          id="sort-select"
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value as SortOption)}
                          className="w-full sm:w-auto text-xs pl-8 pr-7 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-800 font-medium focus:outline-hidden focus:border-neutral-900 cursor-pointer"
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="updated">Recently updated</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Mood Filter Chips with clean wrapping on tablet/mobile/narrow desktop */}
                  <div className="pt-2.5 border-t border-neutral-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider shrink-0 mr-1.5 flex items-center space-x-1">
                        <Smile className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Mood:</span>
                      </span>
                      
                      <button
                        id="filter-mood-all"
                        type="button"
                        onClick={() => setSelectedMoodFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          selectedMoodFilter === 'all'
                            ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                        }`}
                      >
                        All
                      </button>

                      {AVAILABLE_MOODS.map((m) => {
                        const isSelected = selectedMoodFilter === m.label;
                        return (
                          <button
                            key={m.id}
                            id={`filter-mood-${m.id.toLowerCase()}`}
                            type="button"
                            onClick={() => setSelectedMoodFilter(isSelected ? 'all' : m.label)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-neutral-900 text-white shadow-2xs font-semibold ring-1 ring-neutral-900'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
                            }`}
                          >
                            <span>{m.emoji}</span>
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Fetch Error State */}
              {fetchError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
              )}

              {/* Loading State */}
              {loadingEntries ? (
                <div 
                  id="loading-entries-state" 
                  className="p-12 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col items-center justify-center space-y-3"
                >
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-800" />
                  <p className="text-xs font-medium text-neutral-500 font-mono">
                    Loading your journal entries...
                  </p>
                </div>
              ) : entries.length === 0 ? (
                /* No Entries At All / Empty State */
                <div 
                  id="empty-state-no-entries"
                  className="p-12 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                    <BookOpen className="w-6 h-6 text-neutral-400" />
                  </div>
                  <h4 className="text-base font-bold text-neutral-900">
                    No journal entries yet.
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Write your first entry and start building your private journal.
                  </p>
                </div>
              ) : filteredAndSortedEntries.length === 0 ? (
                /* Filter / Search yielded no results Empty State */
                <div 
                  id="empty-state-no-matches"
                  className="p-12 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                    <Search className="w-6 h-6 text-neutral-400" />
                  </div>
                  <h4 className="text-base font-bold text-neutral-900">
                    No matching entries.
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Try a different search term or remove a filter.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              ) : (
                /* Filtered Entries Cards */
                <div className="space-y-4">
                  {filteredAndSortedEntries.map((entry) => {
                    const createdMillis = getTimestampMillis(entry.createdAt);
                    const updatedMillis = getTimestampMillis(entry.updatedAt);
                    const isEdited = updatedMillis > 0 && Math.abs(updatedMillis - createdMillis) > 2000;

                    return (
                      <div
                        key={entry.id}
                        id={`journal-entry-card-${entry.id}`}
                        className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs hover:shadow-xs transition-all p-5 md:p-6 space-y-3"
                      >
                        {/* Entry Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1.5 flex-1 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-neutral-900 leading-snug">
                                {entry.title}
                              </h4>
                              {entry.mood && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200">
                                  {entry.mood}
                                </span>
                              )}
                            </div>

                            {/* Timestamps */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 font-mono">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-neutral-400" />
                                <span>{formatDate(entry.createdAt)}</span>
                              </div>
                              {isEdited && (
                                <span className="text-neutral-400 italic">
                                  (Updated {formatDate(entry.updatedAt)})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: View, Edit, Delete */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              id={`btn-view-${entry.id}`}
                              onClick={() => setViewingEntry(entry)}
                              className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                              title="View Full Entry"
                              aria-label="View Entry"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-edit-${entry.id}`}
                              onClick={() => openEditModal(entry)}
                              className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Entry"
                              aria-label="Edit Entry"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-delete-${entry.id}`}
                              onClick={() => {
                                setDeletingEntry(entry);
                                setDeleteError(null);
                              }}
                              className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Entry"
                              aria-label="Delete Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Tags Chips */}
                        {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {entry.tags.map((t) => (
                              <button
                                key={t}
                                onClick={() => setSelectedTagFilter(t.replace(/^#/, ''))}
                                className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 transition-colors cursor-pointer"
                              >
                                #{t.replace(/^#/, '')}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Entry Content Preview (truncated) */}
                        <p className="text-xs md:text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed line-clamp-3">
                          {entry.content}
                        </p>

                        {/* Card Footer: Reflect with Gemini / View Reflection / Save as Memory */}
                        <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.aiReflection ? (
                              <button
                                id={`btn-reflect-${entry.id}`}
                                type="button"
                                onClick={() => setViewingEntry(entry)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-300" />
                                <span>View Gemini Reflection</span>
                              </button>
                            ) : (
                              <button
                                id={`btn-reflect-${entry.id}`}
                                type="button"
                                onClick={() => handleGenerateReflection(entry)}
                                disabled={reflectingEntryId === entry.id}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-amber-50 hover:border-amber-200 border border-neutral-200 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {reflectingEntryId === entry.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                    <span>Gemini is reflecting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Reflect with Gemini</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              id={`btn-card-save-memory-${entry.id}`}
                              type="button"
                              onClick={() => handleSaveJournalAsMemory(entry.content, 'Personal Context')}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Save this entry as a memory for Gemini"
                            >
                              <Brain className="w-3.5 h-3.5 text-purple-600" />
                              <span>Save as Memory</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setViewingEntry(entry)}
                            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-2 cursor-pointer"
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONVERSATIONS VIEW */}
        {activeSection === 'conversations' && (
          <div id="conversations-section-view">
            <ConversationView />
          </div>
        )}

        {/* MEMORY VIEW */}
        {activeSection === 'memory' && (
          <div id="memory-section-view">
            <MemoryView 
              initialPrefill={memoryPrefill} 
              onClearPrefill={() => setMemoryPrefill(null)} 
            />
          </div>
        )}

        {/* PRIVACY VAULT VIEW */}
        {activeSection === 'vault' && (
          <div id="vault-section-view">
            <PrivacyVault />
          </div>
        )}

        {/* SECURITY VIEW */}
        {activeSection === 'security' && (
          <div id="security-view-container">
            <SecurityPanel />
          </div>
        )}
      </main>

      {/* FULL ENTRY VIEW MODAL */}
      {viewingEntry && (
        <div 
          id="modal-view-entry" 
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-2xl w-full p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
              <div className="space-y-1.5 flex-1 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
                    {viewingEntry.title}
                  </h3>
                  {viewingEntry.mood && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium border border-neutral-200">
                      {viewingEntry.mood}
                    </span>
                  )}
                </div>

                {/* Timestamps */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 font-mono">
                  <span>Created: {formatDate(viewingEntry.createdAt)}</span>
                  {getTimestampMillis(viewingEntry.updatedAt) > 0 &&
                    Math.abs(getTimestampMillis(viewingEntry.updatedAt) - getTimestampMillis(viewingEntry.createdAt)) > 2000 && (
                      <span className="italic">
                        • Updated: {formatDate(viewingEntry.updatedAt)}
                      </span>
                    )}
                </div>
              </div>

              <button
                onClick={() => setViewingEntry(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                aria-label="Close View Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tags */}
            {Array.isArray(viewingEntry.tags) && viewingEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center text-xs font-mono px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200"
                  >
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}

            {/* Full Content */}
            <div className="py-2">
              <div className="text-sm md:text-base leading-relaxed text-neutral-800 whitespace-pre-wrap font-normal">
                {viewingEntry.content}
              </div>
            </div>

            {/* Gemini AI Reflection in Modal */}
            {viewingEntry.aiReflection || reflectingEntryId === viewingEntry.id || reflectionError?.entryId === viewingEntry.id ? (
              <div className="pt-2">
                <AIReflectionPanel
                  entry={viewingEntry}
                  reflection={viewingEntry.aiReflection || null}
                  isLoading={reflectingEntryId === viewingEntry.id}
                  error={reflectionError?.entryId === viewingEntry.id ? reflectionError.message : null}
                  onRegenerate={() => handleGenerateReflection(viewingEntry)}
                  onClose={() => {
                    if (reflectionError?.entryId === viewingEntry.id) {
                      setReflectionError(null);
                    }
                  }}
                  onAddTag={(tag) => handleAddSuggestedTag(viewingEntry, tag)}
                  onAddAllTags={(tags) => handleAddAllSuggestedTags(viewingEntry, tags)}
                  addingTag={addingTag}
                  isAddingAllTags={isAddingAllTags}
                />
              </div>
            ) : (
              <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                <button
                  id="btn-modal-reflect-gemini"
                  type="button"
                  onClick={() => handleGenerateReflection(viewingEntry)}
                  disabled={reflectingEntryId === viewingEntry.id}
                  className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-neutral-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-60"
                >
                  {reflectingEntryId === viewingEntry.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                      <span>Gemini is reflecting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-600 fill-amber-300" />
                      <span>Reflect with Gemini</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Private AI reflection
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const entryToEdit = viewingEntry;
                    setViewingEntry(null);
                    openEditModal(entryToEdit);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    const entryToDelete = viewingEntry;
                    setViewingEntry(null);
                    setDeletingEntry(entryToDelete);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  id="btn-modal-save-memory"
                  onClick={() => handleSaveJournalAsMemory(viewingEntry.content, 'Personal Context')}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-xl transition-colors cursor-pointer"
                  title="Save this journal entry into your long-term Memory"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-600" />
                  <span>Save as Memory</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ENTRY MODAL WITH MOOD & TAG EDITING */}
      {editingEntry && (
        <div 
          id="modal-edit-entry" 
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                Edit Journal Entry
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateEntry} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  disabled={isUpdating}
                  className="w-full text-sm font-medium px-4 py-2 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 text-neutral-900"
                />
              </div>

              {/* Mood Selector in Edit Modal */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Mood
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_MOODS.map((m) => {
                    const isSelected = editMood.includes(m.label);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setEditMood(m.fullName)}
                        disabled={isUpdating}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-900 text-white font-semibold'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tag Editor in Edit Modal */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Tags (press Enter to add)
                </label>
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 text-xs font-mono border border-neutral-200"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEditTag(tag)}
                          disabled={isUpdating}
                          className="text-neutral-400 hover:text-neutral-700 ml-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-neutral-400 font-mono text-xs">#</span>
                    <input
                      ref={editTagInputRef}
                      type="text"
                      value={editTagInput}
                      onChange={(e) => {
                        setEditTagInput(e.target.value);
                        if (editError) setEditError(null);
                      }}
                      onKeyDown={handleAddEditTag}
                      placeholder="college, project, reflection..."
                      disabled={isUpdating || editTags.length >= 10}
                      className="w-full text-xs font-mono pl-6 pr-3 py-1.5 rounded-xl border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEditTag}
                    disabled={isUpdating || !editTagInput.trim() || editTags.length >= 10}
                    className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer disabled:opacity-50"
                    aria-label="Add tag"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Content
                </label>
                <textarea
                  rows={6}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Journal content..."
                  disabled={isUpdating}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 text-neutral-800 resize-y"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUpdating ? 'Saving changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingEntry && (
        <div 
          id="modal-delete-confirmation" 
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900">
                Delete this journal entry?
              </h3>
              <p className="text-xs text-neutral-500">
                This action cannot be undone. The entry will be permanently removed from your private Firestore partition.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all cursor-pointer disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Entry'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 py-6 text-center text-xs text-neutral-400 font-mono">
        Personal Gemini Journal • Zero-Trust Firebase Identity • Partition: /users/{user?.uid}
      </footer>
    </div>
  );
}
