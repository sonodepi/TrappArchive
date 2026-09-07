import React, { useState } from 'react';
import { Track } from '../types';
import { Save, Folder, Mic, AlertCircle, Plus, Minus } from 'lucide-react';

export function TrackEditor({ onSave }: { onSave: (t: Track) => void }) {
  const [track, setTrack] = useState<Track>({
    id: crypto.randomUUID(),
    title: '',
    producer: '',
    mainArtist: '',
    featurings: [],
    lyrics: '',
    audioFilePath: '',
    durationMs: 0,
    createdAt: Date.now()
  });

  const [isTranscribing, setIsTranscribing] = useState(false);

  const addFeaturing = () => {
    setTrack(prev => ({ ...prev, featurings: [...prev.featurings, ''] }));
  };

  const removeFeaturing = (index: number) => {
    setTrack(prev => {
      const newFeats = [...prev.featurings];
      newFeats.splice(index, 1);
      return { ...prev, featurings: newFeats };
    });
  };

  const handleFeatChange = (index: number, value: string) => {
    setTrack(prev => {
      const newFeats = [...prev.featurings];
      newFeats[index] = value;
      return { ...prev, featurings: newFeats };
    });
  };

  const handleSave = () => {
    onSave(track);
    setTrack({
      id: crypto.randomUUID(),
      title: '',
      producer: '',
      mainArtist: '',
      featurings: [],
      lyrics: '',
      audioFilePath: '',
      durationMs: 0,
      createdAt: Date.now()
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-32">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-100">Add New Track</h2>
        <p className="text-slate-400 mt-2">Fill in the metadata to add a new song to your catalog.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Core Metadata */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Track Title</label>
              <input 
                type="text" 
                className="w-full bg-black/40 border border-black rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-slate-200 shadow-inner"
                placeholder="e.g. Midnight City"
                value={track.title}
                onChange={e => setTrack({...track, title: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Main Artist</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-black rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-slate-200 shadow-inner"
                  placeholder="e.g. M83"
                  value={track.mainArtist}
                  onChange={e => setTrack({...track, mainArtist: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Producer</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-black rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-slate-200 shadow-inner"
                  placeholder="e.g. Producer Name"
                  value={track.producer}
                  onChange={e => setTrack({...track, producer: e.target.value})}
                />
              </div>
            </div>

            {/* Dynamic Featurings */}
            <div className="p-5 bg-white/[0.02] rounded-xl border border-black shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Featurings</label>
                  <p className="text-xs text-slate-500 mt-1">Manage guest artists</p>
                </div>
                <button 
                  onClick={addFeaturing}
                  className="flex items-center justify-center w-8 h-8 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md transition-colors"
                  title="Add Featuring"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              {track.featurings.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-black/50">
                  {track.featurings.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-500 w-12 shrink-0">Feat {idx + 1}</span>
                      <input 
                        type="text" 
                        className="flex-1 bg-black/40 border border-black rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-slate-200"
                        placeholder={`Artist Name`}
                        value={feat}
                        onChange={e => handleFeatChange(idx, e.target.value)}
                      />
                      <button 
                        onClick={() => removeFeaturing(idx)}
                        className="flex items-center justify-center w-8 h-8 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition-colors shrink-0"
                        title="Remove"
                      >
                        <Minus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Local Audio File</label>
              <div className="flex items-center gap-2">
                <button className="bg-black hover:bg-slate-900 text-slate-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm transition-colors border border-slate-800 shrink-0 shadow-sm">
                  <Folder className="w-4 h-4" />
                  Browse
                </button>
                <input 
                  type="text" 
                  className="flex-1 bg-black/40 border border-black px-4 py-3 rounded-lg text-sm text-slate-400 focus:outline-none focus:border-blue-500 placeholder:text-slate-600 shadow-inner transition-colors"
                  placeholder="/path/to/local/file.wav"
                  value={track.audioFilePath}
                  onChange={e => setTrack({...track, audioFilePath: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Lyrics & Transcription */}
        <div className="space-y-6 flex flex-col h-full">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Lyrics & Text</label>
              
              <button 
                className="group flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium transition-colors border border-blue-500/20"
                onClick={() => setIsTranscribing(!isTranscribing)}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>AI Auto-Transcribe</span>
              </button>
            </div>
            
            {isTranscribing && (
              <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-start gap-3 text-sm text-blue-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
                <p>
                  <strong>Microphone required.</strong> By clicking start, the app will listen to the audio and use the <code className="bg-black/50 px-1 py-0.5 rounded text-blue-300">gemini-3.5-transcribe</code> model to automatically write the lyrics in real-time.
                </p>
              </div>
            )}

            <textarea 
              className="w-full flex-1 bg-black/40 border border-black rounded-xl p-4 focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder:text-slate-600 font-mono text-sm leading-relaxed text-slate-200 shadow-inner custom-scrollbar"
              placeholder="Paste lyrics here or use Auto-Transcribe..."
              value={track.lyrics}
              onChange={e => setTrack({...track, lyrics: e.target.value})}
            />
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(37,99,235,0.3)] border border-blue-400/50"
          >
            <Save className="w-5 h-5" />
            Save Track to Library
          </button>
        </div>

      </div>
    </div>
  );
}
