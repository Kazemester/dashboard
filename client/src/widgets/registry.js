import Pomodoro from './Pomodoro.jsx';
import Habits from './Habits.jsx';
import Progress from './Progress.jsx';
import Calendar from './Calendar.jsx';
import Weather from './Weather.jsx';
import News from './News.jsx';
import ApiWidget from './ApiWidget.jsx';
import Chat from './Chat.jsx';
import MailDigest from './MailDigest.jsx';
import Render from './Render.jsx';
import Clock from './Clock.jsx';
import Todo from './Todo.jsx';
import Notes from './Notes.jsx';
import Countdown from './Countdown.jsx';
import Stopwatch from './Stopwatch.jsx';
import Counter from './Counter.jsx';
import Mood from './Mood.jsx';
import MetricLog from './MetricLog.jsx';
import Expenses from './Expenses.jsx';
import TimeProgress from './TimeProgress.jsx';
import AirQuality from './AirQuality.jsx';
import SunMoon from './SunMoon.jsx';
import Quote from './Quote.jsx';
import Links from './Links.jsx';
import ImageFrame from './ImageFrame.jsx';
import Embed from './Embed.jsx';
import Crypto from './Crypto.jsx';
import Currency from './Currency.jsx';
import GitHub from './GitHub.jsx';
import SystemMonitor from './SystemMonitor.jsx';
import Uptime from './Uptime.jsx';
import HomeAssistant from './HomeAssistant.jsx';
import Brief from './Brief.jsx';
import Stocks from './Stocks.jsx';

