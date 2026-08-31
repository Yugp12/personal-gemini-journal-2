import React, { useState } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Brain, 
  Lock, 
  ShieldCheck, 
  LogOut, 
  PlusCircle, 
  User as UserIcon,
  Sparkles,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getFirewallPolicy } from '../lib/firewallService';
import { ContextFirewallModal } from './ContextFirewallModal';

export type NavTab = 'journal' | 'conversations' | 'memory' | 'vault' | 'security';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onNewEntry: () => void;
  entryCount: number;
}

export function Navigation({
  activeTab,
  setActiveTab,
  onNewEntry,
  entryCount
}: NavigationProps) {
  const { user, signOut } = useAuth();
  const [showFirewallModal, setShowFirewallModal] = useState(false);
  const firewallPolicy = getFirewallPolicy();

  const navItems = [
    { id: 'journal' as NavTab, label: 'Journal', icon: BookOpen, count: entryCount },
    { id: 'conversations' as NavTab, label: 'Conversations', icon: MessageSquare },
    { id: 'memory' as NavTab, label: 'Memory', icon: Brain },
    { id: 'vault' as NavTab, label: 'Privacy Vault', icon: Lock },
    { id: 'security' as NavTab, label: 'Security', icon: ShieldCheck }
  ];

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('journal')}>
            <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-neutral-950 block leading-tight">
                Personal Gemini Journal
              </span>
              <span className="text-[10px] font-mono text-emerald-600 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Zero-Trust Architecture</span>
              </span>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-950 font-semibold shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 text-neutral-700 font-mono">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action: User Avatar & Sign Out */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-2.5 pl-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
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
                    {user.displayName || 'Journalist'}
                  </p>
                  <p className="text-[10px] font-mono text-neutral-400 truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>
              </div>
            )}

            {/* Firewall Quick Status */}
            <button
              type="button"
              id="btn-nav-firewall"
              onClick={() => setShowFirewallModal(true)}
              title="Gemini Context Firewall"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline font-semibold">Firewall</span>
            </button>

            <button
              id="btn-nav-signout"
              onClick={signOut}
              title="Sign Out"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Tabs Bar */}
        <div className="md:hidden flex items-center justify-between py-2 border-t border-neutral-100 overflow-x-auto space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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

      {showFirewallModal && (
        <ContextFirewallModal onClose={() => setShowFirewallModal(false)} />
      )}
    </header>
  );
}
