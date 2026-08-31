import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  RotateCcw, 
  X, 
  Check, 
  Sparkles, 
  FileText, 
  Brain, 
  MessageSquare, 
  Eye,
  Sliders,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import type { ContextFirewallPolicy, PrivacyXRayReceipt, AIPrivacyPolicy, PrivacyMode, ContextReceipt } from '../types';
import { 
  getFirewallPolicy, 
  saveFirewallPolicy, 
  resetFirewallPolicy, 
  getPrivacyReceipts,
  getActivePrivacyPolicy,
  saveUserPrivacyPolicy,
  getUserContextReceipts
} from '../lib/firewallService';
import { useAuth } from '../lib/AuthContext';

interface ContextFirewallModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onOpenReceipt?: (receipt: PrivacyXRayReceipt) => void;
}

const MEMORY_CATEGORIES = [
  'Preference',
  'Goal',
  'Project',
  'Personal Context',
  'Habit',
  'Other'
];

export function ContextFirewallModal({ isOpen = true, onClose, onOpenReceipt }: ContextFirewallModalProps) {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<ContextFirewallPolicy>(getFirewallPolicy());
  const [aiPolicy, setAiPolicy] = useState<AIPrivacyPolicy>(getActivePrivacyPolicy());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState<ContextReceipt[]>([]);
  const [activeTab, setActiveTab] = useState<'policy' | 'categories' | 'receipts'>('policy');

  useEffect(() => {
    if (isOpen) {
      const activeFw = getFirewallPolicy();
      const activeAi = getActivePrivacyPolicy();
      setPolicy(activeFw);
      setAiPolicy(activeAi);
      setSavedSuccess(false);

      getUserContextReceipts(user?.uid).then(receipts => {
        setRecentReceipts(receipts);
      });
    }
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  const handleSave = async () => {
    saveUserPrivacyPolicy(user?.uid || '', aiPolicy);
    saveFirewallPolicy({ ...policy, aiPrivacyPolicy: aiPolicy }, user?.uid);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const handleReset = () => {
    const resetFw = resetFirewallPolicy(user?.uid);
    const resetAi = getActivePrivacyPolicy();
    setPolicy(resetFw);
    setAiPolicy(resetAi);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1000);
  };

  const setPrivacyMode = (mode: PrivacyMode) => {
    setAiPolicy(prev => ({ ...prev, privacyMode: mode }));
  };

  return (
    <div 
      id="modal-context-firewall" 
      className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-3xl w-full p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gemini Privacy Firewall</span>
            </div>
            <h3 className="text-xl font-bold text-neutral-950">
              My AI Privacy Policy & Context Firewall
            </h3>
            <p className="text-xs text-neutral-500">
              "You control the context. Gemini doesn't." Govern exactly what data leaves your device.
            </p>
          </div>

          <button
            id="btn-close-context-firewall"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer transition-colors"
            aria-label="Close Context Firewall"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-neutral-100 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('policy')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'policy' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Privacy Modes & Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'categories' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Category Rules
          </button>
          <button
            type="button"
            onClick={() => {
              getUserContextReceipts(user?.uid).then(setRecentReceipts);
              setActiveTab('receipts');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'receipts' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Context Receipts ({recentReceipts.length})</span>
          </button>
        </div>

        {/* TAB 1: Privacy Modes */}
        {activeTab === 'policy' && (
          <div className="space-y-4">
            
            {/* HARD BOUNDARY TILE: Privacy Vault */}
            <div className="p-4 rounded-2xl bg-neutral-950 text-white border border-neutral-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>HARD ARCHITECTURAL BOUNDARY: PRIVACY VAULT</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  The Privacy Vault is permanently excluded by the security kernel. Zero bytes are ever transmitted to Gemini under any circumstance.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-800 shrink-0">
                100% AIR-GAPPED
              </span>
            </div>

            {/* Privacy Mode Tri-State Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider block">
                Active AI Privacy Mode
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Standard */}
                <div 
                  onClick={() => setPrivacyMode('STANDARD')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiPolicy.privacyMode === 'STANDARD'
                      ? 'border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900/10'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-neutral-900">Standard Mode</span>
                    {aiPolicy.privacyMode === 'STANDARD' && <Check className="w-4 h-4 text-neutral-900" />}
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Zero-trust blocking of passwords, API keys, and secrets. Full journal context with prompt injection isolation.
                  </p>
                </div>

                {/* Maximum Privacy */}
                <div 
                  onClick={() => setPrivacyMode('MAXIMUM_PRIVACY')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiPolicy.privacyMode === 'MAXIMUM_PRIVACY'
                      ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-900">Maximum Privacy</span>
                    {aiPolicy.privacyMode === 'MAXIMUM_PRIVACY' && <Check className="w-4 h-4 text-amber-700" />}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Aggressive scrubbing: auto-redacts person names, emails, phone numbers, and locations.
                  </p>
                </div>

                {/* Private Mode */}
                <div 
                  onClick={() => setPrivacyMode('PRIVATE_MODE')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiPolicy.privacyMode === 'PRIVATE_MODE'
                      ? 'border-purple-700 bg-purple-50/50 ring-2 ring-purple-700/20'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-purple-900">Private Mode</span>
                    {aiPolicy.privacyMode === 'PRIVATE_MODE' && <Check className="w-4 h-4 text-purple-700" />}
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Raw journal body is NEVER sent to Gemini. Mindful reflections are generated purely from structured mood & theme metadata.
                  </p>
                </div>

              </div>
            </div>

            {/* Conversation & Memory Context Gate */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Brain className="w-4 h-4 text-purple-700" />
                  <h4 className="text-xs font-bold text-neutral-900">Long-Term Memory & Conversation Context</h4>
                </div>
                <label className="flex items-center space-x-2 text-xs text-neutral-800 cursor-pointer">
                  <span className="text-[11px] font-medium text-neutral-500">Inject Memories</span>
                  <input
                    type="checkbox"
                    checked={policy.allowMemories}
                    onChange={(e) => setPolicy({ ...policy, allowMemories: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200/80 text-xs">
                <span className="text-neutral-700">Multi-Turn History Window:</span>
                <span className="font-mono font-bold text-neutral-900">{policy.maxHistoryTurns} turns max</span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: Category Rules */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            
            {/* Always Blocked */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Always Block (Zero-Trust Hardcoded)
                </h4>
              </div>
              <p className="text-[11px] text-rose-800">
                These categories are blocked by default and cannot be transmitted:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  🔒 Passwords & Credentials
                </div>
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  🔑 API Keys & Secrets
                </div>
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  💳 Financial & Tax IDs
                </div>
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  🛡️ Privacy Vault Content
                </div>
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  🌐 Embedded Auth URLs
                </div>
                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-950 font-medium">
                  ⚡ Prompt Injection Tokens
                </div>
              </div>
            </div>

            {/* User Configurable Ask / Redact Rules */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-amber-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  PII & Sensitivity Rules
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                  <span>Person Names</span>
                  <select
                    value={aiPolicy.askOrRedact.personNames}
                    onChange={(e) => setAiPolicy({
                      ...aiPolicy,
                      askOrRedact: { ...aiPolicy.askOrRedact, personNames: e.target.value as any }
                    })}
                    className="px-2 py-1 bg-neutral-100 rounded-lg text-xs font-semibold cursor-pointer border border-neutral-300"
                  >
                    <option value="REDACT">Redact (Scrub)</option>
                    <option value="ALLOW">Allow</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                  <span>Locations</span>
                  <select
                    value={aiPolicy.askOrRedact.locations}
                    onChange={(e) => setAiPolicy({
                      ...aiPolicy,
                      askOrRedact: { ...aiPolicy.askOrRedact, locations: e.target.value as any }
                    })}
                    className="px-2 py-1 bg-neutral-100 rounded-lg text-xs font-semibold cursor-pointer border border-neutral-300"
                  >
                    <option value="REDACT">Redact</option>
                    <option value="ALLOW">Allow</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: Recent Context Receipts */}
        {activeTab === 'receipts' && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {recentReceipts.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-500">
                No Gemini context receipts recorded yet. Run a journal reflection to verify the Privacy Firewall in action.
              </div>
            ) : (
              recentReceipts.map((r) => (
                <div 
                  key={r.id}
                  className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2 hover:bg-neutral-100/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-neutral-900">
                        {r.operation === 'JOURNAL_REFLECTION' ? 'Journal Reflection' : 'Conversation Turn'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold">
                        {r.policyMode || 'STANDARD'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 text-[10px] font-mono">
                        Vault 0%
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-600 font-mono">
                    <span>{r.originalCharCount} original chars → {r.geminiCharCount} sent ({r.reductionPercentage}% reduced)</span>
                    <span className="text-emerald-700 font-semibold">{r.decision}</span>
                  </div>

                  {r.sanitizationRulesApplied && r.sanitizationRulesApplied.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.sanitizationRulesApplied.map((rule, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-neutral-200/80 text-neutral-700 rounded text-[9px] font-mono">
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-context-firewall"
              type="button"
              onClick={handleSave}
              className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Privacy Policy</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
