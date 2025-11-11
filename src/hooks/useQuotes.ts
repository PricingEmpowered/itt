import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Quote } from '../types';

export function useQuotes(autoLoad = true) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name, email),
          quote_lines(
            id,
            product_id,
            product_name,
            quantity,
            list_price,
            discount_percent,
            unit_price,
            total_price
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setQuotes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotes');
      console.error('Error loading quotes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadQuotes();
    }
  }, [autoLoad, loadQuotes]);

  return { quotes, loading, error, refetch: loadQuotes };
}
