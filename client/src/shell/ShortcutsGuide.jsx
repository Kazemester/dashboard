import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { t } from '../i18n.js';
import useBackdropClose from '../components/useBackdropClose.js';

/*
 * How to wire iPhone Shortcuts (Parancsok) to the dashboard: Siri questions, a spoken daily summary, Apple
 * Health data every evening, and the share sheet. The endpoints live in server/src/routes/hooks.js.
 */
function Copy({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <span className="sc-copy">
      <code>{label ?? value}</code>
      <button
        type="button"
        className="btn btn-ghost sm"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)));
        }}
      >
        {done ? '✓' : t('Másolás')}
      </button>
    </span>
  );
}

function Recipe({ title, open, onToggle, children }) {
  return (
    <section className={`sc-recipe ${open ? 'open' : ''}`}>
      <button type="button" className="sc-recipe-head" onClick={onToggle} aria-expanded={open}>
        <b>{title}</b>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="sc-recipe-body">{children}</div>}
    </section>
  );
}

export default function ShortcutsGuide({ focus, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const [token, setToken] = useState(null);
  const [open, setOpen] = useState(focus || 'access');
  const origin = location.origin;
  useEffect(() => {
    api.get('/hooks/config').then((c) => setToken(c.token)).catch(() => setToken(''));
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const rotate = async () => {
    if (!confirm(t('Új kulcsot készítek; a régi kulccsal beállított Parancsok leállnak, amíg át nem írod őket. Mehet?'))) return;
    setToken((await api.post('/hooks/rotate')).token);
  };
  const toggle = (k) => setOpen(open === k ? null : k);

  const headers = (
    <ul className="sc-list">
      <li>
        <code>X-Nexus-Token</code>: <Copy value={token ?? ''} label={token ? `${token.slice(0, 6)}…` : '…'} />
      </li>
      <li>
        <code>CF-Access-Client-Id</code> {t('és')} <code>CF-Access-Client-Secret</code>: {t('a Cloudflare service token két értéke (lásd 0. lépés)')}
      </li>
    </ul>
  );
  const urlStep = (path, method, body) => (
    <>
      <li>
        <b>{t('URL tartalmának lekérése')}</b> (Get Contents of URL): <Copy value={`${origin}${path}`} />
      </li>
      <li>
        {t('Továbbiak megjelenítése')} → {t('Módszer')}: <b>{method}</b>
        {body && (
          <>
            {' '}
            · {t('Kérés törzse')}: <b>JSON</b> · {body}
          </>
        )}
      </li>
      <li>
        {t('Fejlécek')}: {headers}
      </li>
    </>
  );

  return (
    <div className="overlay center" {...backdrop}>
      <div className="modal sc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{t('IPHONE // PARANCSOK')}</div>
            <h2>{t('iPhone Parancsok bekötése')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small">{t('A Parancsok (Shortcuts) appal az iPhone adatot küld a dashboardnak és kérdez tőle: Siri, Egészség app, megosztás menü. Mindegyikhez kell a lenti kulcs.')}</p>

        <div className="sc-key">
          <span className="label">{t('Dashboard kulcs (X-Nexus-Token)')}</span>
          {token == null ? <span className="muted">…</span> : <Copy value={token} />}
          <button type="button" className="link-btn" onClick={rotate}>
            {t('Új kulcs')}
          </button>
        </div>

        <Recipe title={t('0. Cloudflare: belépés a Parancsoknak (egyszer)')} open={open === 'access'} onToggle={() => toggle('access')}>
          <p className="small">{t('A Cloudflare Access a Parancsokat is beléptetné, ezért kapnak egy saját belépőt (service token):')}</p>
          <ol className="sc-list">
            <li>{t('Cloudflare Zero Trust → Access → Service auth → Service Tokens → Create Service Token, név: „iPhone Parancsok”, lejárat: Non-expiring.')}</li>
            <li>{t('Másold ki a Client ID-t és a Client Secretet (a Secret csak egyszer látszik).')}</li>
            <li>{t('Access → Applications → a dashboard alkalmazás → Policies → Add a policy: Action: Service Auth, Include: Service Token → „iPhone Parancsok”. Mentés.')}</li>
            <li>{t('Ezt a két értéket minden Parancsban fejlécként küldöd: CF-Access-Client-Id és CF-Access-Client-Secret.')}</li>
          </ol>
          <p className="muted small">{t('Ha a dashboard nem Cloudflare Access mögött fut, ez a lépés kimarad, elég a Dashboard kulcs.')}</p>
        </Recipe>

        <Recipe title={t('1. „Hé Siri, kérdezd a dashboardot”')} open={open === 'ask'} onToggle={() => toggle('ask')}>
          <ol className="sc-list">
            <li>
              {t('Parancsok app → + → név')}: <b>{t('Kérdezd a dashboardot')}</b>
            </li>
            <li>
              <b>{t('Szöveg diktálása')}</b> (Dictate Text)
            </li>
            {urlStep('/api/hook/ask', 'POST', <>{t('mező')}: <code>text</code> = {t('Diktált szöveg')}</>)}
            <li>
              <b>{t('Szöveg felolvasása')}</b> (Speak Text): {t('URL tartalma')}
            </li>
          </ol>
          <p className="muted small">{t('Ezután: „Hé Siri, kérdezd a dashboardot” → mondd a kérdést. Ha a helyi AI 75 másodpercnél tovább gondolkodik, Siri ezt mondja, és a választ értesítésben kapod.')}</p>
        </Recipe>

        <Recipe title={t('2. „Mi a mai napom?” — azonnali összefoglaló AI nélkül')} open={open === 'summary'} onToggle={() => toggle('summary')}>
          <ol className="sc-list">
            <li>
              {t('Új parancs, név')}: <b>{t('Mi a mai napom')}</b>
            </li>
            {urlStep('/api/hook/summary', 'GET')}
            <li>
              <b>{t('Szöveg felolvasása')}</b>: {t('URL tartalma')}
            </li>
          </ol>
          <p className="muted small">{t('Tipp: Automatizálás → Ébresztő leállításakor → ez a parancs, és reggel felolvassa a teendőket.')}</p>
        </Recipe>

        <Recipe title={t('3. Egészség app → Egészség csempe, minden este')} open={open === 'health'} onToggle={() => toggle('health')}>
          <ol className="sc-list">
            <li>{t('Parancsok → Automatizálás → + → Napszak: 21:30, Naponta → Azonnali futtatás.')}</li>
            <li>
              <b>{t('Egészségügyi minták keresése')}</b> (Find Health Samples): {t('Típus: Lépések, Kezdő dátum: ma; Csoportosítás: Nap; Rendezés: legújabb; Korlát: 1. Ez adja a mai lépésszámot (összegként).')}
            </li>
            <li>{t('Ugyanígy, ha kell: Alvás elemzése (tegnap este óta, órában), Testsúly (legutóbbi), Aktív energia (ma, összeg), Nyugalmi pulzus (legutóbbi).')}</li>
            {urlStep(
              '/api/hook/health',
              'POST',
              <>
                {t('mezők')}: <code>steps</code>, <code>sleep</code>, <code>weight</code>, <code>kcal</code>, <code>hr</code>, <code>km</code> = {t('a fenti minták')}
              </>,
            )}
          </ol>
          <p className="muted small">{t('Az első küldés magától kirakja az Egészség csempét. A csempe ⚙ beállításaiban megadhatod a lépéscélt és egy szokást, amit a cél elérésekor kipipál. Az egységeket (lépés, óra, kg) a szerver levágja, magyar tizedesvesszővel is jó.')}</p>
        </Recipe>

        <Recipe title={t('4. Megosztás menü → teendő')} open={open === 'capture'} onToggle={() => toggle('capture')}>
          <ol className="sc-list">
            <li>
              {t('Új parancs, név')}: <b>{t('Dashboardba')}</b> → {t('ⓘ → Megjelenítés a megosztási lapon; bemenet: Szöveg, URL-ek')}
            </li>
            {urlStep('/api/hook/capture', 'POST', <>{t('mező')}: <code>text</code> = {t('Parancs bemenete')}</>)}
            <li>
              <b>{t('Értesítés megjelenítése')}</b>: {t('URL tartalma')}
            </li>
          </ol>
          <p className="muted small">{t('Bármely appban Megosztás → Dashboardba: a szöveg vagy link teendőként bekerül az első Teendők csempébe (a link ↗ ikonnal nyitható).')}</p>
        </Recipe>
      </div>
    </div>
  );
}
