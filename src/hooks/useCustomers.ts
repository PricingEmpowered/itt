import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';

export function useCustomers(autoLoad = true) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadCustomers();
    }
  }, [autoLoad, loadCustomers]);

  return { customers, loading, error, refetch: loadCustomers };
}
