import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { downloadPVDocx } from './PVDocx';

export function PVGenerator({ resolutions, votes, coproprietaires }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'

  const handleGenerate = async () => {
    setStatus('loading');
    try {
      await downloadPVDocx({ resolutions, votes, coproprietaires });
      setStatus('idle');
    } catch (err) {
      console.error('Erreur génération PV :', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={status === 'loading'}
      title="Générer le procès-verbal en Word (.docx)"
      className="flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {status === 'loading' ? (
        <><Loader2 size={14} className="animate-spin" /> Génération...</>
      ) : status === 'error' ? (
        <><FileText size={14} className="text-red-500" /> Erreur</>
      ) : (
        <><FileText size={14} /> Générer PV</>
      )}
    </button>
  );
}
