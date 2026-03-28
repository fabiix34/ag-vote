import { useMemo } from 'react';

export const useDomain = () => {
  const hostname = window.location.hostname;

  return useMemo(() => {
    const isSyndic = hostname.includes('syndic');
    const isCopro = hostname.includes('copro');
    
    // On définit un "type" par défaut si aucun sous-domaine ne match
    let type = 'guest'; 
    if (isSyndic) type = 'syndic';
    if (isCopro) type = 'copro';

    return {
      type,
      isSyndic,
      isCopro,
      hostname
    };
  }, [hostname]);
};