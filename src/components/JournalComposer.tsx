import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Tag, 
  Save, 
  X, 
  Loader2, 
  Lock, 
  AlertCircle,
  Eye 
} from 'lucide-react';
import type { JournalEntry } from '../types';
import { ShowMeWhatGeminiSeesModal } from './ShowMeWhatGeminiSeesModal';

interface JournalComposerProps {
  initialEntry?: JournalEntry | null;
  onSave: (data: { title: string; content: string; mood: string; tags: string[] }) => Promise<void>;
  onCancel?: () => void;
  isSaving: boolean;
}

export function JournalComposer({
  initialEntry,
  onSave,
  onCancel,
  isSaving
}: JournalComposerProps) {
  const [title, setTitle] = useState(initialEntry?.title || '');
  const [content, setContent] = useState(initialEntry?.content || '');
  const [mood, setMood] = useState(initialEntry?.mood || '😊');
  const [tags, setTags] = useState<string[]>(initialEntry?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showGeminiPreview, setShowGeminiPreview] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialEntry) {
      setTitle(initialEntry.title || '');
      setContent(initialEntry.content || '');
      setMood(initialEntry.mood || '😊');
      setTags(initialEntry.tags || []);
      setTagInput('');
    }
  }, [initialEntry]);

  const moods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😔', label: 'Sad' },
    { emoji: '😡', label: 'Frustrated' },
    { emoji: '🤔', label: 'Reflective' }
  ];

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
      setError('Tag length must be 30 characters or less.');
      return;
    }
    if (tags.length >= 10) {
      setError('Maximum 10 tags allowed per entry.');
      return;
    }

    const alreadyExists = tags.some((t) => t.toLowerCase() === clean.toLowerCase());
    if (!alreadyExists) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
    setError(null);
    setTimeout(() => {
      tagInputRef.current?.focus();
    }, 0);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please write some thoughts before saving.');
      return;
    }

    setError(null);

    try {
      await onSave({
        title: title.trim() || 'Untitled Reflection',
        content: content.trim(),
        mood,
        tags
      });

      if (!initialEntry) {
        setTitle('');
        setContent('');
        setMood('😊');
        setTags([]);
        setTagInput('');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save journal entry.');
    }
  };

  return (
    <div id="journal-composer" className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
            {initialEntry ? 'Edit Journal Entry' : 'What’s on your mind?'}
          </h3>
          <p className="text-xs text-neutral-500">
            Encrypted & path-bound to your authenticated UID in Firestore.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Title
          </label>
          <input
            id="composer-input-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Today's thoughts & reflections..."
            className="w-full text-sm font-medium px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 text-neutral-900 placeholder:text-neutral-400"
          />
        </div>

        {/* Mood Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Mood
          </label>
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                type="button"
                key={m.emoji}
                onClick={() => setMood(m.emoji)}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-all cursor-pointer flex items-center space-x-1.5 ${
                  mood === m.emoji
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <span>{m.emoji}</span>
                <span className="text-xs font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Textarea */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Entry
          </label>
          <textarea
            id="composer-input-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your private thoughts, decisions, notes, or memories here..."
            className="w-full text-sm leading-relaxed px-4 py-3 rounded-xl border border-neutral-300 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10 text-neutral-800 placeholder:text-neutral-400 resize-y"
            required
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5 flex items-center space-x-1.5">
            <Tag className="w-3.5 h-3.5 text-neutral-500" />
            <span>TAGS (PRESS ENTER TO ADD)</span>
          </label>

          {/* Tags Chips */}
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

          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-2.5 text-neutral-400 font-mono text-xs">#</span>
              <input
                ref={tagInputRef}
                id="composer-input-tags"
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  if (error) setError(null);
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

        {/* Actions Footer */}
        <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3 text-[11px] text-neutral-400 font-mono">
            <div className="flex items-center space-x-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>/users/{'{uid}'}/journals</span>
            </div>
            {content.trim().length >= 15 && (
              <button
                type="button"
                onClick={() => setShowGeminiPreview(true)}
                className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-sans font-semibold hover:underline cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show What Gemini Sees</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              id="btn-save-journal-entry"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving...' : initialEntry ? 'Update Entry' : 'Save Journal Entry'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Show What Gemini Sees Pre-Flight Modal */}
      {showGeminiPreview && (
        <ShowMeWhatGeminiSeesModal
          originalContent={content}
          title={title}
          mood={mood}
          tags={tags}
          onClose={() => setShowGeminiPreview(false)}
        />
      )}
    </div>
  );
}
