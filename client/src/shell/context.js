import { createContext, useContext } from 'react';

/*
 * Shell state the tiles need: the user's categories (right-hand rail) and how to put a tile into them.
 * { categories, active, setTileCategories(widgetId, ids), createCategory(name) → id }
 */
export const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);

export const CAT_ICONS = ['◆', '★', '♥', '☀', '☾', '⚑', '✦', '◎', '▲', '■', '●', '✿', '⚙', '✉', '☕', '♫', '⚡', '$', '€', '✈', '⌘', '☰', '✎', '⌂', '⚕', '♣', '⛁', '◷'];

export const newCategoryId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Time-of-day greeting key (Hungarian source text; translated with t()).
export function greetingKey(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 10) return 'Jó reggelt';
  if (h >= 10 && h < 18) return 'Szép napot';
  if (h >= 18 && h < 22) return 'Jó estét';
  return 'Jó éjszakát';
}
