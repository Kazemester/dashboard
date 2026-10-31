import React, { useState } from 'react';
import { useWidgetData, isoDay } from '../hooks.js';
import { api } from '../api.js';
import { t } from '../i18n.js';
import { fmtMoney, notifyFinance, Trend, useFinanceReload } from './Kpi.jsx';
import './finance.css';

// 'HUF' → 🇭🇺 (regional indicators from the first two letters; EUR → 🇪🇺).
const flag = (cur) => {
  const cc = String(cur).slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '¤';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};
const parseNum = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));

function Wallet({ a, onSave }) {
  const [edit, setEdit] = useState(null);
  const save = async () => {
    const n = parseNum(edit);
    setEdit(null);
    if (edit !== null && isFinite(n) && n !== a.amount) await onSave(n);
  };
  return (
    <div className={`fin-wallet ${a.active ? '' : 'off'}`}>
      <div className="fin-wallet-head">
        <span className="fin-flag" aria-hidden>
          {flag(a.currency)}
        </span>
        <span className="fin-wallet-name">{a.name || a.currency}</span>
      </div>
      {edit !== null ? (
        <input
          className="input sm fin-wallet-input"
          autoFocus
          inputMode="decimal"
          value={edit}
          onChange={(e) => setEdit(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEdit(null);
          }}
        />
      ) : (
        <button className="fin-wallet-amt" title={`${fmtMoney(a.amount, a.currency)} · ${t('Koppints a szerkesztéshez')}`} onClick={() => setEdit(String(a.amount))}>
          {fmtMoney(a.amount, a.currency)}
        </button>
      )}
      {a.limit != null && <div className="fin-wallet-limit">{t('Keret: {v} / hó', { v: fmtMoney(a.limit, a.currency, 0) })}</div>}
      <div className={`fin-wallet-state ${a.active ? 'on' : ''}`}>{a.active ? t('Aktív') : t('Inaktív')}</div>
    </div>
  );
}

function QuickForm({ kind, tile, accounts, onDone }) {
  const cats = String(tile.categories || t('Étel, Lakás, Közlekedés, Szórakozás, Egyéb')).split(',').map((c) => c.trim()).filter(Boolean);
  const [f, setF] = useState({ amount: '', cat: cats[0] ?? '', note: '', acc: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const n = parseNum(f.amount);
    if (!n || n < 0) return;
    setBusy(true);
    try {
      await api.post(`/widgets/${tile.id}/items`, {
        kind,
        day: isoDay(new Date()),
        value: n,
        data: kind === 'expense' ? { cat: f.cat, note: f.note.trim() } : { note: f.note.trim() },
      });
      notifyFinance();
      await onDone(n, f.acc === '' ? null : Number(f.acc));
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };
  return (
    <form className="fin-quick" onSubmit={submit}>
      <div className="fin-quick-row">
        <input className="input sm fin-quick-amt" autoFocus inputMode="decimal" placeholder={`${t('Összeg')} (${tile.currency})`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        {kind === 'expense' && (
          <select className="input sm" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
      <div className="fin-quick-row">
        <input className="input sm grow" placeholder={t('Megjegyzés')} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        {accounts.length > 0 && (
          <select className="input sm" value={f.acc} title={t('Egyenleg módosítása')} onChange={(e) => setF({ ...f, acc: e.target.value })}>
            <option value="">{t('Csak naplózás')}</option>
            {accounts.map((a, i) => (
              <option key={i} value={i}>
                {kind === 'income' ? '+ ' : '− '}
                {a.name || a.currency}
              </option>
            ))}
          </select>
        )}
      </div>
      {err && <div className="w-error">{err}</div>}
      <div className="fin-quick-row end">
        <button type="button" className="btn btn-ghost sm" onClick={() => onDone(0, null)}>
          {t('Mégse')}
        </button>
        <button className="btn btn-primary sm" disabled={busy}>
          {kind === 'income' ? t('Bevétel rögzítése') : t('Kiadás rögzítése')}
        </button>
      </div>
      <div className="fin-quick-hint">{t('Ide kerül: {t}', { t: t(tile.title) })}</div>
    </form>
  );
}

export default function Balance({ widget, onUpdateConfig, onConfigure }) {
  const cfg = widget.config;
  const accounts = Array.isArray(cfg.accounts) ? cfg.accounts : [];
  const { data, error, reload } = useWidgetData(`/widgets/${widget.id}/balance`, { interval: 30 * 60_000, deps: [JSON.stringify(cfg)] });
  useFinanceReload(reload);
  const [form, setForm] = useState(null); // 'income' | 'expense'

  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('Betöltés…')}</div>;

  const setAmount = (i, amount) => onUpdateConfig({ accounts: accounts.map((a, j) => (j === i ? { ...a, amount } : a)) });
  const done = async (n, acc) => {
    setForm(null);
    if (n && acc != null && accounts[acc]) await setAmount(acc, (Number(accounts[acc].amount) || 0) + (form === 'income' ? n : -n));
  };

  return (
    <div className="fin-balance">
      <div className="fin-bal-top">
        <div className="fin-bal-label">{t('Teljes egyenleg')}</div>
        <span className="fin-chip">
          {data.base}
        </span>
      </div>
      <div className="fin-bal-total">{data.missing ? '–' : fmtMoney(data.total, data.base)}</div>
      <div className="fin-bal-change">
        <Trend change={data.change} />
        <span className="fin-kpi-period">{data.change == null ? t('nincs múlt havi adat') : t('a múlt hónaphoz')}</span>
      </div>
      {data.missing && <div className="w-error">{data.fxError ? t('Árfolyam nem elérhető: {e}', { e: data.fxError }) : t('Ismeretlen pénznem')}</div>}

      {data.expenseTile && !form && (
        <div className="fin-pills">
          <button className="fin-pill dark" onClick={() => setForm('income')}>
            + {t('Bevétel')}
          </button>
          <button className="fin-pill" onClick={() => setForm('expense')}>
            − {t('Kiadás')}
          </button>
        </div>
      )}
      {form && <QuickForm kind={form} tile={data.expenseTile} accounts={accounts} onDone={done} />}

      <div className="fin-wallets-box">
        <div className="fin-wallets-head">
          <span>{t('Számlák')}</span>
          <span className="fin-sep" />
          <span className="muted">{t('{n} számla', { n: data.accounts.length })}</span>
        </div>
        {data.accounts.length ? (
          <div className="fin-wallets">
            {data.accounts.map((a, i) => (
              <Wallet key={i} a={a} onSave={(n) => setAmount(i, n)} />
            ))}
          </div>
        ) : (
          <button className="btn btn-ghost sm" onClick={onConfigure}>
            + {t('Számla')}
          </button>
        )}
      </div>
    </div>
  );
}
