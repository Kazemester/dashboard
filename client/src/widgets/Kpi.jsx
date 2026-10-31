import React, { useEffect } from 'react';
import { useWidgetData, fmtNum } from '../hooks.js';
import { t, locale } from '../i18n.js';
import './finance.css';

/* ---------- shared finance helpers (used by Balance / Budget / Cashflow / Expenses) ---------- */

// Tiles that add or remove Költségkövető items fire this so the finance tiles reload.
export const FIN_EVENT = 'fin-items-changed';
export const notifyFinance = () => window.dispatchEvent(new CustomEvent(FIN_EVENT));
export function useFinanceReload(reload) {
  useEffect(() => {
    window.addEventListener(FIN_EVENT, reload);
    return () => window.removeEventListener(FIN_EVENT, reload);
  }, [reload]);
}

const ISO = { FT: 'HUF', '€': 'EUR', $: 'USD', '£': 'GBP' };
export const isoCurrency = (u) => {
  const s = String(u ?? '').trim().toUpperCase();
  return ISO[s] ?? (/^[A-Z]{3}$/.test(s) ? s : null);
};

// Money in the user's locale: ISO codes / Ft → currency format, anything else → "1 234 unit".
export function fmtMoney(n, unit, digits) {
  if (n == null || isNaN(n)) return '–';
  const iso = isoCurrency(unit);
  const d = digits ?? (iso && !['HUF', 'JPY', 'KRW'].includes(iso) && Math.abs(n) < 100000 ? 2 : 0);
  if (iso) {
    try {
      return new Intl.NumberFormat(locale(), { style: 'currency', currency: iso, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
    } catch {
      /* unknown code: plain number below */
    }
  }
  return `${fmtNum(n, d)}${unit ? ` ${unit}` : ''}`;
}
export const fmtCompact = (n) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// "↑ 7%" pill; `good` decides the colour (defaults to up = good).
export function Trend({ change, good, className = '' }) {
  if (change == null || !isFinite(change)) return <span className={`fin-trend flat ${className}`}>–</span>;
  const up = change >= 0;
  const ok = good ?? up;
  const v = Math.abs(change);
  return (
    <span className={`fin-trend ${ok ? 'good' : 'bad'} ${className}`}>
      {up ? '↑' : '↓'} {fmtNum(v, v < 10 ? 1 : 0)}%
    </span>
  );
}

/* ---------- Mutatók (KPI grid) ---------- */

const ICON = { manual: '◇', expenses: '↘', income: '↗', api: '⌁' };
const ERR = {
  notile: 'Nincs Költségkövető csempe',
  tile: 'Nincs ilyen nevű Költségkövető',
  nourl: 'Adj meg egy URL-t',
  path: 'Nem szám az útvonalon',
  source: 'Ismeretlen forrás',
};

export default function Kpi({ widget, onConfigure }) {
  const metrics = Array.isArray(widget.config.metrics) ? widget.config.metrics : [];
  const { data, error, reload } = useWidgetData(metrics.length ? `/widgets/${widget.id}/kpi` : null, {
    interval: 5 * 60_000,
    deps: [JSON.stringify(widget.config)],
  });
  useFinanceReload(reload);

  if (!metrics.length)
    return (
      <div className="fin-empty">
        <span className="muted">{t('Még nincs mutató.')}</span>
        <button className="btn btn-ghost sm" onClick={onConfigure}>
          + {t('Mutató')}
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  const list = data?.metrics ?? metrics.map((m) => ({ label: m.label, source: m.source, value: null, loading: true }));
  const n = list.length;
  return (
    <div className={`fin-kpi fin-kpi-n${Math.min(n, 4)} ${n > 4 ? 'fin-kpi-many' : ''}`}>
      {list.map((m, i) => {
        const period = m.source === 'manual' ? t('az előzőhöz képest') : m.period === 'day' ? t('tegnaphoz képest') : t('ebben a hónapban');
        const good = m.change == null ? null : m.lowerIsBetter ? m.change <= 0 : m.change >= 0;
        return (
          <div key={i} className={`fin-kpi-card ${i === 0 ? 'hero' : ''}`}>
            <div className="fin-kpi-head">
              <span className="fin-kpi-label">{m.label ? t(m.label) : t('Mutató')}</span>
              <span className="fin-ico" aria-hidden>
                {m.icon || ICON[m.source] || '◇'}
              </span>
            </div>
            {m.error ? (
              <div className="fin-kpi-err">{ERR[m.error] ? t(ERR[m.error]) : m.error}</div>
            ) : (
              <div className="fin-kpi-val" title={m.loading ? undefined : fmtMoney(m.value, m.unit, m.decimals ?? undefined)}>{m.loading ? '…' : fmtMoney(m.value, m.unit, m.decimals ?? undefined)}</div>
            )}
            {!m.error && !m.loading && (
              <div className="fin-kpi-foot">
                <Trend change={m.change} good={good} />
                <span className="fin-kpi-period">{period}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
