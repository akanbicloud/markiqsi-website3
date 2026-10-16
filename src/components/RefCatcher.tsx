'use client';

import { useEffect } from 'react';

/** Remembers a referral code from a shared link (?ref=CODE) so it is ready at enrolment. */
export function RefCatcher() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && /^[A-Za-z0-9_-]{3,24}$/.test(ref)) localStorage.setItem('mq_ref', ref.toUpperCase());
    } catch {}
  }, []);
  return null;
}
