import Pomodoro from './Pomodoro.jsx';
import Habits from './Habits.jsx';
import Progress from './Progress.jsx';
import Calendar from './Calendar.jsx';
import Weather from './Weather.jsx';
import News from './News.jsx';
import ApiWidget from './ApiWidget.jsx';
import Chat from './Chat.jsx';
import MailDigest from './MailDigest.jsx';
import Clock from './Clock.jsx';

export const CATEGORIES = {
  focus: 'Fókusz',
  data: 'Adat & API',
  ai: 'AI botok',
  info: 'Info',
};

/*
 * Widget types. To add a new one: create a component that receives { widget, editing, onConfigure },
 * register it here, and (if it needs server data) add a route under server/src/routes.
 * `fields` drives the generic settings form (ConfigModal).
 */
export const REGISTRY = {
  pomodoro: {
    name: 'Pomodoro',
    icon: '◴',
    accent: 'magenta',
    category: 'focus',
    description: 'Fókusz időzítő körökkel, értesítéssel és heti statisztikával.',
    size: { w: 3, h: 7, minW: 3, minH: 6 },
    component: Pomodoro,
    defaultConfig: { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false },
    fields: [
      { key: 'focus', label: 'Fókusz (perc)', type: 'number', min: 1 },
      { key: 'short', label: 'Rövid szünet (perc)', type: 'number', min: 1 },
      { key: 'long', label: 'Hosszú szünet (perc)', type: 'number', min: 1 },
      { key: 'longEvery', label: 'Hosszú szünet minden N. kör után', type: 'number', min: 1 },
      { key: 'autoStart', label: 'Automatikus folytatás', type: 'checkbox', checkLabel: 'A következő kör magától indul' },
    ],
  },
  habits: {
    name: 'Szokáskövető',
    icon: '◈',
    accent: 'green',
    category: 'focus',
    description: 'Havi rács (1-től a hónap végéig), lapozható hónapok, havonta bővíthető sorok.',
    size: { w: 6, h: 6, minW: 4, minH: 4 },
    component: Habits,
    defaultConfig: {},
    fields: [],
  },
  progress: {
    name: 'Progress sávok',
    icon: '▤',
    accent: 'cyan',
    category: 'focus',
    description: 'Bővíthető célok sávokkal vagy oszlopdiagrammal, előzmény-sparkline-nal.',
    size: { w: 4, h: 6, minW: 3, minH: 4 },
    component: Progress,
    defaultConfig: { mode: 'bars', step: 1 },
    fields: [
      { key: 'mode', label: 'Megjelenítés', type: 'select', options: [['bars', 'Vízszintes sávok'], ['columns', 'Oszlopdiagram']] },
      { key: 'step', label: '+/− lépésköz', type: 'number', min: 0 },
    ],
  },
  calendar: {
    name: 'Naptár',
    icon: '▦',
    accent: 'violet',
    category: 'info',
    description: 'Google, iCloud, Outlook naptárak iCal (.ics) linkkel, napokra bontva.',
    size: { w: 4, h: 7, minW: 3, minH: 4 },
    component: Calendar,
    configureOnAdd: true,
    defaultConfig: { days: 7, sources: [] },
    fields: [
      { key: 'days', label: 'Előre napok', type: 'number', min: 1, max: 90 },
      {
        key: 'sources',
        label: 'Naptárak',
        type: 'list',
        addLabel: 'Naptár',
        newItem: { color: '#8a7dff' },
        fields: [
          { key: 'name', placeholder: 'Név' },
          { key: 'url', placeholder: 'https://… .ics vagy webcal://…' },
          { key: 'color', type: 'color' },
        ],
        help:
          'Google: Naptár beállításai → „Titkos cím iCal formátumban”. iCloud: Naptár app → megosztás → „Nyilvános naptár” link. Titkos linket {{secret:NEV}} formában is megadhatsz (env: SECRET_NEV).',
      },
    ],
  },
  weather: {
    name: 'Időjárás',
    icon: '☁',
    accent: 'cyan',
    category: 'info',
    description: 'Aktuális idő és 5 napos előrejelzés (Open-Meteo, kulcs nélkül).',
    size: { w: 4, h: 5, minW: 3, minH: 4 },
    component: Weather,
    defaultConfig: { city: 'Budapest' },
    fields: [{ key: 'city', label: 'Város', placeholder: 'Budapest' }],
  },
  news: {
    name: 'Hírek (RSS)',
    icon: '≋',
    accent: 'amber',
    category: 'info',
    description: 'Bármilyen RSS/Atom hírcsatorna egy listában.',
    size: { w: 4, h: 7, minW: 3, minH: 3 },
    component: News,
    defaultConfig: { feeds: 'https://telex.hu/rss\nhttps://hnrss.org/frontpage', limit: 15 },
    fields: [
      { key: 'feeds', label: 'RSS linkek (soronként egy)', type: 'textarea' },
      { key: 'limit', label: 'Max. hírek', type: 'number', min: 1 },
    ],
  },
  api: {
    name: 'API connector',
    icon: '⌁',
    accent: 'amber',
    category: 'data',
    description: 'Bármilyen JSON API: érték, lista vagy nyers JSON. A kulcsok a szerveren maradnak.',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
    component: ApiWidget,
    configureOnAdd: true,
    defaultConfig: { method: 'GET', display: 'auto', refreshSec: 300 },
    fields: [
      { key: 'url', label: 'URL', placeholder: 'https://api.example.com/data?key={{secret:MY_KEY}}' },
      { key: 'method', label: 'Metódus', type: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
      { key: 'headers', label: 'Fejlécek (JSON)', type: 'textarea', rows: 2, placeholder: '{"Authorization": "Bearer {{secret:MY_TOKEN}}"}' },
      { key: 'body', label: 'Body (POST)', type: 'textarea', rows: 2 },
      { key: 'path', label: 'JSON útvonal', placeholder: 'pl. data.items[0].price', help: 'Pontokkal elválasztott útvonal a válaszon belül. Üresen a teljes válasz.' },
      { key: 'display', label: 'Megjelenítés', type: 'select', options: [['auto', 'Automatikus'], ['value', 'Nagy szám / érték'], ['list', 'Lista'], ['json', 'Nyers JSON']] },
      { key: 'prefix', label: 'Előtag', placeholder: '$' },
      { key: 'suffix', label: 'Utótag', placeholder: ' Ft' },
      { key: 'decimals', label: 'Tizedesjegyek', type: 'number', min: 0 },
      { key: 'caption', label: 'Felirat' },
      { key: 'itemField', label: 'Lista: szöveg mező', placeholder: 'title' },
      { key: 'linkField', label: 'Lista: link mező', placeholder: 'url' },
      { key: 'refreshSec', label: 'Frissítés (mp)', type: 'number', min: 10 },
    ],
  },
  chat: {
    name: 'AI Chat',
    icon: '◉',
    accent: 'magenta',
    category: 'ai',
    description: 'Beszélgetés Grokkal (vagy bármilyen OpenAI-kompatibilis modellel), mentett előzményekkel.',
    size: { w: 4, h: 8, minW: 3, minH: 5 },
    component: Chat,
    defaultConfig: { systemPrompt: '', model: '' },
    fields: [
      { key: 'systemPrompt', label: 'Rendszer prompt / személyiség', type: 'textarea', placeholder: 'You are NEXUS, a concise sci-fi ship AI…' },
      { key: 'model', label: 'Modell (üresen: .env LLM_MODEL)', placeholder: 'grok-4' },
    ],
  },
  maildigest: {
    name: 'Mail bot',
    icon: '✉',
    accent: 'violet',
    category: 'ai',
    description: 'AI bot, ami IMAP-on átnézi a leveleidet, kiszűri a fontosakat és teendőlistát ír.',
    size: { w: 4, h: 8, minW: 3, minH: 5 },
    component: MailDigest,
    configureOnAdd: true,
    defaultConfig: { hours: 24, maxMails: 40, unreadOnly: true, autoMinutes: 0, language: 'Hungarian' },
    fields: [
      { key: 'imapHost', label: 'IMAP szerver', placeholder: '{{secret:IMAP_HOST}}  (pl. imap.gmail.com / imap.mail.me.com)', help: 'Üresen az .env SECRET_IMAP_HOST / SECRET_IMAP_USER / SECRET_IMAP_PASSWORD értékeit használja.' },
      { key: 'imapUser', label: 'Felhasználó', placeholder: '{{secret:IMAP_USER}}' },
      { key: 'imapPassword', label: 'App jelszó', type: 'password', placeholder: '{{secret:IMAP_PASSWORD}}', help: 'Ajánlott a {{secret:…}} hivatkozás, így a jelszó nem kerül az adatbázisba.' },
      { key: 'mailbox', label: 'Mappa', placeholder: 'INBOX' },
      { key: 'hours', label: 'Elmúlt órák', type: 'number', min: 1 },
      { key: 'maxMails', label: 'Max. levél / futás', type: 'number', min: 1 },
      { key: 'unreadOnly', label: 'Szűrés', type: 'checkbox', default: true, checkLabel: 'Csak olvasatlan levelek' },
      { key: 'autoMinutes', label: 'Automatikus futás (perc, 0 = ki)', type: 'number', min: 0 },
      { key: 'instructions', label: 'Extra szabályok a botnak', type: 'textarea', placeholder: 'pl. A banki és NAV levelek mindig fontosak. A LinkedIn értesítéseket hagyd ki.' },
      { key: 'language', label: 'Nyelv', placeholder: 'Hungarian' },
      { key: 'model', label: 'Modell (üresen: .env LLM_MODEL)', placeholder: 'grok-4' },
    ],
  },
  clock: {
    name: 'Világóra',
    icon: '◷',
    accent: 'cyan',
    category: 'info',
    description: 'Analóg óra és tetszőleges időzónák.',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
    component: Clock,
    defaultConfig: { zones: 'America/New_York, Asia/Tokyo' },
    fields: [{ key: 'zones', label: 'Időzónák (vesszővel)', type: 'textarea', rows: 2, placeholder: 'Europe/London, America/New_York' }],
  },
};

// Picker entries: every widget type, plus ready-made presets of the generic API connector.
const PRESETS = [
  {
    key: 'preset-btc',
    type: 'api',
    name: 'Bitcoin árfolyam',
    icon: '₿',
    description: 'CoinGecko — BTC ár USD-ben (API connector preset).',
    defaultConfig: { url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', path: 'bitcoin.usd', display: 'value', prefix: '$', decimals: 0, caption: 'BTC / USD', refreshSec: 120 },
    size: { w: 3, h: 3, minW: 2, minH: 3 },
  },
  {
    key: 'preset-eurhuf',
    type: 'api',
    name: 'EUR/HUF árfolyam',
    icon: '€',
    description: 'Frankfurter (EKB) — napi euró árfolyam (API connector preset).',
    defaultConfig: { url: 'https://api.frankfurter.app/latest?from=EUR&to=HUF', path: 'rates.HUF', display: 'value', suffix: ' Ft', decimals: 2, caption: '1 EUR', refreshSec: 3600 },
    size: { w: 3, h: 3, minW: 2, minH: 3 },
  },
  {
    key: 'preset-hn',
    type: 'api',
    name: 'Hacker News top',
    icon: 'Y',
    description: 'Algolia HN API — kiemelt posztok listája (API connector preset).',
    defaultConfig: { url: 'https://hn.algolia.com/api/v1/search?tags=front_page', path: 'hits', display: 'list', itemField: 'title', linkField: 'url', refreshSec: 600 },
    size: { w: 4, h: 6, minW: 3, minH: 3 },
  },
];

export const CATALOG = [
  ...Object.entries(REGISTRY).map(([type, d]) => ({ key: type, type, ...d })),
  ...PRESETS.map((p) => ({ ...REGISTRY[p.type], ...p, configureOnAdd: false })),
];
