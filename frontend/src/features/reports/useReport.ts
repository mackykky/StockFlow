import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";

export function useReport<T>(endpoint: string | null, revision: number) {
  const { request } = useApi();
  const [result, setResult] = useState<{ endpoint: string; revision: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    request<T>(endpoint, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ endpoint, revision, data }); })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setResult({ endpoint, revision, error: err instanceof Error ? err.message : "Unable to load report." });
      });
    return () => controller.abort();
  }, [endpoint, revision, request]);
  return result?.endpoint === endpoint && result?.revision === revision ? result : undefined;
}
