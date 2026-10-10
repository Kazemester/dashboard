# NEXUS // Command Deck

Saját hosztolású, minimalista, JARVIS-szerű személyes dashboard csempékből (widgetekből). Úgy működik, mint az iPhone Control Center vagy a widgetek: egy katalógusból választasz modult, a rácsra teszed, áthelyezed, átméretezed. Minden (elrendezés, beállítások, pomodoro-statisztika, szokások, célok, chat-előzmények) **a saját PostgreSQL adatbázisodba** mentődik, és Docker Compose-zal fut. Ugyanez a csomag később egy VM-re is felrakható.

![NEXUS dashboard](docs/screenshot.png)

## Gyors indítás

```bash
cp .env.example .env        # opcionális: AI kulcs, IMAP, titkok
docker compose up -d --build
```

Utána nyisd meg: **http://localhost:3000**

Az első indításkor üres a fedélzet, és megnyílik a modul-katalógus.

- **+ Modul**: új csempe hozzáadása a katalógusból
- **Szerkesztés**: a csempék szaggatott keretet kapnak, ilyenkor a fejlécüknél fogva húzhatók, a jobb alsó sarkuknál átméretezhetők, a ✕-szel törölhetők
- **⚙**: az adott csempe beállításai (cím, adatforrás, megjelenítés…)

## Modulok

32 modultípus és több kész preset, kategóriánként. A legtöbbhöz **nem kell fiók vagy API-kulcs**.

**Fókusz & feladatok**
| Modul | Mit csinál |
|---|---|
| ◴ Pomodoro | Fókusz / szünet körök, hangjelzés, értesítés, heti fókuszpercek. Oldalfrissítés után is fut. |
| ◈ Szokáskövető | Havi rács (1-jétől a hónap végéig), ‹ › lapozás. A sorok a felvétel hónapjától látszanak, eltávolítani hónaponként lehet. |
| ▤ Progress sávok | Bővíthető célok sávként vagy oszlopdiagramként, előzmény-görbével |
| ☑ Teendők | Feladatlista határidőkkel, a lejártak kiemelve |
| ✎ Jegyzet | Gyors jegyzetfüzet automatikus mentéssel |
| ⧗ Visszaszámláló | Napok a fontos eseményekig, évente ismétlődő eseményekkel (születésnap) |
| ⏱ Stopper / időzítő | Stopper körökkel, időzítő gyorsgombokkal és hangjelzéssel |

**Élet & egészség**
| Modul | Mit csinál |
|---|---|
| ⊕ Napi számláló | Víz, kávé, fekvőtámasz… napi céllal és 14 napos előzménnyel (presetek: Vízfogyasztás) |
| ◑ Hangulatnapló | Napi hangulat 1–5, havi naptárban, átlaggal |
| ∿ Mérésnapló | Számértékek grafikonon céllal és változással (presetek: Testsúly, Alvás) |
| ¤ Költségkövető | Havi kiadások kategóriánként, kerettel és hó végi becsléssel |
| ◔ Idő haladása | Nap / hét / hónap / év, és opcionálisan az élet százalékban |

**Info**
| Modul | Mit csinál |
|---|---|
| ☁ Időjárás | Aktuális idő + 5 napos előrejelzés (Open-Meteo) |
| ≈ Levegő & pollen | Európai AQI, PM2.5/PM10, UV, pollen (parlagfű, fű, nyír, éger, üröm) |
| ☾ Nap & Hold | Napkelte/napnyugta, a Nap útja, nappal hossza és változása, holdfázis |
| ▦ Naptár | Google / iCloud / Outlook iCal linkkel |
| ≋ Hírek (RSS) | Bármilyen RSS/Atom feed (preset: YouTube csatornák) |
| ❝ Napi idézet | Naponta új idézet, saját idézetekkel bővíthető |
| ⌘ Gyorslinkek | Ikonos gyorsindító |
| ▣ Képkeret | Képek / webkamera URL-ből, diavetítéssel |
| ◷ Világóra | Analóg óra + időzónák |

**Pénz & piac**
| Modul | Mit csinál |
|---|---|
| ₿ Kripto figyelőlista | Árak, 24 órás változás, 7 napos görbe (CoinGecko) |
| ⇄ Valutaváltó | Átváltás EKB árfolyammal, figyelt devizák |
| ↗ Tőzsde | Részvények, indexek, arany és nyersanyagok, devizák, kripto. Piac szerint kereshető, grafikonnal és napi statisztikákkal (presetek: Arany & nyersanyagok, Tech részvények, Budapesti tőzsde) |

**Otthon & rendszer**
| Modul | Mit csinál |
|---|---|
| ▥ Szerver monitor | CPU, RAM, lemez, uptime, DB méret a dashboardot futtató gépről |
| ⇵ Szolgáltatás-figyelő | Elérhetők-e az oldalaid és eszközeid: státusz, válaszidő, előzmény |
| ⌂ Home Assistant | Control Center-szerű kapcsolók (lámpa, kapcsoló, jelenet…) és szenzorértékek |

