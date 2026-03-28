import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '../App';
import { PVDocument } from './PVDocument';

async function fetchDocuments(resolutionIds) {
  if (resolutionIds.length === 0) return {};

  const { data } = await supabase
    .from('documents')
    .select('*')
    .in('resolution_id', resolutionIds)
    .order('created_at');

  if (!data?.length) return {};

  const { data: signed } = await supabase.storage
    .from('resolution-docs')
    .createSignedUrls(data.map(d => d.path), 3600);

  const withUrls = data.map((doc, i) => ({
    ...doc,
    signedUrl: signed?.[i]?.signedUrl ?? null,
  }));

  return withUrls.reduce((acc, doc) => {
    if (!acc[doc.resolution_id]) acc[doc.resolution_id] = [];
    acc[doc.resolution_id].push(doc);
    return acc;
  }, {});
}

async function mergeWithPdfAnnexes(mainBlob, documents) {
  const pdfAnnexes = Object.values(documents)
    .flat()
    .filter(doc => doc.signedUrl && doc.nom?.toLowerCase().endsWith('.pdf'));

  if (pdfAnnexes.length === 0) return mainBlob;

  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.load(await mainBlob.arrayBuffer());

  for (const doc of pdfAnnexes) {
    try {
      const res = await fetch(doc.signedUrl);
      if (!res.ok) continue;
      const annexe = await PDFDocument.load(await res.arrayBuffer());
      const pages = await merged.copyPages(annexe, annexe.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    } catch (err) {
      console.warn(`Annexe ignorée : "${doc.nom}"`, err);
    }
  }

  return new Blob([await merged.save()], { type: 'application/pdf' });
}

export function PVGenerator({ resolutions, votes, coproprietaires }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'

  const handleGenerate = async () => {
    setStatus('loading');
    try {
      const documents = await fetchDocuments(resolutions.map(r => r.id));

      const mainBlob = await pdf(
        <PVDocument
          resolutions={resolutions}
          votes={votes}
          coproprietaires={coproprietaires}
          documents={documents}
        />
      ).toBlob();

      const finalBlob = await mergeWithPdfAnnexes(mainBlob, documents);

      const url = URL.createObjectURL(finalBlob);
      window.open(url, '_blank');
      // Libère la mémoire après 60s
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

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
      title="Générer le procès-verbal en PDF"
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
