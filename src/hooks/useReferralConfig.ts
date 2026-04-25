import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'referral_code_setting';
const DEFAULT_REFERRAL = 'PAPER202214';

const sanitize = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

export function useReferralConfig() {
  const [referralCode, setReferralCodeState] = useState<string>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && v.trim() ? sanitize(v) : DEFAULT_REFERRAL;
    } catch {
      return DEFAULT_REFERRAL;
    }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setReferralCodeState(sanitize(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setReferralCode = useCallback((value: string) => {
    const cleaned = sanitize(value);
    if (!cleaned) return;
    localStorage.setItem(STORAGE_KEY, cleaned);
    setReferralCodeState(cleaned);
  }, []);

  const resetReferralCode = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, DEFAULT_REFERRAL);
    setReferralCodeState(DEFAULT_REFERRAL);
  }, []);

  return { referralCode, setReferralCode, resetReferralCode, defaultReferralCode: DEFAULT_REFERRAL };
}
