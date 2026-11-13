export default {
  // Categories
  'Fókusz & feladatok': 'Focus & tasks',
  'Élet & egészség': 'Life & health',
  'Info': 'Info',
  'Pénz & piac': 'Money & markets',
  'Otthon & rendszer': 'Home & system',
  'Adat & API': 'Data & API',
  'AI': 'AI',

  // Pomodoro
  'Fókusz időzítő körökkel, értesítéssel és heti statisztikával.': 'Focus timer with rounds, notifications and weekly statistics.',
  'Fókusz (perc)': 'Focus (min)',
  'Rövid szünet (perc)': 'Short break (min)',
  'Hosszú szünet (perc)': 'Long break (min)',
  'Hosszú szünet minden N. kör után': 'Long break after every Nth round',
  'Automatikus folytatás': 'Auto-continue',
  'A következő kör magától indul': 'The next round starts automatically',

  // Habits
  'Szokáskövető': 'Habit tracker',
  'Havi rács (1-től a hónap végéig), lapozható hónapok, havonta bővíthető sorok.': 'Monthly grid (from the 1st to the end of the month), browsable months, rows extendable per month.',

  // Progress
  'Progress sávok': 'Progress bars',
  'Bővíthető célok sávokkal vagy oszlopdiagrammal, előzmény-sparkline-nal.': 'Expandable goals with bars or a column chart, plus a history sparkline.',
  'Megjelenítés': 'Display',
  'Vízszintes sávok': 'Horizontal bars',
  'Oszlopdiagram': 'Column chart',
  '+/− lépésköz': '+/− step',

  // Calendar
  'Naptár': 'Calendar',
  'Google, iCloud, Outlook naptárak iCal (.ics) linkkel, napokra bontva.': 'Google, iCloud and Outlook calendars via iCal (.ics) link, grouped by day.',
  'Előre napok': 'Days ahead',
  'Naptárak': 'Calendars',
  'Név': 'Name',
  'https://… .ics vagy webcal://…': 'https://… .ics or webcal://…',
  'Google: Naptár beállításai → „Titkos cím iCal formátumban”. iCloud: Naptár app → megosztás → „Nyilvános naptár” link. Titkos linket {{secret:NEV}} formában is megadhatsz (env: SECRET_NEV).': 'Google: Calendar settings → “Secret address in iCal format”. iCloud: Calendar app → share → “Public calendar” link. You can also enter a secret link as {{secret:NAME}} (env: SECRET_NAME).',

  // Weather
  'Időjárás': 'Weather',
  'Aktuális idő és 5 napos előrejelzés (Open-Meteo, kulcs nélkül).': 'Current conditions and a 5-day forecast (Open-Meteo, no key needed).',
  'Város': 'City',

  // News
  'Hírek (RSS)': 'News (RSS)',
  'Bármilyen RSS/Atom hírcsatorna egy listában.': 'Any RSS/Atom feeds in one list.',
  'RSS linkek (soronként egy)': 'RSS links (one per line)',
  'Max. hírek': 'Max. items',

  // API
  'API connector': 'API connector',
  'Bármilyen JSON API: érték, lista vagy nyers JSON. A kulcsok a szerveren maradnak.': 'Any JSON API: a value, a list or raw JSON. Keys stay on the server.',
  'Metódus': 'Method',
  'Fejlécek (JSON)': 'Headers (JSON)',
  'JSON útvonal': 'JSON path',
  'pl. data.items[0].price': 'e.g. data.items[0].price',
  'Pontokkal elválasztott útvonal a válaszon belül. Üresen a teljes válasz.': 'Dot-separated path within the response. Empty means the whole response.',
  'Automatikus': 'Automatic',
  'Nagy szám / érték': 'Big number / value',
  'Lista': 'List',
  'Nyers JSON': 'Raw JSON',
  'Előtag': 'Prefix',
  'Utótag': 'Suffix',
  ' Ft': ' Ft',
  'Tizedesjegyek': 'Decimals',
  'Felirat': 'Caption',
  'Lista: szöveg mező': 'List: text field',
  'Lista: link mező': 'List: link field',
  'Frissítés (mp)': 'Refresh (sec)',

  // Chat
  'AI Chat': 'AI Chat',
  'AI asszisztens, ami látja a dashboardodat: válaszol a csempék tartalmáról, és kérésre csempéket rak ki, teendőt vesz fel, témát vált.': 'An AI assistant that sees your dashboard: it answers questions about tile contents and, on request, adds tiles, creates to-dos and switches the theme.',
  'Hozzáférés a dashboardhoz': 'Dashboard access',
  'Olvashat és módosíthat (csempék, teendők, beállítások)': 'Can read and modify (tiles, to-dos, settings)',
  'Csak olvashat (válaszol a csempék tartalmáról)': 'Read-only (answers questions about tile contents)',
  'Nincs (sima chat)': 'None (plain chat)',
  'Csempét törölni csak a te jóváhagyásoddal tud. Az eszközhasználathoz olyan modell kell, ami ezt támogatja (pl. Grok, GPT, Ollamában qwen2.5 / qwen3 / llama3.1).': 'It can only delete a tile with your approval. Tool use requires a model that supports it (e.g. Grok, GPT, or qwen2.5 / qwen3 / llama3.1 in Ollama).',
  'Rendszer prompt / személyiség': 'System prompt / personality',
  'Modell (üresen: a fejléc AI beállításaiban megadott)': 'Model (empty: the one set in the header AI settings)',

  // Mail bot
  'Mail bot': 'Mail bot',
  'AI bot, ami IMAP-on átnézi a leveleidet, kiszűri a fontosakat és teendőlistát ír.': 'An AI bot that scans your mail over IMAP, picks out the important messages and writes a to-do list.',
  'IMAP szerver': 'IMAP server',
  '{{secret:IMAP_HOST}}  (pl. imap.gmail.com / imap.mail.me.com)': '{{secret:IMAP_HOST}}  (e.g. imap.gmail.com / imap.mail.me.com)',
  'Üresen az .env SECRET_IMAP_HOST / SECRET_IMAP_USER / SECRET_IMAP_PASSWORD értékeit használja.': 'If empty, it uses SECRET_IMAP_HOST / SECRET_IMAP_USER / SECRET_IMAP_PASSWORD from .env.',
  'Port': 'Port',
  '993 = SSL (a legtöbb szolgáltató), 143 = STARTTLS.': '993 = SSL (most providers), 143 = STARTTLS.',
  'Felhasználó': 'User',
  'App jelszó': 'App password',
  'Ajánlott a {{secret:…}} hivatkozás, így a jelszó nem kerül az adatbázisba.': 'A {{secret:…}} reference is recommended, so the password does not end up in the database.',
  'Mappa': 'Folder',
  'Elmúlt órák': 'Past hours',
  'Max. levél / futás': 'Max. mails / run',
  'Szűrés': 'Filter',
  'Csak olvasatlan levelek': 'Unread mails only',
  'Automatikus futás (perc, 0 = ki)': 'Auto run (min, 0 = off)',
  'Extra szabályok a botnak': 'Extra rules for the bot',
  'pl. A banki és NAV levelek mindig fontosak. A LinkedIn értesítéseket hagyd ki.': 'e.g. Bank and tax office mails are always important. Skip LinkedIn notifications.',
  'Nyelv': 'Language',

  // Render
  'Látványterv': 'Visualization',
  'Vázlatból vagy SketchUp / Revit képernyőképből fotórealisztikus látványterv, a gépeden futó ComfyUI-jal (Stable Diffusion / FLUX + ControlNet).': 'Photorealistic visualization from a sketch or a SketchUp / Revit screenshot, using ComfyUI running on your machine (Stable Diffusion / FLUX + ControlNet).',
  'ComfyUI címe': 'ComfyUI address',
  'ComfyUI Desktop alkalmazás: http://host.docker.internal:8000 · kézi telepítés: http://host.docker.internal:8188. Üresen a COMFYUI_URL környezeti változó vagy a 8188-as port.': 'ComfyUI Desktop app: http://host.docker.internal:8000 · manual install: http://host.docker.internal:8188. If empty, the COMFYUI_URL environment variable or port 8188 is used.',
  'Lépések (több = lassabb, részletesebb)': 'Steps (more = slower, more detailed)',
  'CFG (mennyire kövesse a promptot)': 'CFG (how closely to follow the prompt)',
  'SDXL / SD1.5: 5–7. Turbo / Lightning modellekhez 1–2 és 6–8 lépés.': 'SDXL / SD1.5: 5–7. For Turbo / Lightning models: 1–2 and 6–8 steps.',
  'Felbontás': 'Resolution',
  '0,5 MP (SD 1.5 modellekhez, gyors)': '0.5 MP (for SD 1.5 models, fast)',
  '1 MP (SDXL / FLUX, ~1024×1024)': '1 MP (SDXL / FLUX, ~1024×1024)',
  '1,5 MP (lassabb)': '1.5 MP (slower)',
  'Negatív prompt (amit ne rajzoljon)': 'Negative prompt (what not to draw)',

  // Todo
  'Teendők': 'To-dos',
  'Feladatlista határidőkkel, a lejártak kiemelve. A JARVIS brief is látja.': 'Task list with due dates, overdue ones highlighted. The JARVIS brief sees it too.',
  'Kész feladatok': 'Completed tasks',
  'Elrejtés': 'Hide',

  // Notes
  'Jegyzet': 'Note',
  'Gyors jegyzetfüzet automatikus mentéssel.': 'Quick notepad with automatic saving.',

  // Countdown
  'Visszaszámláló': 'Countdown',
  'Napok a fontos eseményekig: nyaralás, határidő, születésnap (évente ismétlődő is).': 'Days until important events: vacation, deadline, birthday (yearly recurring too).',
  'Események': 'Events',
  'Esemény': 'Event',
  'évente': 'yearly',
  'Elmúlt események': 'Past events',
  'Mutasd azokat is': 'Show those too',

  // Stopwatch
  'Stopper / időzítő': 'Stopwatch / timer',
  'Stopper körökkel és gyors időzítő hangjelzéssel. Újratöltés után is fut.': 'Stopwatch with laps and a quick timer with an audible alert. Keeps running after a reload.',

  // Counter
  'Napi számláló': 'Daily counter',
  'Bármi, amit naponta számolsz: víz, kávé, fekvőtámasz, lépések. Napi céllal és 14 napos előzménnyel.': 'Anything you count daily: water, coffee, push-ups, steps. With a daily goal and a 14-day history.',
  'Napi cél (0 = nincs)': 'Daily goal (0 = none)',
  'Lépésköz': 'Step',
  'Egység': 'Unit',
  'pohár / csésze / db': 'glass / cup / pcs',

  // Mood
  'Hangulatnapló': 'Mood journal',
  'Napi hangulat 1–5 skálán, havi naptárnézetben, átlaggal.': 'Daily mood on a 1–5 scale, in a monthly calendar view, with an average.',

  // Metric
  'Mérésnapló': 'Measurement log',
  'Számértékek grafikonon: testsúly, alvás, pulzus, vérnyomás, futóidő. Céllal és változással.': 'Numeric values on a chart: weight, sleep, pulse, blood pressure, run time. With a goal and change.',
  'kg / óra / bpm': 'kg / hours / bpm',
  'Cél (opcionális)': 'Goal (optional)',
  'Megjelenített időszak (nap)': 'Displayed period (days)',

  // Expenses
  'Költségkövető': 'Expense tracker',
  'Havi kiadások kategóriánként, kerettel és hó végi becsléssel. Lapozható hónapok.': 'Monthly expenses by category, with a budget and an end-of-month estimate. Browsable months.',
  'Havi keret (0 = nincs)': 'Monthly budget (0 = none)',
  'Pénznem': 'Currency',
  'Kategóriák (vesszővel)': 'Categories (comma-separated)',

  // Time progress
  'Idő haladása': 'Time progress',
  'Mennyi telt el a napból, hétből, hónapból, évből és opcionálisan az életedből.': 'How much of the day, week, month, year and optionally your life has elapsed.',
  'Születési év (opcionális)': 'Birth year (optional)',
  'Születési hónap': 'Birth month',
  'Várható élettartam (év)': 'Life expectancy (years)',

  // Air
  'Levegő & pollen': 'Air & pollen',
  'Európai légminőség-index, PM2.5 / PM10, UV, és pollen (parlagfű, fű, nyír…).': 'European air quality index, PM2.5 / PM10, UV and pollen (ragweed, grass, birch…).',

  // Sun
  'Nap & Hold': 'Sun & Moon',
  'Napkelte, napnyugta, a Nap útja, nappal hossza, holdfázis.': 'Sunrise, sunset, the Sun’s path, day length, moon phase.',

  // Quote
  'Napi idézet': 'Daily quote',
  'Naponta új idézet (kattintásra a következő). Saját idézeteket is megadhatsz.': 'A new quote every day (click for the next one). You can add your own quotes too.',
  'Saját idézetek (soronként: szöveg — szerző)': 'Your own quotes (one per line: text — author)',
  'Csak a sajátok': 'Only your own',
  'Csak a saját idézeteim': 'Only my own quotes',

  // Links
  'Gyorslinkek': 'Quick links',
  'Ikonos gyorsindító a kedvenc oldalaidhoz és szolgáltatásaidhoz.': 'Icon launcher for your favorite sites and services.',
  'Linkek': 'Links',
  'Link': 'Link',
  'Ikonok': 'Icons',
  'Favicon mutatása': 'Show favicons',

  // Image
  'Képkeret': 'Picture frame',
  'Képek vagy webkamera URL-ből, diavetítéssel.': 'Images or a webcam from a URL, as a slideshow.',
  'Kép URL-ek (soronként egy)': 'Image URLs (one per line)',
  'Váltás (mp)': 'Switch every (sec)',
  'Kitöltés': 'Fit',
  'Kitölt (vág)': 'Fill (crop)',
  'Teljes kép': 'Whole image',
  'Webkamera': 'Webcam',
  'Kép újratöltése minden váltáskor': 'Reload the image on every switch',

  // Embed
  'Beágyazás': 'Embed',
  'Bármilyen weboldal csempeként: Grafana, Home Assistant, YouTube, Spotify, Google Sheets.': 'Any web page as a tile: Grafana, Home Assistant, YouTube, Spotify, Google Sheets.',
  'Néhány oldal (pl. Google kereső, GitHub) letiltja a beágyazást. Ezeket nem lehet csempébe tenni.': 'Some sites (e.g. Google Search, GitHub) block embedding. These cannot be put in a tile.',

  // Crypto
  'Kripto figyelőlista': 'Crypto watchlist',
  'Több coin ára, 24 órás változás és 7 napos görbe (CoinGecko, kulcs nélkül).': 'Prices of several coins, 24-hour change and a 7-day curve (CoinGecko, no key needed).',
  'Coinok (CoinGecko id, vesszővel)': 'Coins (CoinGecko id, comma-separated)',

  // Currency
  'Valutaváltó': 'Currency converter',
  'Átváltás az EKB napi árfolyamaival, figyelt devizákkal.': 'Conversion using the ECB daily rates, with watched currencies.',
  'Alap deviza': 'Base currency',
  'Cél deviza': 'Target currency',
  'Figyelt devizák': 'Watched currencies',

  // Stocks
  'Tőzsde': 'Stocks',
  'Részvények, indexek, arany és nyersanyagok, devizák, kripto. Piac szerint kereshető, grafikonnal és napi statisztikákkal.': 'Stocks, indices, gold and commodities, currencies, crypto. Searchable by market, with a chart and daily statistics.',
  'Adatszolgáltató': 'Data provider',
  'Automatikus (Twelve Data, ha van kulcs, különben TradingView)': 'Automatic (Twelve Data if there is a key, otherwise TradingView)',
  'TradingView (kulcs nélkül, minden piac)': 'TradingView (no key, all markets)',
  'Twelve Data (ingyenes kulcs, saját grafikon)': 'Twelve Data (free key, own chart)',
  'Yahoo Finance (kulcs nélkül, gyakran blokkol)': 'Yahoo Finance (no key, often blocks)',
  'TradingView: kulcs nélkül, minden piac (BÉT, indexek, arany, deviza, kripto); a grafikon a TradingView beágyazott widgetje. Twelve Data: ingyenes kulcs (twelvedata.com → SECRET_TWELVEDATA_KEY a .env-be), saját grafikon és görbék, de percenként 8 lekérés, és a nem amerikai tőzsdék egy része fizetős. Yahoo: kulcs nélkül, de sok helyen (EU, felhő) blokkol.': 'TradingView: no key, all markets (BSE, indices, gold, forex, crypto); the chart is TradingView’s embedded widget. Twelve Data: free key (twelvedata.com → SECRET_TWELVEDATA_KEY in .env), own chart and curves, but 8 requests per minute, and some non-US exchanges are paid. Yahoo: no key, but it blocks in many places (EU, cloud).',
  'Alapértelmezett piac a keresőben': 'Default market in search',
  'USA': 'USA',
  'Európa': 'Europe',
  'BÉT': 'BSE',
  'Ázsia': 'Asia',
  'Indexek': 'Indices',
  'Nyersanyag': 'Commodities',
  'Deviza': 'Forex',
  'Kripto': 'Crypto',
  'ETF': 'ETF',
  'Frissítés (perc)': 'Refresh (min)',
  'Twelve Data ingyenes csomagnál 10+ perc ajánlott (napi 800 kérés).': 'With the free Twelve Data plan 10+ minutes is recommended (800 requests per day).',

  // GitHub
  'GitHub repók': 'GitHub repos',
  'Repók csillagai, forkjai, nyitott issue-k és a legfrissebb PR-ek.': 'Repo stars, forks, open issues and the latest PRs.',
  'Repók (owner/repo, vesszővel)': 'Repos (owner/repo, comma-separated)',
  'Token (privát repókhoz / több kéréshez)': 'Token (for private repos / more requests)',
  'Ha az .env-ben van SECRET_GITHUB_TOKEN, magától azt használja.': 'If .env contains SECRET_GITHUB_TOKEN, it is used automatically.',

  // System
  'Szerver monitor': 'Server monitor',
  'A dashboardot futtató gép CPU, RAM, lemez, uptime és adatbázis-méret adatai.': 'CPU, RAM, disk, uptime and database size of the machine running the dashboard.',

  // Uptime
  'Szolgáltatás-figyelő': 'Service monitor',
  'Elérhetők-e az oldalaid és eszközeid: státusz, válaszidő, előzmény.': 'Whether your sites and devices are reachable: status, response time, history.',
  'Figyelt címek': 'Monitored addresses',
  'https://… vagy http://192.168.1.10:8123': 'https://… or http://192.168.1.10:8123',
  'Ellenőrzés (mp)': 'Check (sec)',

  // Home Assistant
  'Control Center-szerű vezérlő: lámpák, kapcsolók, jelenetek egy érintéssel, plusz szenzorértékek.': 'Control Center–style controller: lights, switches and scenes with one tap, plus sensor values.',
  '{{secret:HA_URL}}  (pl. http://homeassistant.local:8123)': '{{secret:HA_URL}}  (e.g. http://homeassistant.local:8123)',
  'HA → Profil → Biztonság → Long-lived access tokens. Üresen az .env SECRET_HA_URL / SECRET_HA_TOKEN értékét használja.': 'HA → Profile → Security → Long-lived access tokens. If empty, it uses SECRET_HA_URL / SECRET_HA_TOKEN from .env.',
  'Entitások (szóközzel vagy soronként)': 'Entities (space- or line-separated)',

  // Brief
  'JARVIS napi brief': 'JARVIS daily brief',
  'A többi csempéből (időjárás, naptár, teendők, szokások, levelek, visszaszámlálók) napi összefoglalót ír.': 'Writes a daily summary from the other tiles (weather, calendar, to-dos, habits, mail, countdowns).',
  'Megszólítás': 'Form of address',
  'Uram / Zoli / Főnök': 'Sir / Zoli / Boss',
  'Város (üresen: az Időjárás csempéé)': 'City (empty: the Weather tile’s)',
  'Automatikus': 'Automatic',
  'Naponta első megnyitáskor frissüljön': 'Refresh on first open each day',
  'Extra utasítások': 'Extra instructions',
  'pl. Légy tömör. Mindig említsd meg, ha esik.': 'e.g. Be concise. Always mention it if it rains.',

  // Clock
  'Világóra': 'World clock',
  'Analóg óra és tetszőleges időzónák.': 'Analog clock and any time zones you like.',
  'Időzónák (vesszővel)': 'Time zones (comma-separated)',

  // Presets
  'Arany & nyersanyagok': 'Gold & commodities',
  'Tőzsde preset: arany, ezüst, WTI olaj USD-ben.': 'Stocks preset: gold, silver, WTI oil in USD.',
  'Tech részvények': 'Tech stocks',
  'Tőzsde preset: Apple, Microsoft, NVIDIA, SpaceX (NASDAQ).': 'Stocks preset: Apple, Microsoft, NVIDIA, SpaceX (NASDAQ).',
  'Budapesti tőzsde': 'Budapest Stock Exchange',
  'Tőzsde preset: BUX index, OTP, MOL, Richter, Magyar Telekom (BÉT, forintban).': 'Stocks preset: BUX index, OTP, MOL, Richter, Magyar Telekom (BSE, in forints).',
  'Vízfogyasztás': 'Water intake',
  'Napi számláló preset: 8 pohár víz naponta.': 'Daily counter preset: 8 glasses of water per day.',
  'Testsúly': 'Body weight',
  'Mérésnapló preset: testsúly kg-ban, céllal.': 'Measurement log preset: body weight in kg, with a goal.',
  'Alvás': 'Sleep',
  'Mérésnapló preset: alvás órában, 8 órás céllal.': 'Measurement log preset: sleep in hours, with an 8-hour goal.',
  'YouTube csatornák': 'YouTube channels',
  'Hírek preset: YouTube csatornák új videói (channel_id kell).': 'News preset: new videos from YouTube channels (channel_id required).',
  'Bitcoin árfolyam': 'Bitcoin price',
  'CoinGecko — BTC ár USD-ben (API connector preset).': 'CoinGecko — BTC price in USD (API connector preset).',
  'EUR/HUF árfolyam': 'EUR/HUF rate',
  'Frankfurter (EKB) — napi euró árfolyam (API connector preset).': 'Frankfurter (ECB) — daily euro exchange rate (API connector preset).',
  'Algolia HN API — kiemelt posztok listája (API connector preset).': 'Algolia HN API — list of front-page posts (API connector preset).',
};
