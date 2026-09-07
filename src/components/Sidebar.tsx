import React from 'react';
import { Music, Disc, Plus, Library, AlignLeft, Download } from 'lucide-react';

export function Sidebar({ 
  activeTab, 
  setActiveTab
}: { 
  activeTab: string, 
  setActiveTab: (t: string) => void
}) {
  return (
    <div className="w-64 bg-[#03060d] border-r border-black flex flex-col h-full shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-10 relative">
      <div className="p-6 mb-2">
        <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2 text-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/50">
            <Disc className="text-white w-5 h-5" />
          </div>
          TrackStudio
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <div className="pb-2">
          <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Workspace</p>
        </div>
        <button 
          onClick={() => setActiveTab('working-on')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'working-on' ? 'bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'}`}
        >
          <AlignLeft size={18} />
          Working On
        </button>

        <div className="pt-6 pb-2">
          <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Collection</p>
        </div>
        <button 
          onClick={() => setActiveTab('library')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'library' ? 'bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'}`}
        >
          <Library size={18} />
          Library
        </button>
        <button 
          onClick={() => setActiveTab('albums')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'albums' ? 'bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'}`}
        >
          <Disc size={18} />
          Albums
        </button>
        
        <div className="pt-6 pb-2">
          <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Management</p>
        </div>
        <button 
          onClick={() => setActiveTab('editor')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'editor' ? 'bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'}`}
        >
          <Plus size={18} />
          Add Track
        </button>
      </nav>

      <div className="p-4 border-t border-black bg-black/20">
        <button 
          onClick={() => setActiveTab('export')}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all text-sm font-medium border ${activeTab === 'export' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50' : 'bg-black hover:bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'}`}
        >
          <Download size={16} />
          Export Data
        </button>
      </div>
    </div>
  );
}
