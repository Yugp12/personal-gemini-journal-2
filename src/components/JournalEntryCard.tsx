import React, { useState } from 'react';
import type { JournalEntry, AIPrivacyPolicy } from '../types';
import { 
  Calendar, 
  Tag, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Loader2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Brain,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { saveJournalReflection } from '../lib/journalService';
import { getFirewallPolicy, getActivePrivacyPolicy, recordPrivacyReceipt } from '../lib/firewallService';
import { ShowMeWhatGeminiSeesModal } from './ShowMeWhatGeminiSeesModal';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => Promise<void>;
  onSaveAsMemory?: (content: string, category?: string) => void;
  userId: string;
}

export function JournalEntryCard({
  entry,
  onEdit,
  onDelete,
  onSaveAsMemory,
  userId
}: JournalEntryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [reflectionText, setReflectionText] = useState<string | null>(entry.reflection || null);
  const [showReflection, setShowReflection] = useState(Boolean(entry.reflection));
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [showGeminiSeesModal, setShowGeminiSeesModal] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleGeminiReflect = async (overridePolicy?: AIPrivacyPolicy) => {
    setReflecting(true);
    setReflectionError(null);
    setShowReflection(true);

    try {
      const activePolicy = overridePolicy ? { ...getFirewallPolicy(), aiPrivacyPolicy: overridePolicy } : getFirewallPolicy();

      // Retrieve Firebase auth token from session
      let token = '';
      try {
        const { auth } = await import('../lib/firebase');
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch {
        // Continue with header token
      }

      const response = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: entry.title,
          content: entry.content,
          mood: entry.mood,
          tags: entry.tags,
          firewallPolicy: activePolicy
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate reflection');
      }

      const data = await response.json();
      const reflectionContent = data.summary 
        ? `${data.summary}\n\nKey Insights:\n${(data.insights || []).map((i: string) => `• ${i}`).join('\n')}\n\nReflection Questions:\n${(data.questions || []).map((q: string, idx: number) => `${idx + 1}. ${q}`).join('\n')}`
        : data.reflection || 'Reflection completed.';

      setReflectionText(reflectionContent);
      
      if (data.privacyReceipt) {
        recordPrivacyReceipt(data.privacyReceipt, userId);
      }

      // Persist reflection to Firestore under the user's journal entry
      await saveJournalReflection(userId, entry.id, reflectionContent);
    } catch (err: any) {
      setReflectionError(err.message || 'Could not contact Gemini AI service.');
    } finally {
      setReflecting(false);
    }
  };

  const formattedDate = entry.createdAt?.toDate 
    ? entry.createdAt.toDate().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent';

  return (
    <div 
      id={`journal-card-${entry.id}`} 
      className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs hover:shadow-xs transition-all p-5 md:p-6 space-y-4"
    >
      {/* Card Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 pr-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{entry.mood || '😊'}</span>
            <h4 className="text-base font-bold text-neutral-900 leading-snug">
              {entry.title}
            </h4>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-neutral-400 font-mono">
            <Calendar className="w-3 h-3 text-neutral-400" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Edit / Delete Buttons */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            id={`btn-edit-entry-${entry.id}`}
            onClick={() => onEdit(entry)}
            className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            title="Edit Entry"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            id={`btn-delete-entry-${entry.id}`}
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Delete Entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entry Body Preview */}
      <p className="text-xs md:text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
        {entry.content}
      </p>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {entry.tags.map((t, idx) => (
            <span
              key={idx}
              className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-mono"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>#{t}</span>
            </span>
          ))}
        </div>
      )}

      {/* Gemini AI Reflection & Memory Actions */}
      <div className="pt-2 border-t border-neutral-100 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              id={`btn-gemini-reflect-${entry.id}`}
              onClick={() => handleGeminiReflect()}
              disabled={reflecting}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {reflecting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
              <span>{reflecting ? 'Reflecting...' : reflectionText ? 'Re-Reflect' : 'Reflect with Gemini'}</span>
            </button>

            {/* Show Me What Gemini Sees Button */}
            <button
              id={`btn-preview-gemini-${entry.id}`}
              onClick={() => setShowGeminiSeesModal(true)}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              title="Inspect sanitized context before or after reflection"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>What Gemini Sees</span>
            </button>

            {onSaveAsMemory && (
              <button
                id={`btn-save-memory-${entry.id}`}
                onClick={() => onSaveAsMemory(entry.content, 'Personal Context')}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                title="Save as a long-term memory for Gemini"
              >
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                <span>Save Memory</span>
              </button>
            )}
          </div>

          {reflectionText && (
            <button
              onClick={() => setShowReflection(!showReflection)}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 flex items-center space-x-1 cursor-pointer font-medium"
            >
              <span>{showReflection ? 'Hide Insights' : 'Show Insights'}</span>
              {showReflection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {showReflection && (
          <div className="mt-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-2 leading-relaxed animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Gemini Reflection & Insights</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-800 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Firewall Protected</span>
              </span>
            </div>
            {reflectionError ? (
              <p className="text-red-700 text-xs">{reflectionError}</p>
            ) : (
              <div className="whitespace-pre-wrap font-sans text-xs">
                {reflectionText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Box */}
      {confirmDelete && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Permanently delete this entry?</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-red-100 rounded"
            >
              Cancel
            </button>
            <button
              id={`btn-confirm-delete-${entry.id}`}
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Pre-Flight / Post-Flight Show What Gemini Sees Modal */}
      {showGeminiSeesModal && (
        <ShowMeWhatGeminiSeesModal
          originalContent={entry.content}
          title={entry.title}
          mood={entry.mood}
          tags={entry.tags}
          onClose={() => setShowGeminiSeesModal(false)}
          onProceedWithReflection={(customPolicy) => {
            handleGeminiReflect(customPolicy);
          }}
        />
      )}
    </div>
  );
}
