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

| Modul | Mit csinál | Adat |
|---|---|---|
| ◴ **Pomodoro** | Fókusz, rövid és hosszú szünet, körök, hangjelzés, böngészős értesítés, heti fókuszperc-diagram. Oldalfrissítés után is fut tovább. | DB |
| ◈ **Szokáskövető** | Szokások napi pipálása 7–30 napos rácson, 🔥 sorozat (streak), napi teljesítés-sáv | DB |
| ▤ **Progress sávok** | Bővíthető célok (érték / cél / egység), vízszintes sávok vagy oszlopdiagram, +/− léptetés, előzmény-sparkline | DB |
| ▦ **Naptár** | Google, iCloud, Outlook stb. naptárak **iCal (.ics) linkkel**, ismétlődő eseményekkel, színkódolva | iCal |
| ☁ **Időjárás** | Aktuális idő + 5 napos előrejelzés | Open-Meteo (nem kell kulcs) |
| ≋ **Hírek (RSS)** | Több RSS/Atom csatorna összefésülve | RSS |
| ⌁ **API connector** | **Bármilyen** JSON API: nagy szám, lista vagy nyers JSON. Előre beállított példák: Bitcoin, EUR/HUF, Hacker News | bármi |
| ◉ **AI Chat** | Chat Grokkal (vagy bármilyen OpenAI-kompatibilis modellel), saját személyiség (system prompt), mentett előzmények | LLM |
| ✉ **Mail bot** | AI bot: IMAP-on átnézi az olvasatlan leveleket, összefoglal, kiemeli a fontosakat, teendőlistát ír, kategorizál. Kézzel vagy ütemezve fut. | IMAP + LLM |
| ◷ **Világóra** | Analóg óra + időzónák | – |

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
