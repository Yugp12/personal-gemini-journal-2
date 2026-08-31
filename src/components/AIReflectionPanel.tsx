import React, { useState } from 'react';
import type { AIReflection, JournalEntry, PrivacyXRayReceipt } from '../types';
import { 
  Sparkles, 
  RotateCcw, 
  X, 
  Tag as TagIcon, 
  HelpCircle, 
  Check, 
  Plus, 
  Clock, 
  Lightbulb, 
  FileText,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { PrivacyXRayModal } from './PrivacyXRayModal';

interface AIReflectionPanelProps {
  entry: JournalEntry;
  reflection: AIReflection | null;
  isLoading: boolean;
  error: string | null;
  onRegenerate: () => void;
  onClose: () => void;
  onAddTag: (tag: string) => Promise<void> | void;
  onAddAllTags: (tags: string[]) => Promise<void> | void;
  addingTag: string | null;
  isAddingAllTags: boolean;
}

// Helper to format Firestore timestamp or date safely
function formatReflectionDate(ts: unknown): string {
  if (!ts) return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  let millis = 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    millis = (ts as { toMillis: () => number }).toMillis();
  } else if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    millis = (ts as { toDate: () => Date }).toDate().getTime();
  } else if (typeof ts === 'object' && 'seconds' in (ts as Record<string, unknown>)) {
    const s = (ts as { seconds: number; nanoseconds?: number }).seconds;
    const ns = (ts as { seconds: number; nanoseconds?: number }).nanoseconds || 0;
    millis = s * 1000 + ns / 1000000;
  } else if (ts instanceof Date) {
    millis = ts.getTime();
  } else if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) millis = parsed;
  }

  if (!millis) {
    return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return new Date(millis).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function AIReflectionPanel({
  entry,
  reflection,
  isLoading,
  error,
  onRegenerate,
  onClose,
  onAddTag,
  onAddAllTags,
  addingTag,
  isAddingAllTags
}: AIReflectionPanelProps) {
  const [showXRay, setShowXRay] = useState(false);

  const currentTagsLower = new Set(
    (Array.isArray(entry.tags) ? entry.tags : []).map((t) => t.toLowerCase().replace(/^#/, ''))
  );

  const availableUnaddedTags = (reflection?.suggestedTags || []).filter(
    (tag) => !currentTagsLower.has(tag.toLowerCase().replace(/^#/, ''))
  );

  return (
    <div 
      id="ai-reflection-panel"
      className="bg-neutral-50/80 rounded-2xl border border-neutral-200 p-5 md:p-6 space-y-6 shadow-2xs animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-neutral-200/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Sparkles className="w-4 h-4 text-amber-600 fill-amber-300" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 tracking-tight">
              Gemini Reflection
            </h3>
          </div>
          {reflection?.generatedAt && !isLoading && (
            <div className="flex items-center space-x-1.5 text-[11px] text-neutral-500 font-mono pl-9">
              <Clock className="w-3 h-3 text-neutral-400" />
              <span>Reflected on {formatReflectionDate(reflection.generatedAt)}</span>
            </div>
          )}
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-1.5">
          {reflection?.privacyReceipt && !isLoading && (
            <button
              id="btn-reflection-privacy-xray"
              type="button"
              onClick={() => setShowXRay(true)}
              title="View Context Firewall Privacy X-Ray"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Privacy X-Ray</span>
            </button>
          )}

          {!isLoading && (
            <button
              id="btn-regenerate-reflection"
              type="button"
              onClick={onRegenerate}
              title="Regenerate Reflection"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3 h-3 text-neutral-500" />
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}
          <button
            id="btn-close-reflection-panel"
            type="button"
            onClick={onClose}
            title="Close Reflection"
            aria-label="Close Reflection"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div id="ai-reflection-loading" className="py-10 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-neutral-800 tracking-wide font-mono">
            Gemini is reflecting...
          </p>
          <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
            Context Firewall evaluated. Vault excluded (0 bytes). Mindfully synthesizing your entry.
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div id="ai-reflection-error" className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-900 space-y-2.5">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold text-neutral-900">
                {error.includes('Write a little more') 
                  ? 'Write a little more before asking Gemini to reflect.' 
                  : error.includes('Context Firewall')
                    ? error
                    : 'Gemini reflection is temporarily unavailable.'}
              </p>
              {!error.includes('Write a little more') && !error.includes('Context Firewall') && (
                <p className="text-neutral-600">
                  Your journal entry is safe. You can try again.
                </p>
              )}
            </div>
          </div>
          {!error.includes('Write a little more') && !error.includes('Context Firewall') && (
            <div className="pl-6 pt-1">
              <button
                id="btn-try-again-reflection"
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-medium text-xs shadow-2xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Structured Content (When Reflection Exists and not loading) */}
      {!isLoading && !error && reflection && (
        <div className="space-y-5">
          {/* 1. Summary */}
          {reflection.summary && (
            <div id="section-reflection-summary" className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Summary</span>
              </div>
              <p className="text-xs md:text-sm text-neutral-800 leading-relaxed bg-white rounded-xl p-3.5 border border-neutral-200/80 shadow-2xs">
                {reflection.summary}
              </p>
            </div>
          )}

          {/* 2. What I Notice / Insights */}
          {Array.isArray(reflection.insights) && reflection.insights.length > 0 && (
            <div id="section-reflection-insights" className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>What I Notice</span>
              </div>
              <ul className="space-y-2 bg-white rounded-xl p-3.5 border border-neutral-200/80 shadow-2xs">
                {reflection.insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-xs md:text-sm text-neutral-800 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 3. Reflection Questions */}
          {Array.isArray(reflection.questions) && reflection.questions.length > 0 && (
            <div id="section-reflection-questions" className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reflection Questions</span>
              </div>
              <ol className="space-y-2 bg-white rounded-xl p-3.5 border border-neutral-200/80 shadow-2xs">
                {reflection.questions.map((question, idx) => (
                  <li key={idx} className="flex items-start space-x-2.5 text-xs md:text-sm text-neutral-800 leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{question}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 4. Suggested Tags */}
          {Array.isArray(reflection.suggestedTags) && reflection.suggestedTags.length > 0 && (
            <div id="section-reflection-suggested-tags" className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700">
                  <TagIcon className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Suggested Tags</span>
                </div>
                {availableUnaddedTags.length > 1 && (
                  <button
                    id="btn-add-all-suggested-tags"
                    type="button"
                    onClick={() => onAddAllTags(availableUnaddedTags)}
                    disabled={isAddingAllTags}
                    className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isAddingAllTags ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    <span>Add all suggested tags ({availableUnaddedTags.length})</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 bg-white rounded-xl p-3.5 border border-neutral-200/80 shadow-2xs">
                {reflection.suggestedTags.map((tag) => {
                  const cleanTag = tag.trim().replace(/^#/, '');
                  const isAlreadyAdded = currentTagsLower.has(cleanTag.toLowerCase());
                  const isBeingAdded = addingTag === cleanTag;

                  return (
                    <button
                      key={cleanTag}
                      type="button"
                      onClick={() => !isAlreadyAdded && onAddTag(cleanTag)}
                      disabled={isAlreadyAdded || isBeingAdded}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        isAlreadyAdded
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default opacity-85'
                          : 'bg-neutral-100 text-neutral-800 border border-neutral-200 hover:bg-neutral-200/80 active:scale-95'
                      }`}
                      title={isAlreadyAdded ? `Tag #${cleanTag} already added` : `Add #${cleanTag} to this entry`}
                    >
                      {isAlreadyAdded ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : isBeingAdded ? (
                        <Loader2 className="w-3 h-3 animate-spin text-neutral-600" />
                      ) : (
                        <Plus className="w-3 h-3 text-neutral-500" />
                      )}
                      <span>#{cleanTag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Privacy X-Ray Modal */}
      {showXRay && reflection?.privacyReceipt && (
        <PrivacyXRayModal
          receipt={reflection.privacyReceipt}
          onClose={() => setShowXRay(false)}
        />
      )}
    </div>
  );
}
