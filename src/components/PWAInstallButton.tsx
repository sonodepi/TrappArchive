import React, { useState } from 'react';
import { Download, CheckCircle2, Share2, PlusSquare, Monitor, Smartphone, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
  variant = 'primary',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed in standalone mode
  if (isInstalled) {
    if (compact) {
      return (
        <div
          title="App installata sul dispositivo"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        >
          <CheckCircle2 size={16} />
        </div>
      );
    }

    if (variant === 'sidebar') {
      return (
        <div className="w-full px-3 py-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
          <div className="truncate">
            <span className="font-semibold block truncate text-slate-200">App Installata</span>
            <span className="text-[10px] text-emerald-400/80 block truncate">100% Offline & Locale</span>
          </div>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
        <CheckCircle2 size={15} />
        <span>Applicazione già installata sul dispositivo</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  // Render trigger button depending on variant
  const renderButton = () => {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          id="sidebar-pwa-install-btn"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`w-full px-3 py-2.5 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/30 hover:border-blue-400/50 rounded-xl text-xs text-left transition-all active:scale-98 flex items-center justify-between group shadow-sm min-h-[44px] ${className}`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:text-white transition-colors shrink-0">
              <Download size={14} className={isInstalling ? 'animate-bounce' : ''} />
            </div>
            <div className="truncate">
              <span className="font-semibold block text-slate-100 group-hover:text-blue-300 transition-colors">
                Scarica / Installa App
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Disponibile per PC, Mac & Mobile
              </span>
            </div>
          </div>
          <Sparkles size={13} className="text-blue-400/70 group-hover:text-blue-300 shrink-0" />
        </button>
      );
    }

    if (compact) {
      return (
        <button
          type="button"
          id="compact-pwa-install-btn"
          onClick={handleInstallClick}
          title="Scarica / Installa TrappArchive come App"
          className={`p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 shadow-md flex items-center justify-center min-h-[36px] min-w-[36px] ${className}`}
        >
          <Download size={16} />
        </button>
      );
    }

    return (
      <button
        type="button"
        id="main-pwa-install-btn"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-98 transition-all border border-blue-400/30 min-h-[44px] ${className}`}
      >
        <Download size={16} className={isInstalling ? 'animate-bounce' : ''} />
        <span>{isInstalling ? 'Installazione in corso...' : 'Scarica & Installa App'}</span>
      </button>
    );
  };

  return (
    <>
      {renderButton()}

      {/* Guided Installation Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            id="pwa-install-guide-modal"
            className="w-full max-w-md rounded-2xl bg-[#090f20] border border-slate-800 p-6 shadow-2xl text-slate-200 relative"
          >
            {/* Close button */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Installa TrappArchive</h3>
                <p className="text-xs text-slate-400">Utilizzabile come app nativa desktop e mobile</p>
              </div>
            </div>

            {/* Instruction Tabs / Body */}
            <div className="space-y-4 text-xs">
              {isIOS ? (
                /* iOS Instructions */
                <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-blue-300">
                    <Smartphone size={16} />
                    <span>Installazione su iPhone / iPad:</span>
                  </div>
                  <ol className="space-y-2.5 text-slate-300 pl-1 list-decimal list-inside leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">1.</span>
                      <span>
                        Tocca il pulsante <strong className="text-white">Condividi</strong>{' '}
                        <Share2 size={13} className="inline mx-0.5 text-blue-400" /> nella barra del browser Safari.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">2.</span>
                      <span>
                        Scorri l'elenco verso il basso e tocca{' '}
                        <strong className="text-white">Aggiungi alla schermata Home</strong>{' '}
                        <PlusSquare size={13} className="inline mx-0.5 text-blue-400" />.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">3.</span>
                      <span>
                        Conferma toccando <strong className="text-white">Aggiungi</strong> in alto a destra.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                /* Desktop / Android Instructions */
                <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-blue-300">
                    <Monitor size={16} />
                    <span>Installazione su PC / Mac / Chrome / Edge:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Puoi installare TrappArchive come applicazione desktop autonoma senza barre di navigazione del browser:
                  </p>
                  <ul className="space-y-2 text-slate-300 pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>
                        <strong>Icona barra indirizzi:</strong> Clicca sull'icona <strong>"Installa app"</strong>{' '}
                        <Download size={13} className="inline mx-0.5 text-blue-400" /> situata a destra nella barra degli indirizzi di Chrome o Edge.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>
                        <strong>Menu del browser:</strong> Apri il menu con i 3 puntini (⋮) &gt; seleziona <strong>"Installa TrappArchive"</strong> o <strong>"Salva e condividi" &gt; "Installa pagina come app"</strong>.
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Benefits badge */}
              <div className="p-3 bg-blue-950/30 border border-blue-800/30 rounded-xl text-slate-300 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Vantaggi dell'installazione:
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Avvio istantaneo dalla scrivania o schermata home, funzionamento 100% offline, archiviazione locale e zero pubblicità o dipendenze esterne.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
