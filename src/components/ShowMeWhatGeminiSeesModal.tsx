import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  X, 
  ArrowRight, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Slash, 
  Sparkles,
  SlidersHorizontal,
  Info,
  Layers,
  FileCode2,
  FileText
} from 'lucide-react';
import type { AIPrivacyPolicy, PrivacyMode } from '../types';
import { inspectAndSanitizeJournal, DEFAULT_AI_PRIVACY_POLICY } from '../lib/firewallEngine';

interface ShowMeWhatGeminiSeesModalProps {
  originalContent: string;
  title?: string;
  mood?: string;
  tags?: string[];
  activePolicy?: AIPrivacyPolicy;
  onClose: () => void;
  onProceedWithReflection?: (customPolicy?: AIPrivacyPolicy) => void;
}

export function ShowMeWhatGeminiSeesModal({
  originalContent,
  title = 'Untitled',
  mood = '😊',
  tags = [],
  activePolicy = DEFAULT_AI_PRIVACY_POLICY,
  onClose,
  onProceedWithReflection
}: ShowMeWhatGeminiSeesModalProps) {
  const [selectedMode, setSelectedMode] = useState<PrivacyMode>(activePolicy.privacyMode || 'STANDARD');
  const [activeTab, setActiveTab] = useState<'comparison' | 'prompt' | 'audit'>('comparison');

  const livePolicy: AIPrivacyPolicy = useMemo(() => ({
    ...activePolicy,
    privacyMode: selectedMode
  }), [activePolicy, selectedMode]);

  const previewResult = useMemo(() => {
    return inspectAndSanitizeJournal(originalContent, title, mood, tags, livePolicy);
  }, [originalContent, title, mood, tags, livePolicy]);

  return (
    <div 
      id="modal-show-what-gemini-sees"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold tracking-tight text-white">
                  Show Me What Gemini Sees
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                  Pre-Flight Privacy Firewall
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Verify sanitization, redactions, and structural boundaries before transmitting context.
              </p>
            </div>
          </div>

          <button
            id="btn-close-gemini-sees-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector & Summary Ribbon */}
        <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Privacy Modes */}
          <div className="flex items-center space-x-1.5 bg-neutral-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedMode('STANDARD')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedMode === 'STANDARD'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('MAXIMUM_PRIVACY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedMode === 'MAXIMUM_PRIVACY'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Maximum Privacy
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('PRIVATE_MODE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedMode === 'PRIVATE_MODE'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Private Mode (Metadata Only)
            </button>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1 text-neutral-600">
              <span>Original:</span>
              <span className="font-semibold text-neutral-900">{previewResult.originalCharCount} chars</span>
            </div>
            <ArrowRight className="w-3 h-3 text-neutral-400" />
            <div className="flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/80">
              <span>To Gemini:</span>
              <span>{previewResult.sanitizedCharCount} chars ({previewResult.reductionPercentage}% reduced)</span>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b border-neutral-200 px-5 pt-2 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'comparison'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Side-by-Side Comparison</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'prompt'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Exact Gemini Payload</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacy Audit ({previewResult.detectedElements.length} Items Evaluated)</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: Side-by-Side Comparison */}
          {activeTab === 'comparison' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              
              {/* Left: Your Original Journal Entry */}
              <div className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-50/60 overflow-hidden">
                <div className="px-3.5 py-2 bg-neutral-100/90 border-b border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-neutral-800">
                    <FileText className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Your Raw Journal Entry</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">Local Browser Device</span>
                </div>
                <div className="p-4 text-xs md:text-sm text-neutral-800 font-sans leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto bg-white">
                  {originalContent || <span className="text-neutral-400 italic">No content</span>}
                </div>
              </div>

              {/* Right: Sanitized Gemini Context */}
              <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/20 overflow-hidden">
                <div className="px-3.5 py-2 bg-emerald-100/70 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sanitized Context Sent to Gemini</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 font-semibold">
                    {selectedMode === 'PRIVATE_MODE' ? '🛡️ Private Mode' : '✓ Scrubbed Context'}
                  </span>
                </div>
                <div className="p-4 text-xs md:text-sm text-neutral-900 font-sans leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto bg-white/90">
                  {previewResult.sanitizedText}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Exact Gemini Payload */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  This is the exact structured prompt envelope passed to Gemini. Untrusted user writing is quarantined inside structural XML tags (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">&lt;untrusted_journal_entry&gt;</code>) to prevent prompt injection.
                </p>
              </div>
              <pre className="p-4 bg-neutral-900 text-neutral-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-neutral-800 max-h-96">
                {previewResult.exactGeminiPrompt}
              </pre>
            </div>
          )}

          {/* TAB 3: Privacy Audit */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider block font-medium">Evaluated</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">{previewResult.detectedElements.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-700 uppercase tracking-wider block font-medium">Redacted</span>
                  <span className="text-lg font-bold font-mono text-amber-800">{previewResult.counts.redacted}</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-[11px] text-rose-700 uppercase tracking-wider block font-medium">Blocked</span>
                  <span className="text-lg font-bold font-mono text-rose-800">{previewResult.counts.blocked}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-700 uppercase tracking-wider block font-medium">Vault Isolated</span>
                  <span className="text-lg font-bold font-mono text-emerald-800">100% Air-Gapped</span>
                </div>
              </div>

              {previewResult.detectedElements.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="font-semibold text-neutral-800">Clean Context</p>
                  <p>No high-risk secrets, credentials, or PII tokens detected in this entry.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {previewResult.detectedElements.map((elem) => (
                    <div 
                      key={elem.id}
                      className="p-3 bg-white border border-neutral-200 rounded-xl flex items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            elem.classification === 'BLOCKED' 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : elem.classification === 'REDACTED'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}>
                            {elem.classification}
                          </span>
                          <span className="text-xs font-semibold text-neutral-800">{elem.category}</span>
                        </div>
                        <p className="text-xs text-neutral-600">{elem.reason}</p>
                        <div className="flex items-center space-x-2 text-[11px] font-mono pt-1">
                          <span className="text-neutral-500">Pattern: <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-700">{elem.originalSnippet}</code></span>
                          <span>→</span>
                          <span className="text-emerald-700 font-semibold"><code className="bg-emerald-50 px-1 py-0.5 rounded text-emerald-800">{elem.sanitizedSnippet}</code></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-neutral-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Vault air-gapped (0 bytes sent). Zero-trust kernel enforced.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-300 rounded-xl transition-all cursor-pointer shadow-2xs hover:bg-neutral-100"
            >
              Cancel
            </button>
            {onProceedWithReflection && (
              <button
                type="button"
                onClick={() => {
                  onProceedWithReflection(livePolicy);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Reflect with Sanitized Context</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
