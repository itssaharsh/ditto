import { useEffect, useState } from 'react';
import { fetchCase, type CaseFile } from './data';

const FINAL = ['parity', 'stopped', 'failed'];

/** Loads a case file; keeps polling while a run is still writing it. */
export function useCase(id: string): { data?: CaseFile; error?: string } {
  const [data, setData] = useState<CaseFile>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const c = await fetchCase(id);
        if (stop) return;
        setData(c);
        setError(undefined);
        if (!FINAL.includes(c.status)) timer = window.setTimeout(load, 2500);
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : String(e));
        timer = window.setTimeout(load, 5000);
      }
    };
    load();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  return { data, error };
}

export function useParam(name: string): [string | undefined, (v: string | undefined) => void] {
  const read = () => new URLSearchParams(window.location.search).get(name) ?? undefined;
  const [value, setValue] = useState<string | undefined>(read);
  useEffect(() => {
    const on = () => setValue(read());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  });
  const set = (v: string | undefined) => {
    const p = new URLSearchParams(window.location.search);
    if (v) p.set(name, v);
    else p.delete(name);
    window.history.pushState(null, '', `${window.location.pathname}?${p.toString()}${window.location.hash}`);
    setValue(v);
  };
  return [value, set];
}
