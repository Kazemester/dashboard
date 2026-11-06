import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { t, locale, getLang } from '../i18n.js';
import './activity.css';

// Stable kinds written by server/src/activity.js. Names are Hungarian keys, translated at render.
export const ACT_KINDS = {
  tile: 'Csempék',
  todo: 'Teendők',
  money: 'Pénz',
  habit: 'Szokások',
  goal: 'Célok',
  focus: 'Fókusz',
  mail: 'Levelek',
  brief: 'Napi összefoglaló',
  ai: 'AI',
};

const STATUS = {
  done: ['Kész', 'done'],
  ok: ['Kész', 'done'],
  pending: ['Függőben', 'pending'],
  error: ['Hiba', 'error'],
  progress: ['Folyamatban', 'progress'],
};

// Small line icons (24×24, stroke = currentColor).
const ICONS = {
  tile: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13.5v6M13.5 16.5h6" /></>,
  todo: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>,
  money: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  habit: <><path d="M12 3c2.5 3 5 5.4 5 9a5 5 0 0 1-10 0c0-1.8.8-3.2 2-4.4.2 1.6 1 2.6 2 3 0-2.6.4-5 1-7.6Z" /></>,
  goal: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" /></>,
  focus: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M10 2.8h4" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7.5 8 5.5 8-5.5" /></>,
  brief: <><path d="M6 3.5h9l3.5 3.5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" /><path d="M9 11h6M9 14.5h6M9 18h3.5" /></>,
  ai: <><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9Z" /><path d="M18.5 16v4M16.5 18h4" /></>,
  other: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5M12 15.5v.5" /></>,
};

