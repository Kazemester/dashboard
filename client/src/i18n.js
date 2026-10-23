import { useSyncExternalStore } from 'react';
import core from './i18n/en.core.js';
import widgetsA from './i18n/en.widgets-a.js';
import widgetsB from './i18n/en.widgets-b.js';
import catalog from './i18n/en.catalog.js';
import worldMap from './i18n/en.map.js';

/*
 * UI language (hu | en). The source language of every string is Hungarian: `t('Mentés')` returns the
 * English text from the dictionaries in ./i18n when English is selected, and the Hungarian text otherwise
 * (so a missing translation never breaks anything). Placeholders: t('{n} perc', { n: 5 }).
 */
const EN = { ...core, ...widgetsA, ...widgetsB, ...catalog, ...worldMap };
const KEY = 'nexus-lang';
const listeners = new Set();

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    /* no storage: default below */
  }
  return 'hu';
}

let lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(next) {
  if (next !== 'hu' && next !== 'en') return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function t(hu, vars) {
  if (hu == null || hu === '') return hu;
  let out = lang === 'en' ? EN[hu] ?? hu : hu;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}

/** Subscribes the component to language changes (App remounts on a change, so most code just calls t()). */
export function useLang() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => lang
  );
}

/** Day / month names in the current language. */
export const locale = () => (lang === 'en' ? 'en-GB' : 'hu-HU');
