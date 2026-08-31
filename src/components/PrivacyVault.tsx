import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  subscribeToVaultRecords, 
  createVaultRecord, 
  updateVaultRecord, 
  deleteVaultRecord 
} from '../lib/vaultService';
import { logSecurityEvent } from '../lib/securityService';
import type { VaultRecord, VaultCategory } from '../types';
import { 
  Lock, 
  Unlock, 
  Shield, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Loader2, 
  AlertCircle,
  KeyRound,
  CheckCircle2,
  X,
  Search,
  Clock,
  Sparkles,
  FileText
} from 'lucide-react';

const VAULT_CATEGORIES: VaultCategory[] = [
  'Personal',
  'Important',
  'Private Note',
  'Other'
];

export function PrivacyVault() {
  const { user, reauthenticateWithGoogle } = useAuth();

  // Application-level lock state (defaults to locked on every fresh mount/session)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Vault data state (only queried when unlocked)
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VaultRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<VaultRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<VaultRecord | null>(null);

  // Form states for Add / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<VaultCategory>('Personal');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  // Subscribe to Firestore records ONLY when unlocked and user is present
  useEffect(() => {
    if (!isUnlocked || !user) {
      setRecords([]);
      return;
    }

    setLoadingRecords(true);
    setFetchError(null);

    const unsubscribe = subscribeToVaultRecords(
      user.uid,
      (fetchedRecords) => {
        setRecords(fetchedRecords);
        setLoadingRecords(false);
      },
      (err) => {
        console.error('Failed to load vault records:', err);
        setFetchError('Unable to load private vault records. Please check your connection.');
        setLoadingRecords(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isUnlocked, user]);

  // Handle Unlock with Firebase Reauthentication
  const handleUnlockVault = async () => {
    if (!user) {
      setUnlockError('You must be signed in with Google to unlock your vault.');
      return;
    }

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      await reauthenticateWithGoogle();
      setIsUnlocked(true);
      logSecurityEvent('VAULT_UNLOCKED', 'Privacy Vault unlocked via Google reauthentication.', 'secure', 'Privacy Vault');
      showToast('Vault unlocked successfully.');
    } catch (err: any) {
      console.warn('Vault unlock reauthentication notice:', err?.message);
      const msg = err?.message || 'Verification failed. Please try again.';
      setUnlockError(msg);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle Lock Vault
  const handleLockVault = () => {
    setIsUnlocked(false);
    setRecords([]);
    setShowAddModal(false);
    setEditingRecord(null);
    setViewingRecord(null);
    setDeletingRecord(null);
    setSearchQuery('');
    setUnlockError(null);
    logSecurityEvent('VAULT_LOCKED', 'Privacy Vault locked. In-memory record references purged.', 'info', 'Privacy Vault');
    showToast('Vault locked.');
  };

  // Open Add Modal
  const openAddModal = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('Personal');
    setFormError(null);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (record: VaultRecord) => {
    setEditingRecord(record);
    setFormTitle(record.title);
    setFormContent(record.content);
    setFormCategory(
      VAULT_CATEGORIES.includes(record.category as VaultCategory)
        ? (record.category as VaultCategory)
        : 'Personal'
    );
    setFormError(null);
  };

  // Save new record
  const handleSaveNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = formTitle.trim();
    const trimmedContent = formContent.trim();

    if (!trimmedTitle) {
      setFormError('Please enter a title for this private record.');
      return;
    }

    if (!trimmedContent) {
      setFormError('Please enter private content for this record.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createVaultRecord(user.uid, trimmedTitle, trimmedContent, formCategory);
      setShowAddModal(false);
      showToast('Private record saved successfully.');
    } catch (err: any) {
      console.error('Failed to create vault record:', err);
      setFormError(err?.message || 'Failed to save private record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save edited record
  const handleSaveEditedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingRecord) return;

    const trimmedTitle = formTitle.trim();
    const trimmedContent = formContent.trim();

    if (!trimmedTitle) {
      setFormError('Title cannot be empty.');
      return;
    }

    if (!trimmedContent) {
      setFormError('Content cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await updateVaultRecord(
        user.uid,
        editingRecord.id,
        trimmedTitle,
        trimmedContent,
        formCategory
      );
      
      // Update viewingRecord if it was open
      if (viewingRecord && viewingRecord.id === editingRecord.id) {
        setViewingRecord({
          ...viewingRecord,
          title: trimmedTitle,
          content: trimmedContent,
          category: formCategory
        });
      }

      setEditingRecord(null);
      showToast('Private record updated.');
    } catch (err: any) {
      console.error('Failed to update vault record:', err);
      setFormError(err?.message || 'Failed to update record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete record
  const handleConfirmDelete = async () => {
    if (!user || !deletingRecord) return;

    setIsDeleting(true);
    try {
      await deleteVaultRecord(user.uid, deletingRecord.id);
      
      if (viewingRecord && viewingRecord.id === deletingRecord.id) {
        setViewingRecord(null);
      }
      
      setDeletingRecord(null);
      showToast('Private record deleted.');
    } catch (err: any) {
      console.error('Failed to delete vault record:', err);
      showToast('Failed to delete record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesCategory =
      selectedCategory === 'All' || r.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Format date helper (e.g., "29 Aug 2026")
  const formatDate = (timestamp?: any) => {
    if (!timestamp) return 'Recently';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    return 'Recently';
  };

  return (
    <div id="privacy-vault-container" className="max-w-5xl mx-auto w-full space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl border border-neutral-700 flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-[11px] font-semibold text-purple-900 border border-purple-200">
              <Shield className="w-3 h-3 text-purple-600" />
              <span>Protected Area</span>
            </span>
            {isUnlocked && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-900 border border-emerald-200">
                <Unlock className="w-3 h-3 text-emerald-600" />
                <span>Vault Unlocked</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-neutral-950 tracking-tight flex items-center space-x-2.5">
            <Lock className="w-6 h-6 text-neutral-900" />
            <span>Privacy Vault</span>
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 mt-1 max-w-xl">
            A private space for information you want to keep separately protected.
          </p>
        </div>

        {/* Lock / Unlock Toggle Button in Header */}
        <div>
          {isUnlocked ? (
            <button
              id="btn-lock-vault"
              type="button"
              onClick={handleLockVault}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Lock className="w-4 h-4 text-neutral-700" />
              <span>Lock Vault</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LOCKED STATE (Default & Initial State) */}
      {/* ========================================================================= */}
      {!isUnlocked && (
        <div 
          id="vault-locked-card"
          className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-8 md:p-14 text-center space-y-6 max-w-2xl mx-auto"
        >
          <div className="w-16 h-16 mx-auto rounded-3xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 shadow-inner">
            <Lock className="w-8 h-8 text-neutral-700" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-neutral-950">
              🔒 Privacy Vault Locked
            </h2>
            <p className="text-xs md:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
              Your vault requires an additional verification step before private records can be viewed.
            </p>
            <p className="text-[11px] font-medium text-neutral-400">
              Additional application-level protection
            </p>
          </div>

          {unlockError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start space-x-2 text-left max-w-md mx-auto">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{unlockError}</span>
            </div>
          )}

          <div>
            <button
              id="btn-unlock-vault"
              type="button"
              onClick={handleUnlockVault}
              disabled={isUnlocking}
              className="inline-flex items-center space-x-2 px-6 py-3 text-xs md:text-sm font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Identity...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-amber-300" />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNLOCKED STATE (Private Records List & Management) */}
      {/* ========================================================================= */}
      {isUnlocked && (
        <div id="vault-unlocked-content" className="space-y-6 animate-in fade-in duration-200">
          {/* Section Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                Private Records
              </h2>
              <p className="text-xs text-neutral-500">
                {records.length} {records.length === 1 ? 'record' : 'records'} stored in your UID partition
              </p>
            </div>

            <button
              id="btn-add-vault-record"
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ Add Private Record</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-vault"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search private records by title or text..."
                className="w-full text-xs pl-10 pr-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:outline-hidden focus:border-neutral-900 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'All'
                    ? 'bg-neutral-950 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                All ({records.length})
              </button>
              {VAULT_CATEGORIES.map((cat) => {
                const count = records.filter((r) => r.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-neutral-950 text-white shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fetch Error Notice */}
          {fetchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {/* Loading Records State */}
          {loadingRecords ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-700" />
              <p className="text-xs text-neutral-500 font-medium">Loading private records securely...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            /* Empty State */
            <div 
              id="vault-empty-state"
              className="p-12 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4 max-w-lg mx-auto"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No matching private records found'
                    : 'No private records yet'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'Try adjusting your search query or category filter.'
                    : 'Store your sensitive notes, confidential ideas, and protected records safely in your private vault.'}
                </p>
              </div>
              {!searchQuery && selectedCategory === 'All' && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Your First Record</span>
                </button>
              )}
            </div>
          ) : (
            /* Records Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecords.map((record) => {
                const previewText =
                  record.content.length > 130
                    ? `${record.content.slice(0, 130)}...`
                    : record.content;

                return (
                  <div
                    key={record.id}
                    id={`vault-record-${record.id}`}
                    className="bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      {/* Top Meta: Category & Date */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-purple-900 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                          <Lock className="w-2.5 h-2.5 text-purple-600" />
                          <span>{record.category || 'Personal'}</span>
                        </span>

                        <span className="text-[11px] text-neutral-400 font-mono flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Updated {formatDate(record.updatedAt || record.createdAt)}</span>
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-neutral-950 line-clamp-1">
                        {record.title}
                      </h3>

                      {/* Short Preview */}
                      <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 font-mono text-[11px]">
                        {previewText}
                      </p>
                    </div>

                    {/* Actions: [Open] [Edit] [Delete] */}
                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <button
                          id={`btn-open-vault-${record.id}`}
                          type="button"
                          onClick={() => setViewingRecord(record)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Open</span>
                        </button>

                        <button
                          id={`btn-edit-vault-${record.id}`}
                          type="button"
                          onClick={() => openEditModal(record)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <button
                        id={`btn-delete-vault-${record.id}`}
                        type="button"
                        onClick={() => setDeletingRecord(record)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECURITY INFORMATION: Vault Protection */}
      {/* ========================================================================= */}
      <div 
        id="vault-protection-info"
        className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3"
      >
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
            Vault Protection
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-neutral-600 pt-1">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-neutral-200">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Firebase Authentication</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-neutral-200">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>UID-isolated Firestore partition</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-neutral-200">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Additional reauthentication</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-neutral-200">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Locked by default</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-neutral-200 col-span-1 sm:col-span-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Excluded from Gemini context</span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-500 pt-1 leading-relaxed">
          Additional application-level protection ensures private records remain inaccessible in memory until explicitly reauthenticated. Privacy Vault records are strictly excluded from automated AI context pipelines.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS */}
      {/* ========================================================================= */}

      {/* ADD MODAL */}
      {showAddModal && (
        <div 
          id="add-vault-record-modal"
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white w-full max-w-lg rounded-3xl border border-neutral-200 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-950">Add Private Record</h3>
                  <p className="text-[11px] text-neutral-500">Saved securely into your UID-isolated vault partition</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Title *
                </label>
                <input
                  id="input-vault-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Sensitive Family Document, Financial Goal, Private Key Note"
                  className="w-full text-xs md:text-sm px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 transition-colors"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VAULT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                        formCategory === cat
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs font-semibold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Private Content *
                </label>
                <textarea
                  id="textarea-vault-content"
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter your sensitive notes here. Content stored here is excluded from Gemini and protected behind your vault lock..."
                  className="w-full text-xs md:text-sm p-3.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 transition-colors font-mono leading-relaxed"
                  required
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100">
                <button
                  id="btn-cancel-add-vault"
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-vault-record"
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div 
          id="edit-vault-record-modal"
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white w-full max-w-lg rounded-3xl border border-neutral-200 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-950">Edit Private Record</h3>
                  <p className="text-[11px] text-neutral-500">Update record content in your private vault</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRecord} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Title *
                </label>
                <input
                  id="input-edit-vault-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs md:text-sm px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 transition-colors"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VAULT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                        formCategory === cat
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs font-semibold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-neutral-600 mb-1">
                  Private Content *
                </label>
                <textarea
                  id="textarea-edit-vault-content"
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full text-xs md:text-sm p-3.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 transition-colors font-mono leading-relaxed"
                  required
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100">
                <button
                  id="btn-cancel-edit-vault"
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-update-vault-record"
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW / OPEN RECORD MODAL */}
      {viewingRecord && (
        <div 
          id="view-vault-record-modal"
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-neutral-200 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between">
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1 text-xs font-semibold text-purple-900 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                    <Lock className="w-3 h-3 text-purple-600" />
                    <span>{viewingRecord.category || 'Personal'}</span>
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    Updated {formatDate(viewingRecord.updatedAt || viewingRecord.createdAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h2 className="text-xl font-bold text-neutral-950">
                  {viewingRecord.title}
                </h2>
              </div>

              {/* Full Content */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs md:text-sm font-mono text-neutral-800 whitespace-pre-wrap leading-relaxed">
                {viewingRecord.content}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const rec = viewingRecord;
                    setViewingRecord(null);
                    openEditModal(rec);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rec = viewingRecord;
                    setViewingRecord(null);
                    setDeletingRecord(rec);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingRecord && (
        <div 
          id="delete-vault-record-modal"
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white w-full max-w-md rounded-3xl border border-neutral-200 shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-neutral-950">
                Delete this private record?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                This record will be permanently deleted from your private vault. This action cannot be undone.
              </p>
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-800 truncate">
                "{deletingRecord.title}"
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-vault"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