function Icon({ kind }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[kind] ?? ICONS.other}
    </svg>
  );
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function when(at, now) {
  const d = new Date(at);
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, now)) {
    const sec = Math.round((now - d) / 1000);
    if (sec < 60) return { text: t('épp most'), full: d.toLocaleString(locale()) };
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    const text = sec < 3600 ? rtf.format(-Math.floor(sec / 60), 'minute') : rtf.format(-Math.floor(sec / 3600), 'hour');
    return { text, full: d.toLocaleString(locale()) };
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return { text: t('tegnap {time}', { time }), full: d.toLocaleString(locale()) };
  const date = d.toLocaleDateString(locale(), {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return { text: `${date}, ${time}`, full: d.toLocaleString(locale()) };
}

function rowText(row) {
  const en = getLang() === 'en' ? row.meta?.en : null;
  return { title: en?.title || row.title, detail: en?.detail || row.detail };
}

const parseKinds = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function Activity({ widget }) {
  const cfg = widget.config ?? {};
  const pageSize = Math.min(Math.max(Number(cfg.rows) || 12, 5), 100);
  const cfgKinds = cfg.kinds;
  const [kinds, setKinds] = useState(() => parseKinds(cfgKinds));
  useEffect(() => setKinds(parseKinds(cfgKinds)), [cfgKinds]);
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 300);
  const [menu, setMenu] = useState(false);
  const [older, setOlder] = useState({ key: '', items: [], more: null });
  const [busy, setBusy] = useState(false);
  const [moreErr, setMoreErr] = useState(null);
  const menuRef = useRef(null);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (kinds.length) params.set('kind', kinds.join(','));
  params.set('limit', String(pageSize));
  const key = params.toString();
  const base = `/widgets/${widget.id}/activity`;

  const { data, error, loading } = useWidgetData(`${base}?${key}`, { interval: 30_000 });
  const { data: kindCounts } = useWidgetData(`${base}/kinds`, { interval: 30_000, live: false });

  // close the filter menu on outside click / Escape
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    const onKey = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const extra = older.key === key ? older : { items: [], more: null };
  const rows = useMemo(() => {
    const first = data?.items ?? [];
    const seen = new Set(first.map((r) => r.id));
    return [...first, ...extra.items.filter((r) => !seen.has(r.id))];
  }, [data, extra.items]);
  const hasMore = extra.more ?? data?.more ?? false;

  const loadMore = async () => {
    const last = rows[rows.length - 1];
    if (!last || busy) return;
    setBusy(true);
    setMoreErr(null);
    try {
      const p = new URLSearchParams(key);
      p.set('before', String(last.id));
      const page = await api.get(`${base}?${p}`);
      setOlder({ key, items: [...extra.items, ...page.items], more: page.more });
    } catch (e) {
      setMoreErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleKind = (k) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  const reveal = (row) => {
    if (row.widget_id) window.dispatchEvent(new CustomEvent('nexus:reveal', { detail: { id: row.widget_id } }));
  };

  const counts = Object.fromEntries((kindCounts ?? []).map((k) => [k.kind, k.count]));
  const kindIds = [...new Set([...Object.keys(ACT_KINDS), ...Object.keys(counts)])];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const now = new Date();
  const filtered = Boolean(query || kinds.length);

  return (
    <div className="act-w">
      <div className="act-head">
        <label className="act-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Keresés')}
            aria-label={t('Keresés az eseményekben')}
          />
        </label>
        <div className="act-filter" ref={menuRef}>
          <button type="button" className={`act-filter-btn ${kinds.length ? 'on' : ''}`} onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="true" aria-label={t('Szűrő')}>
            <span>{t('Szűrő')}</span>
            {kinds.length > 0 && <b className="act-badge">{kinds.length}</b>}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>
          {menu && (
            <div className="act-menu" role="menu">
              <button type="button" role="menuitemcheckbox" aria-checked={!kinds.length} className={`act-opt ${!kinds.length ? 'sel' : ''}`} onClick={() => setKinds([])}>
                <span className="act-check" />
                <span className="act-opt-name">{t('Összes')}</span>
                <span className="act-count">{total}</span>
              </button>
              <div className="act-sep" />
              {kindIds.map((k) => (
                <button type="button" role="menuitemcheckbox" aria-checked={kinds.includes(k)} key={k} className={`act-opt ${kinds.includes(k) ? 'sel' : ''}`} onClick={() => toggleKind(k)}>
                  <span className="act-check" />
                  <span className={`act-ico sm k-${k}`}>
                    <Icon kind={k} />
                  </span>
                  <span className="act-opt-name">{ACT_KINDS[k] ? t(ACT_KINDS[k]) : k}</span>
                  <span className="act-count">{counts[k] ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && !data ? (
        <div className="w-error">{error}</div>
      ) : !data && loading ? (
        <div className="loading">{t('SZINKRONIZÁLÁS…')}</div>
      ) : !rows.length ? (
        <div className="act-empty">
          <span className="act-empty-ico">
            <Icon kind={filtered ? 'other' : 'brief'} />
          </span>
          <b>{filtered ? t('Nincs találat') : t('Még nincs aktivitás')}</b>
          <span className="muted">
            {filtered ? t('Próbálj más keresést vagy szűrőt.') : t('Itt jelennek meg a teendők, kiadások, szokások és az AI műveletei.')}
          </span>
          {filtered && (
            <button
              type="button"
              className="btn btn-ghost sm"
              onClick={() => {
                setSearch('');
                setKinds([]);
              }}
            >
              {t('Szűrők törlése')}
            </button>
          )}
        </div>
      ) : (
        <div className="act-table" role="table" aria-label={t('Legutóbbi események')}>
          <div className="act-row act-th" role="row">
            <span role="columnheader">{t('Esemény')}</span>
            <span role="columnheader">{t('Részlet')}</span>
            <span role="columnheader">{t('Állapot')}</span>
            <span role="columnheader">{t('Idő')}</span>
          </div>
          {rows.map((row) => {
            const { title, detail } = rowText(row);
            const st = STATUS[row.status];
            const w = when(row.at, now);
            const link = Boolean(row.widget_id);
            return (
              <div
                key={row.id}
                role="row"
                className={`act-row ${link ? 'link' : ''}`}
                tabIndex={link ? 0 : undefined}
                onClick={link ? () => reveal(row) : undefined}
                onKeyDown={link ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), reveal(row)) : undefined}
                title={link ? t('Ugrás a csempére') : undefined}
              >
                <span className="act-ev" role="cell">
                  <span className={`act-ico k-${row.kind}`} title={ACT_KINDS[row.kind] ? t(ACT_KINDS[row.kind]) : row.kind}>
                    <Icon kind={row.kind} />
                  </span>
                  <span className="act-title">{title}</span>
                </span>
                <span className="act-detail" role="cell">{detail || '—'}</span>
                <span className="act-status" role="cell">
                  {st ? (
                    <>
                      <i className={`act-dot s-${st[1]}`} />
                      {t(st[0])}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
                <time className="act-time" role="cell" dateTime={row.at} title={w.full}>
                  {w.text}
                </time>
              </div>
            );
          })}
          {(hasMore || moreErr) && (
            <div className="act-more">
              {moreErr && <span className="w-error">{moreErr}</span>}
              {hasMore && (
                <button type="button" className="btn btn-ghost sm" onClick={loadMore} disabled={busy}>
                  {busy ? t('Betöltés…') : t('Továbbiak')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
