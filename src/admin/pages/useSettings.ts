/** Loads the dashboard's settings and saves changes (Settings and Alerts pages). */
import { useCallback, useEffect, useState } from 'react';
import { api, type SettingsView, type SiteSettings } from '../api';

export function useSettings() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings().then(
      (v) => {
        setView(v);
        setDraft(v.settings);
      },
      (err) => setError(String(err?.message || err))
    );
  }, []);

  const dirty = Boolean(view && draft && JSON.stringify(view.settings) !== JSON.stringify(draft));

  /** Saves `patch` (or the whole draft) and takes the settings the server now has. */
  const save = useCallback(
    async (patch?: Partial<SiteSettings>) => {
      const body = patch || draft;
      if (!body) return false;
      setSaving(true);
      setError('');
      try {
        const next = await api.saveSettings(body);
        setView(next);
        setDraft(next.settings);
        return true;
      } catch (err) {
        setError(String((err as Error)?.message || err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draft]
  );

  const reset = useCallback(() => view && setDraft(view.settings), [view]);

  return { view, draft, setDraft, dirty, save, saving, error, reset };
}
