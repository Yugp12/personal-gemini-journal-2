import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  X, 
  Cpu, 
  Eye, 
  FileText, 
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import type { PrivacyXRayReceipt } from '../types';

interface PrivacyXRayModalProps {
  receipt: PrivacyXRayReceipt | null;
  onClose: () => void;
}

export function PrivacyXRayModal({ receipt, onClose }: PrivacyXRayModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!receipt) return null;

  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id="modal-privacy-xray" 
      className="fixed inset-0 z-50 bg-neutral-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gemini Context Firewall • Privacy X-Ray</span>
            </div>
            <h3 className="text-xl font-bold text-neutral-950">
              Context Transmission Audit Receipt
            </h3>
            <p className="text-xs text-neutral-500 font-mono">
              Receipt ID: {receipt.id} • {new Date(receipt.timestamp).toLocaleString()}
            </p>
          </div>

          <button
            id="btn-close-privacy-xray"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer transition-colors"
            aria-label="Close Privacy X-Ray"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vault Kernel Isolation Banner */}
        <div className="p-4 rounded-2xl bg-neutral-950 text-white border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>PRIVACY VAULT HARD BOUNDARY: HARD-EXCLUDED</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] font-mono border border-emerald-800">
              0 BYTES SENT
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            The Privacy Vault partition is strictly isolated. Vault records were excluded from this {receipt.operation.toLowerCase().replace('_', ' ')} and never reached the Gemini API server endpoint.
          </p>
        </div>

        {/* Transmission Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
            <span className="block text-[10px] font-semibold uppercase text-neutral-500 font-mono">Operation</span>
            <span className="text-xs font-bold text-neutral-900 truncate block mt-0.5">
              {receipt.operation === 'JOURNAL_REFLECTION' ? 'Reflection' : 'Conversation'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
            <span className="block text-[10px] font-semibold uppercase text-neutral-500 font-mono">Context Size</span>
            <span className="text-xs font-bold text-neutral-900 block mt-0.5">
              {receipt.totalContextChars.toLocaleString()} chars
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
            <span className="block text-[10px] font-semibold uppercase text-neutral-500 font-mono">Est. Tokens</span>
            <span className="text-xs font-bold text-neutral-900 block mt-0.5">
              ~{receipt.totalContextTokensEstimate} tokens
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
            <span className="block text-[10px] font-semibold uppercase text-neutral-500 font-mono">Gemini Model</span>
            <span className="text-xs font-bold text-neutral-900 block mt-0.5 truncate" title={receipt.modelUsed}>
              {receipt.modelUsed}
            </span>
          </div>
        </div>

        {/* Inspected Categories Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center space-x-1.5">
            <Eye className="w-4 h-4 text-neutral-500" />
            <span>Evaluated Data Sources & Permissions</span>
          </h4>

          <div className="space-y-2">
            {receipt.inspectedSources.map((source, index) => {
              const isAllowed = source.status === 'PERMITTED';
              const isHardExcluded = source.status === 'HARD_EXCLUDED_BY_KERNEL';

              return (
                <div 
                  key={index} 
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
                    isHardExcluded
                      ? 'bg-neutral-900 text-white border-neutral-800'
                      : isAllowed 
                        ? 'bg-emerald-50/60 border-emerald-200 text-neutral-900' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    {isHardExcluded ? (
                      <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : isAllowed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold flex items-center space-x-2">
                        <span>{source.category}</span>
                        {source.itemsEvaluated > 0 && (
                          <span className="text-[10px] opacity-75 font-mono">
                            ({source.itemsAllowed} of {source.itemsEvaluated} allowed)
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isHardExcluded ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {source.reason}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold shrink-0 uppercase ${
                    isHardExcluded 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : isAllowed 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {source.status === 'HARD_EXCLUDED_BY_KERNEL' ? 'KERNEL ISOLATED' : source.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sanitization & Privacy Safeguards */}
        {receipt.sanitizationApplied && receipt.sanitizationApplied.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Strict Privacy Sanitization Active</span>
            </div>
            <p className="text-[11px] text-amber-800">
              The following redaction rules were applied prior to transmitting text to Gemini: {receipt.sanitizationApplied.join(', ')}.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleCopyReceipt}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied JSON</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>Copy Audit Receipt</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
