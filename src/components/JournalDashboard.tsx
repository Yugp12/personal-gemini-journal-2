import React, { useState } from 'react';
import type { JournalEntry } from '../types';
import { useAuth } from '../lib/AuthContext';
import { JournalComposer } from './JournalComposer';
import { JournalEntryList } from './JournalEntryList';
import { createJournalEntry, updateJournalEntry, deleteJournalEntry } from '../lib/journalService';
import { 
  Sparkles, 
  BookOpen, 
  Smile, 
  Flame, 
  TrendingUp, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

interface JournalDashboardProps {
  entries: JournalEntry[];
  loading: boolean;
  error: string | null;
}

export function JournalDashboard({ entries, loading, error }: JournalDashboardProps) {
  const { user } = useAuth();
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'there';

  const handleSaveEntry = async (data: { title: string; content: string; mood: string; tags: string[] }) => {
    if (!user) return;
    setIsSaving(true);
    setActionError(null);

    try {
      if (editingEntry) {
        await updateJournalEntry(user.uid, editingEntry.id, data);
        setEditingEntry(null);
      } else {
        await createJournalEntry(user.uid, data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to save journal entry');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!user) return;
    setActionError(null);
    try {
      await deleteJournalEntry(user.uid, id);
      if (editingEntry?.id === id) {
        setEditingEntry(null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete journal entry');
      throw err;
    }
  };

  return (
    <div id="journal-dashboard-main" className="space-y-8 max-w-4xl mx-auto w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-emerald-300 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Personal Reflection Vault</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {displayName}.
          </h2>
          <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">
            How are you feeling today? Take a moment to write down your thoughts, observations, and reflections.
          </p>
        </div>

        {/* Ambient subtle shape */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Composer Area */}
      <div id="section-composer">
        <JournalComposer
          initialEntry={editingEntry}
          onSave={handleSaveEntry}
          onCancel={editingEntry ? () => setEditingEntry(null) : undefined}
          isSaving={isSaving}
        />
      </div>

      {/* Entries Timeline Header */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-neutral-700" />
            <span>Your Journal Entries</span>
          </h3>
          <span className="text-xs font-mono text-neutral-500">
            {entries.length} {entries.length === 1 ? 'reflection' : 'reflections'}
          </span>
        </div>

        {/* Entries List Component */}
        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-800" />
            <p className="text-xs font-semibold text-neutral-500 font-mono">Loading your reflections from Firestore...</p>
          </div>
        ) : (
          <JournalEntryList
            entries={entries}
            onEdit={(entry) => {
              setEditingEntry(entry);
              window.scrollTo({ top: 180, behavior: 'smooth' });
            }}
            onDelete={handleDeleteEntry}
            userId={user?.uid || ''}
          />
        )}
      </div>
    </div>
  );
}
