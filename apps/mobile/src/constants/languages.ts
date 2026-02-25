import type { LanguageCode } from '../types/database';

export const DEFAULT_LANGUAGE: LanguageCode = 'my-MM';
export const FALLBACK_LANGUAGE: LanguageCode = 'en-US';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: 'my-MM', label: 'Burmese', nativeLabel: 'မြန်မာ' },
  { code: 'en-US', label: 'English', nativeLabel: 'English' },
];