**Adat & API**
| Modul | Mit csinál |
|---|---|
| ⌁ API connector | Bármilyen JSON API (presetek: Bitcoin, EUR/HUF, Hacker News) |
| ⑂ GitHub repók | Csillagok, forkok, nyitott issue-k/PR-ek |
| ⧉ Beágyazás | Bármilyen beágyazható oldal: Grafana, YouTube, Spotify, Google Sheets… |

**AI**
| Modul | Mit csinál |
|---|---|
| ◎ JARVIS napi brief | A többi csempe adataiból napi összefoglaló. AI kulcs nélkül is működik (egyszerű szöveges összefoglaló). |
| ◉ AI Chat | Chat Grokkal / bármilyen OpenAI-kompatibilis modellel |
| ✉ Mail bot | IMAP-on átnézi a leveleket, kiemeli a fontosakat, teendőlistát ír |

![Modul katalógus](docs/catalog.png)

<details><summary>További képek</summary>

![](docs/screenshot-2.png)
![](docs/screenshot-3.png)

</details>

### Tőzsde csempe

![Keresés](docs/stocks-search.png) ![Részletek](docs/stocks-detail.png)

- **Keresés piac szerint:** Mind / USA / Európa / BÉT / Ázsia / Indexek / Nyersanyag / Deviza / Kripto / ETF. A köznapi nevek is működnek: „space x” → SPCX (NASDAQ), „arany” → XAU/USD, „olaj”, „forint”, „bitcoin”.
- **Figyelőlista:** árfolyam, napi változás, néhány napos görbe. Egy sorra kattintva részletes grafikon jelenik meg (1N / 5N / 1H / 6H / 1É / 5É), és látszik az előző záró, a napi és az 52 hetes csúcs és mélypont, a forgalom, valamint hogy nyitva van-e a tőzsde.
- **Adatszolgáltató** (csempénként állítható):
  - **Twelve Data:** [ingyenes kulcs](https://twelvedata.com/pricing), utána `SECRET_TWELVEDATA_KEY=...` a `.env`-be. Stabil, napi 800 és percenként 8 lekérést enged; a szerver ütemezi a kéréseket, hogy beleférjen. A nem amerikai tőzsdék (pl. BÉT, XETRA) egy része csak a fizetős csomagban érhető el, ilyenkor a csempe soronként kiírja a hibát.
  - **Yahoo Finance:** kulcs nélkül, szinte minden piac (BÉT, indexek, határidős arany). Nem hivatalos API, ezért felhős vagy VM IP-ről gyakran korlátoz; otthoni gépen általában működik.
  - Ha van Twelve Data kulcs, alapból azt használja, ha nincs, a Yahoot.
- Az árak szolgáltatótól függően néhány perc késéssel érkezhetnek. Tájékoztató jellegűek, kereskedési döntéshez ne erre támaszkodj.

### Home Assistant bekötése

1. HA → Profil → Biztonság → **Long-lived access tokens** → Token létrehozása
2. `.env`: `SECRET_HA_URL=http://homeassistant.local:8123` és `SECRET_HA_TOKEN=...`
3. A csempe beállításainál sorold fel az entitásokat (`light.nappali`, `switch.kavefozo`, `scene.mozi`, `sensor.homerseklet`…).

A lámpák, kapcsolók, ventilátorok, redőnyök, automatizmusok egy érintéssel kapcsolhatók, a jelenetek és scriptek futtathatók. A szenzorok csak olvashatók.

### Naptár bekötése

- **Google Calendar:** Beállítások → a naptárad → *Naptár integrálása* → **„Titkos cím iCal formátumban”**
- **iCloud:** Naptár app → a naptár melletti megosztás ikon → **„Nyilvános naptár”** → másold ki a `webcal://…` linket (a `webcal://` működik)
- **Outlook / Proton / Nextcloud:** a naptár ICS publikálási linkje

A titkos linkeket nem kell a DB-be menteni. Tedd be őket a `.env`-be (`SECRET_GCAL=https://…`), és a widgetben így hivatkozz rájuk: `{{secret:GCAL}}`.

### AI: Grok vagy bármi más

Az AI modulok **OpenAI-kompatibilis** API-t használnak, ezért több szolgáltatóval is működnek:

```env
# xAI Grok (alapértelmezett), kulcs: https://console.x.ai
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=xai-...
LLM_MODEL=grok-4

# vagy teljesen lokálisan, Ollamával (a leveleid nem hagyják el a gépet):
# LLM_BASE_URL=http://host.docker.internal:11434/v1
# LLM_MODEL=llama3.1
```

A modellt widgetenként is felülírhatod.

### Mail bot (a „grokbot”)

1. Csinálj **app jelszót** (Gmail: Google fiók → Biztonság → Alkalmazásjelszavak; iCloud: appleid.apple.com → Alkalmazásspecifikus jelszó).
2. Töltsd ki a `.env`-ben: `SECRET_IMAP_HOST`, `SECRET_IMAP_USER`, `SECRET_IMAP_PASSWORD`.
   - Gmail: `imap.gmail.com` · iCloud: `imap.mail.me.com` · Outlook: `outlook.office365.com`
3. Tedd fel a **Mail bot** modult. A beállításoknál megadhatod:
   - hány órára visszamenőleg nézzen leveleket, és csak az olvasatlanokat-e,
   - **saját szabályokat** (pl. *„A banki és NAV levelek mindig fontosak, a LinkedIn értesítéseket hagyd ki.”*),
   - **automatikus futást** X percenként. Ilyenkor a szerver a háttérben akkor is lefuttatja, ha a böngésző zárva van.

A bot csak olvas (`BODY.PEEK`), ezért a levelek nem lesznek olvasottnak jelölve. Több postafiókhoz tegyél fel több Mail bot csempét, mindegyiknek saját IMAP adatokkal (pl. `{{secret:WORK_IMAP_PASSWORD}}`).

> ⚠️ **Adatvédelem:** felhős LLM esetén (Grok, OpenAI) a levelek tárgya, feladója és szövegének eleje a szolgáltatóhoz kerül. Ha ezt nem szeretnéd, használj lokális modellt (Ollama).

### API connector példák

| Mire | URL | JSON útvonal |
|---|---|---|
| Kripto ár | `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur` | `ethereum.eur` |
| GitHub csillagok | `https://api.github.com/repos/OWNER/REPO` | `stargazers_count` |
| Home Assistant szenzor | `http://homeassistant.local:8123/api/states/sensor.nappali_homerseklet`, fejléc: `{"Authorization":"Bearer {{secret:HA_TOKEN}}"}` | `state` |
| NewsAPI | `https://newsapi.org/v2/top-headlines?country=us&apiKey={{secret:NEWSAPI}}` | `articles` (lista, szöveg mező: `title`, link: `url`) |

A kérést a szerver küldi el, így nincs CORS-probléma, és a `{{secret:…}}` kulcsok sosem jutnak el a böngészőbe.

## Fejlesztés (Docker nélkül)

```bash
# adatbázis (vagy bármilyen helyi Postgres)
docker run -d --name nexus-pg -e POSTGRES_USER=nexus -e POSTGRES_PASSWORD=nexus -p 5432:5432 postgres:16-alpine

cd server && npm install && DATABASE_URL=postgres://nexus:nexus@localhost:5432/nexus npm run dev
cd client && npm install && npm run dev      # http://localhost:5173 (a /api-t a :3000-re proxyzza)
```

### Saját modul hozzáadása

1. `client/src/widgets/MyWidget.jsx`: React komponens, ami `{ widget, editing, onConfigure }` propokat kap (`widget.config` a beállítás).
2. Regisztráld a `client/src/widgets/registry.js`-ben (név, ikon, méret, `fields` a beállító űrlaphoz). Az űrlap automatikusan generálódik.
3. Ha szerveroldali adat kell: új route a `server/src/routes/` alatt, és táblák a `server/src/db.js` sémájában.

## Felrakás VM-re

1. Másold fel a repót, és hozd létre a `.env`-et **erős** `POSTGRES_PASSWORD`-del és `DASHBOARD_PASSWORD`-del (HTTP Basic auth).
2. `docker compose up -d --build`
3. Az app alapból csak `127.0.0.1:3000`-n figyel. Tegyél elé reverse proxyt HTTPS-sel, pl. **Caddy**:
   ```
   dash.sajatdomain.hu {
       reverse_proxy 127.0.0.1:3000
   }
   ```
   (Vagy `BIND_ADDR=0.0.0.0` a `.env`-ben, ha belső hálón vagy Tailscale-en éred el.)

**Mentés / visszaállítás:**
```bash
docker compose exec db pg_dump -U nexus nexus > backup.sql
docker compose exec -T db psql -U nexus nexus < backup.sql
```

## Architektúra

```
┌──────────── docker compose ────────────┐
│  app (Node 22)                          │      ┌─ Open-Meteo, RSS, iCal
│   ├─ Express API  /api/*  ──────────────┼─────►├─ tetszőleges JSON API
│   ├─ mail bot ütemező (háttér)          │      ├─ IMAP (Gmail/iCloud)
│   └─ React build (statikus)             │      └─ LLM (Grok / OpenAI / Ollama)
│            │                            │
│  db (PostgreSQL 16) ◄── volume: nexus-db│
└─────────────────────────────────────────┘
```

- **Frontend:** React 18 + Vite, `react-grid-layout` (drag & drop, átméretezés, reszponzív töréspontok)
- **Backend:** Node.js 22 + Express 5, `pg`, `node-ical`, `rss-parser`, `imapflow`
- **DB:** PostgreSQL 16. A séma induláskor automatikusan létrejön.

## Ötletek a folytatáshoz

- Google / Microsoft OAuth naptár (írás is, nem csak olvasás), Google Tasks / Todoist
- Telegram / Discord értesítés a Mail bot fontos leveleiről
- Több dashboard-oldal (Munka / Otthon), témaváltó (cyan / vörös riasztás / borostyán)
- Home Assistant vezérlő csempék (kapcsolók, mint a Control Centerben)
- PWA (telepíthető mobilra), több felhasználó
