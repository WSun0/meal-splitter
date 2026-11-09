'use client';

import { useEffect, useState } from 'react';
import SharedSplitView, { SharedSplitError } from '@/components/share/SharedSplitView';
import { decodeFragment, decodeLegacyShareData, SharedSplit } from '@/lib/utils/share';

/*
 * Self-contained share links.
 *   /split#<payload>     current fallback format (used when short links are unavailable)
 *   /split?data=<base64> legacy v1 links, still supported
 */

type State = { status: 'loading' } | { status: 'ok'; split: SharedSplit } | { status: 'error' };

export default function SharedSplitPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = window.location.hash.slice(1);
      const legacy = new URLSearchParams(window.location.search).get('data');
      let split: SharedSplit | null = null;
      if (hash) split = await decodeFragment(hash);
      else if (legacy) split = decodeLegacyShareData(legacy);
      if (!cancelled) setState(split ? { status: 'ok', split } : { status: 'error' });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-folder-line border-t-secondary-400 animate-spin mx-auto mb-4" />
          <p className="text-folder-muted">Loading split…</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <SharedSplitError
        title="Could Not Load Split"
        message="This share link appears to be invalid. Please ask for a new link."
      />
    );
  }

  return <SharedSplitView split={state.split} />;
}
