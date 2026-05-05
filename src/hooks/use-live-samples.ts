import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeSamples,
  samples as seedSamples,
  type Sample,
} from "@/lib/dashboard-data";

type State = {
  samples: Sample[];
  loading: boolean;
  error: string | null;
  fetchedAt: Date | null;
  isLive: boolean;
};

export function useLiveSamples() {
  const [state, setState] = useState<State>({
    samples: seedSamples,
    loading: true,
    error: null,
    fetchedAt: null,
    isLive: false,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke("fetch-sheet");
      if (error) throw error;
      const samples = normalizeSamples((data?.samples ?? []) as Sample[]);
      setState({
        samples: samples.length > 0 ? samples : seedSamples,
        loading: false,
        error: null,
        fetchedAt: data?.fetchedAt ? new Date(data.fetchedAt) : new Date(),
        isLive: samples.length > 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch live data";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}