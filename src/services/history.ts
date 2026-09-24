/**
 * Saved prompts of the signed-in account, on the server (/api/history), so they follow the
 * account to every device. Visitors who are not signed in keep theirs in localStorage instead.
 */
import { SavedPromptItem } from '../types';

export async function fetchHistory(): Promise<SavedPromptItem[] | null> {
  try {
    const res = await fetch('/api/history', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return null;
  }
}

/** Adds or replaces items. Resolves to false when the server did not take them. */
export async function saveHistory(items: SavedPromptItem[]): Promise<boolean> {
  if (!items.length) return true;
  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Deletes one item, or everything when id is omitted. */
export async function deleteHistory(id?: string): Promise<void> {
  try {
    await fetch(id ? `/api/history?id=${encodeURIComponent(id)}` : '/api/history?all=1', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  } catch (err) {
    console.warn('Could not delete from history:', err);
  }
}
