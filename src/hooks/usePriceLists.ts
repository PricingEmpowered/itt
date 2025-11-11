import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  is_active: boolean;
  effective_date: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export function usePriceLists(autoLoad = true) {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPriceLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('price_lists')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setPriceLists(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price lists');
      console.error('Error loading price lists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadPriceLists();
    }
  }, [autoLoad, loadPriceLists]);

  return { priceLists, loading, error, refetch: loadPriceLists };
}
