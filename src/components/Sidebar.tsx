import React, { useState } from 'react';
import { Disc, Plus, Library, AlignLeft, Download, ChevronRight, ChevronLeft, HardDrive } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export interface NavTabItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const NAV_ITEMS: NavTabItem[] = [
  { id: 'working-on', label: 'Bozze & Cowork', shortLabel: 'Bozze', icon: AlignLeft },
  { id: 'library', label: 'Libreria Tracce', shortLabel: 'Libreria', icon: Library },
  { id: 'editor', label: 'Aggiungi Traccia', shortLabel: 'Nuovo', icon: Plus },
  { id: 'albums', label: 'Album & Raccolte', shortLabel: 'Album', icon: Disc },
  { id: 'export', label: 'Esporta & Backup', shortLabel: 'Backup', icon: Download },
];

export function Sidebar({ 
  activeTab, 
  setActiveTab,
}: { 
  activeTab: string; 
  setActiveTab: (t: string) => void;
}) {
  // Tablet collapse state (defaults to collapsed w-16 on tablet 768-1023px, w-64 on desktop >=1024px)
  const [isTabletExpanded, setIsTabletExpanded] = useState(false);

  return (
    <aside 
      id="desktop-sidebar"
      className={`hidden md:flex flex-col h-full shrink-0 bg-[#03060d] border-r border-slate-900/80 transition-all duration-300 ease-in-out z-20 relative select-none shadow-[4px_0_24px_rgba(0,0,0,0.5)] ${
        isTabletExpanded ? 'md:w-64 lg:w-64' : 'md:w-16 lg:w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 lg:p-6 mb-2 flex items-center justify-between border-b border-slate-900/50">
        <div 
          onClick={() => setIsTabletExpanded(!isTabletExpanded)}
          className="flex items-center gap-3 cursor-pointer group w-full"
          title="Toggle Sidebar"
        >
          <div className="w-9 h-9 min-w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/50 group-hover:scale-105 transition-transform shrink-0">
            <Disc className="text-white w-5 h-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${
            isTabletExpanded ? 'block' : 'hidden lg:block'
          }`}>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
              TrappArchive
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Audio Vault</p>
          </div>
        </div>

        {/* Tablet expand button */}
        <button
          onClick={() => setIsTabletExpanded(!isTabletExpanded)}
          className="hidden md:flex lg:hidden p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded-lg transition-colors min-h-[36px] min-w-[36px] items-center justify-center"
          title={isTabletExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          {isTabletExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      
      {/* Navigation Items */}
      <nav className="flex-1 px-2.5 lg:px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all min-h-[44px] ${
                isTabletExpanded ? 'justify-start' : 'justify-center lg:justify-start'
              } ${
                isActive 
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/40 shadow-[inset_0_0_12px_rgba(37,99,235,0.15)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span className={`text-sm truncate transition-opacity ${
                isTabletExpanded ? 'block' : 'hidden lg:block'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer: PWA App Installation & Local Storage Status */}
      <div className="p-3 lg:p-4 border-t border-slate-900/80 bg-black/40 shrink-0 space-y-2">
        {isTabletExpanded || true ? (
          <div className="hidden lg:block space-y-2">
            <PWAInstallButton variant="sidebar" />
            <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
              <HardDrive size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">Archivio 100% locale & offline</span>
            </div>
          </div>
        ) : null}

        {/* Compact version for collapsed tablet */}
        <div className="lg:hidden flex justify-center">
          <PWAInstallButton compact />
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile Bottom Navigation Bar (< 768px)
 * Height 64px (h-16), 5 buttons with 1-word label (Bozze, Libreria, Nuovo, Album, Export)
 * Active button blue, others gray. Fixed at bottom.
 */
export function BottomNav({
  activeTab,
  setActiveTab
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  return (
    <nav 
      id="mobile-bottom-navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#03060d]/95 backdrop-blur-xl border-t border-slate-900/90 px-2 flex items-center justify-around z-30 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.7)]"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-all relative min-h-[44px] ${
              isActive 
                ? 'text-blue-400 font-semibold' 
                : 'text-slate-400 hover:text-slate-200 active:text-slate-100'
            }`}
          >
            {/* Active Top Bar Indicator */}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.9)]" />
            )}
            <Icon 
              size={20} 
              className={isActive ? 'text-blue-400 scale-110 transition-transform' : 'text-slate-400'} 
            />
            <span className={`text-[11px] tracking-tight leading-none whitespace-nowrap ${isActive ? 'font-bold text-blue-400' : 'text-slate-400'}`}>
              {item.shortLabel}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
