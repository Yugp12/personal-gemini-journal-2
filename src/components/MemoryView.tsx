import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  subscribeToMemories, 
  createMemory, 
  updateMemory, 
  deleteMemory,
  isDuplicateMemory
} from '../lib/memoryService';
import type { Memory, MemoryCategory } from '../types';
import { 
  Brain, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  X,
  Target,
  Briefcase,
  User,
  Activity,
  HelpCircle,
  Clock,
  Filter
} from 'lucide-react';

const CATEGORIES: MemoryCategory[] = [
  'Preference',
  'Goal',
  'Project',
  'Personal Context',
  'Habit',
  'Other'
];

interface MemoryViewProps {
  initialPrefill?: {
    content: string;
    category?: MemoryCategory | string;
  } | null;
  onClearPrefill?: () => void;
}

export function MemoryView({ initialPrefill, onClearPrefill }: MemoryViewProps) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('Preference');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for Delete Confirmation
  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle external prefill from Conversation or Journal
  useEffect(() => {
    if (initialPrefill && initialPrefill.content) {
      setEditingMemory(null);
      setFormContent(initialPrefill.content);
      const matchedCat = CATEGORIES.find(
        (c) => c.toLowerCase() === (initialPrefill.category || '').toLowerCase()
      );
      setFormCategory(matchedCat || 'Personal Context');
      setFormError(null);
      setModalOpen(true);
      if (onClearPrefill) onClearPrefill();
    }
  }, [initialPrefill, onClearPrefill]);

  // Subscribe to memories in Firestore
  useEffect(() => {
    if (!user) {
      setMemories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToMemories(
      user.uid,
      (list) => {
        setMemories(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore memory subscription error:', err);
        setError('Failed to load memories from Firestore. Please try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Open modal for new memory
  const handleOpenAdd = () => {
    setEditingMemory(null);
    setFormContent('');
    setFormCategory('Preference');
    setFormError(null);
    setModalOpen(true);
  };

  // Open modal for editing memory
  const handleOpenEdit = (mem: Memory) => {
    setEditingMemory(mem);
    setFormContent(mem.content);
    const matchedCat = CATEGORIES.find((c) => c === mem.category) || 'Other';
    setFormCategory(matchedCat as MemoryCategory);
    setFormError(null);
    setModalOpen(true);
  };

  // Close form modal
  const handleCloseModal = () => {
    if (isSubmitting) return;
    setModalOpen(false);
    setEditingMemory(null);
    setFormContent('');
    setFormError(null);
  };

  // Handle form submission (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    const trimmed = formContent.trim();
    if (!trimmed) {
      setFormError('Memory content cannot be empty.');
      return;
    }

    // Check duplicate
    if (isDuplicateMemory(memories, trimmed, editingMemory?.id)) {
      setFormError('This memory already exists.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingMemory) {
        // Update existing memory
        await updateMemory(user.uid, editingMemory.id, trimmed, formCategory);
      } else {
        // Create new memory
        await createMemory(user.uid, trimmed, formCategory);
      }
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving memory:', err);
      setFormError(err?.message || 'Failed to save memory. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle memory deletion
  const handleConfirmDelete = async () => {
    if (!user || !deletingMemory || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteMemory(user.uid, deletingMemory.id);
      setDeletingMemory(null);
    } catch (err: any) {
      console.error('Error deleting memory:', err);
      setError('Failed to delete memory from Firestore.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search memories
  const filteredMemories = useMemo(() => {
    return memories.filter((mem) => {
      const matchesCat = 
        selectedCategory === 'All' || 
        mem.category.toLowerCase() === selectedCategory.toLowerCase();
      
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        !q || 
        mem.content.toLowerCase().includes(q) || 
        mem.category.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [memories, selectedCategory, searchQuery]);

  // Helper for Category Icons and Styles
  const getCategoryMeta = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'preference':
        return {
          icon: Sparkles,
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Preference'
        };
      case 'goal':
        return {
          icon: Target,
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Goal'
        };
      case 'project':
        return {
          icon: Briefcase,
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'Project'
        };
      case 'personal context':
        return {
          icon: User,
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'Personal Context'
        };
      case 'habit':
        return {
          icon: Activity,
          color: 'bg-teal-50 text-teal-700 border-teal-200',
          label: 'Habit'
        };
      default:
        return {
          icon: HelpCircle,
          color: 'bg-neutral-100 text-neutral-700 border-neutral-200',
          label: cat || 'Other'
        };
    }
  };

  return (
    <div id="memory-workspace" className="max-w-5xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-2xs">
                <Brain className="w-4 h-4 text-purple-200" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-950 tracking-tight">
                  Memory
                </h1>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Your private long-term context for Gemini.
            </p>
          </div>

          <button
            id="btn-add-memory"
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Memory</span>
          </button>
        </div>

        {/* Section Intro */}
        <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
          <div>
            <span className="font-semibold text-neutral-900">Personal Memory: </span>
            <span>Control what Gemini remembers about you.</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'} saved
          </span>
        </div>
      </div>

      {/* Search and Category Filters */}
      {memories.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                id="search-memories-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 focus:border-neutral-900 focus:outline-hidden bg-neutral-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Count indicator */}
            <div className="flex items-center space-x-1.5 text-xs text-neutral-400 self-end sm:self-center font-mono">
              <Filter className="w-3.5 h-3.5" />
              <span>Showing {filteredMemories.length} of {memories.length}</span>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'All'
                  ? 'bg-neutral-950 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              All ({memories.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = memories.filter((m) => m.category.toLowerCase() === cat.toLowerCase()).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-950 text-white shadow-2xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {cat} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-800" />
          <p className="text-xs text-neutral-500 font-mono">Loading your memories...</p>
        </div>
      ) : memories.length === 0 ? (
        /* Empty State */
        <div id="memory-empty-state" className="p-16 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
            <Brain className="w-7 h-7 text-purple-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-neutral-950">
              No memories yet.
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
              Important preferences and context you choose to save will appear here.
            </p>
          </div>
          <button
            id="btn-add-first-memory"
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Memory</span>
          </button>
        </div>
      ) : filteredMemories.length === 0 ? (
        /* No Search Matches */
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-2">
          <Search className="w-6 h-6 mx-auto text-neutral-400" />
          <h4 className="text-sm font-bold text-neutral-800">No matching memories found</h4>
          <p className="text-xs text-neutral-500">
            Try adjusting your search query or filter category.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="mt-2 text-xs font-semibold text-purple-700 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Grid of Memory Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((mem) => {
            const catMeta = getCategoryMeta(mem.category);
            const CatIcon = catMeta.icon;

            return (
              <div
                key={mem.id}
                id={`memory-card-${mem.id}`}
                className="bg-white p-5 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-all group"
              >
                <div className="space-y-3">
                  {/* Category Pill and Actions */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${catMeta.color}`}>
                      <CatIcon className="w-3 h-3" />
                      <span>{catMeta.label}</span>
                    </span>

                    <div className="flex items-center space-x-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(mem)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                        title="Edit Memory"
                        aria-label="Edit Memory"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingMemory(mem)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Memory"
                        aria-label="Delete Memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Memory Text Content */}
                  <p className="text-xs md:text-sm text-neutral-900 leading-relaxed font-normal whitespace-pre-wrap">
                    {mem.content}
                  </p>
                </div>

                {/* Timestamps & Edit/Delete Action Footer */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>
                      {mem.updatedAt?.toDate
                        ? `Updated ${mem.updatedAt.toDate().toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}`
                        : mem.createdAt?.toDate
                        ? `Created ${mem.createdAt.toDate().toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}`
                        : 'Saved context'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(mem)}
                      className="text-neutral-600 hover:text-neutral-950 font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => setDeletingMemory(mem)}
                      className="text-neutral-400 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MEMORY MODAL */}
      {modalOpen && (
        <div 
          id="modal-memory-form"
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
                    {editingMemory ? 'Edit Memory' : 'Add Memory'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Provide context or preferences for Gemini's long-term recall.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Memory Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">
                  Memory Context
                </label>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => {
                    setFormContent(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="e.g., User prefers practical learning through real projects rather than theory."
                  className="w-full text-xs md:text-sm p-3.5 rounded-2xl border border-neutral-300 focus:border-neutral-900 focus:outline-hidden bg-white leading-relaxed resize-none"
                  autoFocus
                  required
                />
                <span className="text-[10px] text-neutral-400 font-mono block text-right">
                  {formContent.trim().length} characters
                </span>
              </div>

              {/* Category Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = formCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setFormCategory(cat)}
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

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formContent.trim()}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Memory</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingMemory && (
        <div 
          id="modal-delete-memory"
          className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-950">
                  Delete this memory?
                </h3>
                <p className="text-xs text-neutral-500">
                  This action will permanently remove this context from Gemini.
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
              <span className="font-semibold block truncate">
                Category: {deletingMemory.category}
              </span>
              <p className="text-xs text-neutral-600 italic line-clamp-3">
                "{deletingMemory.content}"
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMemory(null)}
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
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