export const CATEGORIES = {
  focus: 'Fókusz & feladatok',
  life: 'Élet & egészség',
  info: 'Info',
  money: 'Pénz & piac',
  home: 'Otthon & rendszer',
  data: 'Adat & API',
  ai: 'AI',
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
      { key: 'model', label: 'Modell (üresen: a fejléc AI beállításaiban megadott)', placeholder: 'grok-4' },
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
      { key: 'imapPort', label: 'Port', type: 'number', placeholder: '993', help: '993 = SSL (a legtöbb szolgáltató), 143 = STARTTLS.' },
      { key: 'imapUser', label: 'Felhasználó', placeholder: '{{secret:IMAP_USER}}' },
      { key: 'imapPassword', label: 'App jelszó', type: 'password', placeholder: '{{secret:IMAP_PASSWORD}}', help: 'Ajánlott a {{secret:…}} hivatkozás, így a jelszó nem kerül az adatbázisba.' },
      { key: 'mailbox', label: 'Mappa', placeholder: 'INBOX' },
      { key: 'hours', label: 'Elmúlt órák', type: 'number', min: 1 },
      { key: 'maxMails', label: 'Max. levél / futás', type: 'number', min: 1 },
      { key: 'unreadOnly', label: 'Szűrés', type: 'checkbox', default: true, checkLabel: 'Csak olvasatlan levelek' },
      { key: 'autoMinutes', label: 'Automatikus futás (perc, 0 = ki)', type: 'number', min: 0 },
      { key: 'instructions', label: 'Extra szabályok a botnak', type: 'textarea', placeholder: 'pl. A banki és NAV levelek mindig fontosak. A LinkedIn értesítéseket hagyd ki.' },
      { key: 'language', label: 'Nyelv', placeholder: 'Hungarian' },
      { key: 'model', label: 'Modell (üresen: a fejléc AI beállításaiban megadott)', placeholder: 'grok-4' },
    ],
  },
  render: {
    name: 'Látványterv',
    icon: '⌂',
    accent: 'amber',
    category: 'ai',
    description: 'Vázlatból vagy SketchUp / Revit képernyőképből fotórealisztikus látványterv, a gépeden futó ComfyUI-jal (Stable Diffusion / FLUX + ControlNet).',
    size: { w: 5, h: 12, minW: 4, minH: 8 },
    component: Render,
    defaultConfig: { comfyUrl: '', steps: 25, cfg: 6, megapixels: 1 },
    fields: [
      {
        key: 'comfyUrl',
        label: 'ComfyUI címe',
        placeholder: 'http://host.docker.internal:8188',
        help: 'ComfyUI Desktop alkalmazás: http://host.docker.internal:8000 · kézi telepítés: http://host.docker.internal:8188. Üresen a COMFYUI_URL környezeti változó vagy a 8188-as port.',
      },
      { key: 'steps', label: 'Lépések (több = lassabb, részletesebb)', type: 'number', min: 4, max: 60 },
      { key: 'cfg', label: 'CFG (mennyire kövesse a promptot)', type: 'number', min: 1, max: 15, help: 'SDXL / SD1.5: 5–7. Turbo / Lightning modellekhez 1–2 és 6–8 lépés.' },
      {
        key: 'megapixels',
        label: 'Felbontás',
        type: 'select',
        options: [
          ['0.5', '0,5 MP (SD 1.5 modellekhez, gyors)'],
          ['1', '1 MP (SDXL / FLUX, ~1024×1024)'],
          ['1.5', '1,5 MP (lassabb)'],
        ],
      },
      { key: 'negative', label: 'Negatív prompt (amit ne rajzoljon)', type: 'textarea', placeholder: 'blurry, distorted, warped lines, text, watermark…' },
    ],
  },
  // ---------- Fókusz & feladatok ----------
  todo: {
    name: 'Teendők',
    icon: '☑',
    category: 'focus',
    description: 'Feladatlista határidőkkel, a lejártak kiemelve. A JARVIS brief is látja.',
    size: { w: 4, h: 7, minW: 3, minH: 4 },
    component: Todo,
    defaultConfig: { hideDone: false },
    fields: [{ key: 'hideDone', label: 'Kész feladatok', type: 'checkbox', checkLabel: 'Elrejtés' }],
  },
  notes: {
    name: 'Jegyzet',
    icon: '✎',
    category: 'focus',
    description: 'Gyors jegyzetfüzet automatikus mentéssel.',
    size: { w: 4, h: 6, minW: 2, minH: 3 },
    component: Notes,
    fields: [],
  },
  countdown: {
    name: 'Visszaszámláló',
    icon: '⧗',
    category: 'focus',
    description: 'Napok a fontos eseményekig: nyaralás, határidő, születésnap (évente ismétlődő is).',
    size: { w: 3, h: 5, minW: 2, minH: 3 },
    component: Countdown,
    configureOnAdd: true,
    defaultConfig: { events: [] },
    fields: [
      {
        key: 'events',
        label: 'Események',
        type: 'list',
        addLabel: 'Esemény',
        fields: [
          { key: 'name', placeholder: 'Név' },
          { key: 'date', type: 'date' },
          { key: 'yearly', type: 'checkbox', checkLabel: 'évente' },
        ],
      },
      { key: 'showPast', label: 'Elmúlt események', type: 'checkbox', checkLabel: 'Mutasd azokat is' },
    ],
  },
  stopwatch: {
    name: 'Stopper / időzítő',
    icon: '⏱',
    category: 'focus',
    description: 'Stopper körökkel és gyors időzítő hangjelzéssel. Újratöltés után is fut.',
    size: { w: 3, h: 5, minW: 2, minH: 4 },
    component: Stopwatch,
    fields: [],
  },

  // ---------- Élet & egészség ----------
  counter: {
    name: 'Napi számláló',
    icon: '⊕',
    category: 'life',
    description: 'Bármi, amit naponta számolsz: víz, kávé, fekvőtámasz, lépések. Napi céllal és 14 napos előzménnyel.',
    size: { w: 3, h: 5, minW: 2, minH: 4 },
    component: Counter,
    defaultConfig: { goal: 8, step: 1, unit: 'pohár' },
    fields: [
      { key: 'goal', label: 'Napi cél (0 = nincs)', type: 'number', min: 0 },
      { key: 'step', label: 'Lépésköz', type: 'number', min: 0 },
      { key: 'unit', label: 'Egység', placeholder: 'pohár / csésze / db' },
    ],
  },
  mood: {
    name: 'Hangulatnapló',
    icon: '◑',
    category: 'life',
    description: 'Napi hangulat 1–5 skálán, havi naptárnézetben, átlaggal.',
    size: { w: 4, h: 7, minW: 3, minH: 6 },
    component: Mood,
    fields: [],
  },
  metric: {
    name: 'Mérésnapló',
    icon: '∿',
    category: 'life',
    description: 'Számértékek grafikonon: testsúly, alvás, pulzus, vérnyomás, futóidő. Céllal és változással.',
    size: { w: 4, h: 6, minW: 3, minH: 5 },
    component: MetricLog,
    defaultConfig: { unit: 'kg', decimals: 1, rangeDays: 90 },
    fields: [
      { key: 'unit', label: 'Egység', placeholder: 'kg / óra / bpm' },
      { key: 'goal', label: 'Cél (opcionális)', type: 'number' },
      { key: 'decimals', label: 'Tizedesjegyek', type: 'number', min: 0, max: 3 },
      { key: 'rangeDays', label: 'Megjelenített időszak (nap)', type: 'number', min: 7 },
    ],
  },
  expenses: {
    name: 'Költségkövető',
    icon: '¤',
    category: 'life',
    description: 'Havi kiadások kategóriánként, kerettel és hó végi becsléssel. Lapozható hónapok.',
    size: { w: 4, h: 8, minW: 3, minH: 5 },
    component: Expenses,
    defaultConfig: { currency: 'Ft', budget: 300000, categories: 'Étel, Lakás, Közlekedés, Szórakozás, Egészség, Egyéb' },
    fields: [
      { key: 'budget', label: 'Havi keret (0 = nincs)', type: 'number', min: 0 },
      { key: 'currency', label: 'Pénznem', placeholder: 'Ft' },
      { key: 'categories', label: 'Kategóriák (vesszővel)', type: 'textarea', rows: 2 },
    ],
  },
  timeprogress: {
    name: 'Idő haladása',
    icon: '◔',
    category: 'life',
    description: 'Mennyi telt el a napból, hétből, hónapból, évből és opcionálisan az életedből.',
    size: { w: 3, h: 5, minW: 2, minH: 4 },
    component: TimeProgress,
    fields: [
      { key: 'birthYear', label: 'Születési év (opcionális)', type: 'number', min: 1900 },
      { key: 'birthMonth', label: 'Születési hónap', type: 'number', min: 1, max: 12 },
      { key: 'lifeExpectancy', label: 'Várható élettartam (év)', type: 'number', min: 1, placeholder: '80' },
    ],
  },

  // ---------- Info ----------
  air: {
    name: 'Levegő & pollen',
    icon: '≈',
    category: 'info',
    description: 'Európai légminőség-index, PM2.5 / PM10, UV, és pollen (parlagfű, fű, nyír…).',
    size: { w: 3, h: 6, minW: 3, minH: 4 },
    component: AirQuality,
    defaultConfig: { city: 'Budapest' },
    fields: [{ key: 'city', label: 'Város' }],
  },
  sun: {
    name: 'Nap & Hold',
    icon: '☾',
    category: 'info',
    description: 'Napkelte, napnyugta, a Nap útja, nappal hossza, holdfázis.',
    size: { w: 4, h: 5, minW: 3, minH: 4 },
    component: SunMoon,
    defaultConfig: { city: 'Budapest' },
    fields: [{ key: 'city', label: 'Város' }],
  },
  quote: {
    name: 'Napi idézet',
    icon: '❝',
    category: 'info',
    description: 'Naponta új idézet (kattintásra a következő). Saját idézeteket is megadhatsz.',
    size: { w: 4, h: 3, minW: 2, minH: 2 },
    component: Quote,
    fields: [
      { key: 'custom', label: 'Saját idézetek (soronként: szöveg — szerző)', type: 'textarea' },
      { key: 'onlyCustom', label: 'Csak a sajátok', type: 'checkbox', checkLabel: 'Csak a saját idézeteim' },
    ],
  },
  links: {
    name: 'Gyorslinkek',
    icon: '⌘',
    category: 'info',
    description: 'Ikonos gyorsindító a kedvenc oldalaidhoz és szolgáltatásaidhoz.',
    size: { w: 4, h: 3, minW: 2, minH: 2 },
    component: Links,
    configureOnAdd: true,
    defaultConfig: { links: [], icons: true },
    fields: [
      {
        key: 'links',
        label: 'Linkek',
        type: 'list',
        addLabel: 'Link',
        fields: [
          { key: 'name', placeholder: 'Név' },
          { key: 'url', placeholder: 'https://…' },
        ],
      },
      { key: 'icons', label: 'Ikonok', type: 'checkbox', default: true, checkLabel: 'Favicon mutatása' },
    ],
  },
  image: {
    name: 'Képkeret',
    icon: '▣',
    category: 'info',
    description: 'Képek vagy webkamera URL-ből, diavetítéssel.',
    size: { w: 4, h: 5, minW: 2, minH: 2 },
    component: ImageFrame,
    configureOnAdd: true,
    defaultConfig: { intervalSec: 30, fit: 'cover' },
    fields: [
      { key: 'urls', label: 'Kép URL-ek (soronként egy)', type: 'textarea' },
      { key: 'intervalSec', label: 'Váltás (mp)', type: 'number', min: 5 },
      { key: 'fit', label: 'Kitöltés', type: 'select', options: [['cover', 'Kitölt (vág)'], ['contain', 'Teljes kép']] },
      { key: 'refresh', label: 'Webkamera', type: 'checkbox', checkLabel: 'Kép újratöltése minden váltáskor' },
    ],
  },
  embed: {
    name: 'Beágyazás',
    icon: '⧉',
    category: 'data',
    description: 'Bármilyen weboldal csempeként: Grafana, Home Assistant, YouTube, Spotify, Google Sheets.',
    size: { w: 6, h: 7, minW: 2, minH: 3 },
    component: Embed,
    configureOnAdd: true,
    fields: [
      { key: 'url', label: 'URL', placeholder: 'https://…', help: 'Néhány oldal (pl. Google kereső, GitHub) letiltja a beágyazást. Ezeket nem lehet csempébe tenni.' },
    ],
  },

  // ---------- Pénz & piac ----------
  crypto: {
    name: 'Kripto figyelőlista',
    icon: '₿',
    category: 'money',
    description: 'Több coin ára, 24 órás változás és 7 napos görbe (CoinGecko, kulcs nélkül).',
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    component: Crypto,
    defaultConfig: { coins: 'bitcoin, ethereum, solana', currency: 'eur' },
    fields: [
      { key: 'coins', label: 'Coinok (CoinGecko id, vesszővel)', placeholder: 'bitcoin, ethereum, solana, cardano' },
      { key: 'currency', label: 'Pénznem', type: 'select', options: [['eur', 'EUR'], ['usd', 'USD'], ['huf', 'HUF'], ['gbp', 'GBP']] },
    ],
  },
  currency: {
    name: 'Valutaváltó',
    icon: '⇄',
    category: 'money',
    description: 'Átváltás az EKB napi árfolyamaival, figyelt devizákkal.',
    size: { w: 3, h: 5, minW: 3, minH: 4 },
    component: Currency,
    defaultConfig: { from: 'EUR', to: 'HUF', watch: 'USD, GBP, CHF, HUF' },
    fields: [
      { key: 'from', label: 'Alap deviza', placeholder: 'EUR' },
      { key: 'to', label: 'Cél deviza', placeholder: 'HUF' },
      { key: 'watch', label: 'Figyelt devizák', placeholder: 'USD, GBP, CHF' },
    ],
  },
  stocks: {
    name: 'Tőzsde',
    icon: '↗',
    category: 'money',
    description: 'Részvények, indexek, arany és nyersanyagok, devizák, kripto. Piac szerint kereshető, grafikonnal és napi statisztikákkal.',
    size: { w: 4, h: 8, minW: 3, minH: 5 },
    component: Stocks,
    defaultConfig: { provider: 'auto', refreshMin: 5, symbols: [] },
    fields: [
      {
        key: 'provider',
        label: 'Adatszolgáltató',
        type: 'select',
        options: [
          ['auto', 'Automatikus (Twelve Data, ha van kulcs, különben TradingView)'],
          ['tradingview', 'TradingView (kulcs nélkül, minden piac)'],
          ['twelvedata', 'Twelve Data (ingyenes kulcs, saját grafikon)'],
          ['yahoo', 'Yahoo Finance (kulcs nélkül, gyakran blokkol)'],
        ],
        help: 'TradingView: kulcs nélkül, minden piac (BÉT, indexek, arany, deviza, kripto); a grafikon a TradingView beágyazott widgetje. Twelve Data: ingyenes kulcs (twelvedata.com → SECRET_TWELVEDATA_KEY a .env-be), saját grafikon és görbék, de percenként 8 lekérés, és a nem amerikai tőzsdék egy része fizetős. Yahoo: kulcs nélkül, de sok helyen (EU, felhő) blokkol.',
      },
      { key: 'defaultMarket', label: 'Alapértelmezett piac a keresőben', type: 'select', options: [['all', 'Mind'], ['us', 'USA'], ['eu', 'Európa'], ['hu', 'BÉT'], ['asia', 'Ázsia'], ['index', 'Indexek'], ['commodity', 'Nyersanyag'], ['fx', 'Deviza'], ['crypto', 'Kripto'], ['etf', 'ETF']] },
      { key: 'refreshMin', label: 'Frissítés (perc)', type: 'number', min: 1, help: 'Twelve Data ingyenes csomagnál 10+ perc ajánlott (napi 800 kérés).' },
    ],
  },
  github: {
    name: 'GitHub repók',
    icon: '⑂',
    category: 'data',
    description: 'Repók csillagai, forkjai, nyitott issue-k és a legfrissebb PR-ek.',
    size: { w: 4, h: 6, minW: 3, minH: 3 },
    component: GitHub,
    configureOnAdd: true,
    fields: [
      { key: 'repos', label: 'Repók (owner/repo, vesszővel)', placeholder: 'Kazemester/dashboard, vitejs/vite' },
      { key: 'token', label: 'Token (privát repókhoz / több kéréshez)', type: 'password', placeholder: '{{secret:GITHUB_TOKEN}}', help: 'Ha az .env-ben van SECRET_GITHUB_TOKEN, magától azt használja.' },
    ],
  },

  // ---------- Otthon & rendszer ----------
  system: {
    name: 'Szerver monitor',
    icon: '▥',
    category: 'home',
    description: 'A dashboardot futtató gép CPU, RAM, lemez, uptime és adatbázis-méret adatai.',
    size: { w: 4, h: 4, minW: 3, minH: 4 },
    component: SystemMonitor,
    defaultConfig: { intervalSec: 5 },
    fields: [{ key: 'intervalSec', label: 'Frissítés (mp)', type: 'number', min: 3 }],
  },
  uptime: {
    name: 'Szolgáltatás-figyelő',
    icon: '⇵',
    category: 'home',
    description: 'Elérhetők-e az oldalaid és eszközeid: státusz, válaszidő, előzmény.',
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    component: Uptime,
    configureOnAdd: true,
    defaultConfig: { intervalSec: 60, targets: [] },
    fields: [
      {
        key: 'targets',
        label: 'Figyelt címek',
        type: 'list',
        addLabel: 'Cím',
        fields: [
          { key: 'name', placeholder: 'Név' },
          { key: 'url', placeholder: 'https://… vagy http://192.168.1.10:8123' },
        ],
      },
      { key: 'intervalSec', label: 'Ellenőrzés (mp)', type: 'number', min: 15 },
    ],
  },
  homeassistant: {
    name: 'Home Assistant',
    icon: '⌂',
    category: 'home',
    description: 'Control Center-szerű vezérlő: lámpák, kapcsolók, jelenetek egy érintéssel, plusz szenzorértékek.',
    size: { w: 4, h: 6, minW: 3, minH: 3 },
    component: HomeAssistant,
    configureOnAdd: true,
    fields: [
      { key: 'baseUrl', label: 'Home Assistant URL', placeholder: '{{secret:HA_URL}}  (pl. http://homeassistant.local:8123)' },
      { key: 'token', label: 'Long-lived access token', type: 'password', placeholder: '{{secret:HA_TOKEN}}', help: 'HA → Profil → Biztonság → Long-lived access tokens. Üresen az .env SECRET_HA_URL / SECRET_HA_TOKEN értékét használja.' },
      { key: 'entities', label: 'Entitások (szóközzel vagy soronként)', type: 'textarea', placeholder: 'light.nappali\nswitch.kavefozo\nscene.mozi\nsensor.nappali_homerseklet' },
    ],
  },

  // ---------- AI ----------
  brief: {
    name: 'JARVIS napi brief',
    icon: '◎',
    category: 'ai',
    description: 'A többi csempéből (időjárás, naptár, teendők, szokások, levelek, visszaszámlálók) napi összefoglalót ír.',
    size: { w: 4, h: 6, minW: 3, minH: 4 },
    component: Brief,
    defaultConfig: { autoDaily: true, address: 'Uram', language: 'Hungarian' },
    fields: [
      { key: 'address', label: 'Megszólítás', placeholder: 'Uram / Zoli / Főnök' },
      { key: 'city', label: 'Város (üresen: az Időjárás csempéé)' },
      { key: 'autoDaily', label: 'Automatikus', type: 'checkbox', default: true, checkLabel: 'Naponta első megnyitáskor frissüljön' },
      { key: 'instructions', label: 'Extra utasítások', type: 'textarea', placeholder: 'pl. Légy tömör. Mindig említsd meg, ha esik.' },
      { key: 'language', label: 'Nyelv', placeholder: 'Hungarian' },
      { key: 'model', label: 'Modell (üresen: a fejléc AI beállításaiban megadott)' },
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
    key: 'preset-gold',
    type: 'stocks',
    name: 'Arany & nyersanyagok',
    icon: '◆',
    description: 'Tőzsde preset: arany, ezüst, WTI olaj USD-ben.',
    defaultConfig: { provider: 'auto', refreshMin: 5, symbols: [
      { ids: { tradingview: 'TVC:GOLD', twelvedata: 'XAU/USD', yahoo: 'GC=F' }, symbol: 'GOLD', name: 'Arany (USD/uncia)', type: 'commodity' },
      { ids: { tradingview: 'TVC:SILVER', twelvedata: 'XAG/USD', yahoo: 'SI=F' }, symbol: 'SILVER', name: 'Ezüst (USD/uncia)', type: 'commodity' },
      { ids: { tradingview: 'NYMEX:CL1!', twelvedata: 'WTI/USD', yahoo: 'CL=F' }, symbol: 'WTI', name: 'WTI kőolaj (USD/hordó)', type: 'commodity' },
    ] },
  },
  {
    key: 'preset-tech',
    type: 'stocks',
    name: 'Tech részvények',
    icon: '↗',
    description: 'Tőzsde preset: Apple, Microsoft, NVIDIA, SpaceX (NASDAQ).',
    defaultConfig: { provider: 'auto', refreshMin: 5, symbols: [
      { ids: { tradingview: 'NASDAQ:AAPL', twelvedata: 'AAPL:NASDAQ', yahoo: 'AAPL' }, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
      { ids: { tradingview: 'NASDAQ:MSFT', twelvedata: 'MSFT:NASDAQ', yahoo: 'MSFT' }, symbol: 'MSFT', name: 'Microsoft', type: 'stock' },
      { ids: { tradingview: 'NASDAQ:NVDA', twelvedata: 'NVDA:NASDAQ', yahoo: 'NVDA' }, symbol: 'NVDA', name: 'NVIDIA', type: 'stock' },
      { ids: { tradingview: 'NASDAQ:SPCX', twelvedata: 'SPCX:NASDAQ', yahoo: 'SPCX' }, symbol: 'SPCX', name: 'Space Exploration Technologies (SpaceX)', type: 'stock' },
    ] },
  },
  {
    key: 'preset-bet',
    type: 'stocks',
    name: 'Budapesti tőzsde',
    icon: '₣',
    description: 'Tőzsde preset: BUX index, OTP, MOL, Richter, Magyar Telekom (BÉT, forintban).',
    defaultConfig: { provider: 'auto', refreshMin: 10, defaultMarket: 'hu', symbols: [
      { ids: { tradingview: 'BET:OTP', twelvedata: 'OTP:BSE' }, symbol: 'OTP', name: 'OTP Bank', type: 'stock', region: 'hu' },
      { ids: { tradingview: 'BET:MOL', twelvedata: 'MOL:BSE' }, symbol: 'MOL', name: 'MOL', type: 'stock', region: 'hu' },
      { ids: { tradingview: 'BET:RICHTER', twelvedata: 'RICHT:BSE' }, symbol: 'RICHTER', name: 'Richter Gedeon', type: 'stock', region: 'hu' },
      { ids: { tradingview: 'BET:MTELEKOM', twelvedata: 'MTEL:BSE' }, symbol: 'MTEL', name: 'Magyar Telekom', type: 'stock', region: 'hu' },
      { ids: { tradingview: 'BET:BUX' }, symbol: 'BUX', name: 'BUX index', type: 'index', region: 'hu' },
    ] },
  },
  {
    key: 'preset-water',
    type: 'counter',
    name: 'Vízfogyasztás',
    icon: '◌',
    description: 'Napi számláló preset: 8 pohár víz naponta.',
    defaultConfig: { goal: 8, step: 1, unit: 'pohár' },
  },
  {
    key: 'preset-weight',
    type: 'metric',
    name: 'Testsúly',
    icon: '⚖',
    description: 'Mérésnapló preset: testsúly kg-ban, céllal.',
    defaultConfig: { unit: 'kg', decimals: 1, rangeDays: 90 },
  },
  {
    key: 'preset-sleep',
    type: 'metric',
    name: 'Alvás',
    icon: '☾',
    description: 'Mérésnapló preset: alvás órában, 8 órás céllal.',
    defaultConfig: { unit: 'óra', decimals: 1, rangeDays: 30, goal: 8 },
  },
  {
    key: 'preset-youtube',
    type: 'news',
    name: 'YouTube csatornák',
    icon: '▷',
    description: 'Hírek preset: YouTube csatornák új videói (channel_id kell).',
    defaultConfig: { feeds: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ', limit: 10 },
    configureOnAdd: true,
  },
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
  ...PRESETS.map((p) => ({ ...REGISTRY[p.type], configureOnAdd: false, ...p })),
];
