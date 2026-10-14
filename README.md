# NEXUS // Command Deck

Saját hosztolású, minimalista, JARVIS-szerű személyes dashboard csempékből (widgetekből). Úgy működik, mint az iPhone Control Center vagy a widgetek: egy katalógusból választasz modult, a rácsra teszed, áthelyezed, átméretezed. Minden (elrendezés, beállítások, pomodoro-statisztika, szokások, célok, chat-előzmények) **a saját PostgreSQL adatbázisodba** mentődik, és Docker Compose-zal fut. Ugyanez a csomag később egy VM-re is felrakható.

![NEXUS dashboard](docs/screenshot.png)

## Gyors indítás

```bash
cp .env.example .env        # opcionális: IMAP, titkok (az AI kulcs a felületen is megadható)
docker compose up -d --build
```

Utána nyisd meg: **http://localhost:3000**

Az első indításkor üres a fedélzet, és megnyílik a modul-katalógus.

- **Végtelen vászon** (asztali gépen, a draw.io mintájára): a csempék szabadon elhelyezhetők minden irányban, a vászon magától nő
  - mozgatás: az üres háttér húzása, görgő vagy touchpad, középső egérgomb, vagy **szóköz + húzás**
  - nagyítás: **Ctrl/⌘ + görgő** vagy csippentés, mindig a kurzor felé; −/+, 100% és **⤢ Mindent mutat** gomb jobb alul
  - **minitérkép** bal alul: kattints vagy húzd, és odaugrik
  - **Rendezés** gomb a fejlécben: egy kattintással hézag nélküli, a képernyő arányához igazított rácsba rendezi a csempéket (12 másodpercig visszavonható)
  - húzás közben a csempe a kurzort követi; ha foglalt helyre engednéd el, szaggatott keret mutatja, melyik legközelebbi szabad helyre kerül. Átméretezéskor a kitakart szomszédok húzódnak arrébb
  - kicsinyítve (50% alatt) szerkesztéskor az egész csempe megfogható, nem csak a fejléce
  - telefonon a csempék egymás alatt jelennek meg (görgethető lista)
- **+ Modul**: új csempe hozzáadása a katalógusból (a képernyő közepére, az első szabad helyre)
- **Szerkesztés**: a csempék szaggatott keretet kapnak, ilyenkor a fejlécüknél fogva húzhatók, a jobb alsó sarkuknál átméretezhetők, a ✕-szel törölhetők

![Végtelen vászon](docs/canvas.png)
- **⚙**: az adott csempe beállításai (cím, adatforrás, megjelenítés…)

## Megjelenés

A fejléc mindig látszik, görgetés közben is. A **Téma** gombbal 7 kész téma közül választhatsz (JARVIS, Borostyán, Vörös riasztás, Terminál, Ibolya, Grafit, Világos), és külön beállíthatod a **háttér** és a **kiemelés** színét. A szövegszín magától igazodik a háttér világosságához. A beállítás az adatbázisba mentődik, így minden eszközön és böngészőben ugyanaz jelenik meg.

![Témaválasztó](docs/theme-picker.png)

## Modulok

33 modultípus és több kész preset, kategóriánként. A legtöbbhöz **nem kell fiók vagy API-kulcs**.

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
| ↗ Tőzsde | Részvények, indexek (BUX, S&P 500), arany és nyersanyagok, devizák, kripto. Kulcs nélkül, piac szerint kereshető, grafikonnal és napi statisztikákkal (presetek: Arany & nyersanyagok, Tech részvények, Budapesti tőzsde) |

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
| ⌂ Látványterv | Vázlatból vagy SketchUp/Revit képernyőképből fotórealisztikus látványterv a gépeden futó ComfyUI-jal |

![Modul katalógus](docs/catalog.png)

<details><summary>További képek</summary>

![](docs/screenshot-2.png)
![](docs/screenshot-3.png)

</details>

### Tőzsde csempe

![Presetek](docs/stocks-tiles.png)

![Keresés](docs/stocks-search.png)

- **Keresés piac szerint:** Mind / USA / Európa / BÉT / Ázsia / Indexek / Nyersanyag / Deviza / Kripto / ETF. A köznapi nevek is működnek: „space x” → SPCX (NASDAQ), „arany” → Gold, „olaj”, „forint”, „bitcoin”, „bux”. A találatoknál az aktuális ár is látszik.
- **Figyelőlista:** árfolyam, napi változás, napi sáv (hol tart az ár a napi minimum és maximum között). Egy sorra kattintva megjelenik a grafikon, az előző záró, a napi és az 52 hetes csúcs és mélypont, a forgalom, a teljesítmény (1 hét – 1 év), és hogy mennyit késik az adat.
- **Adatszolgáltató** (csempénként állítható):
  - **TradingView** (alapértelmezett, **kulcs nélkül**): szinte minden piac, a BÉT-et (OTP, MOL, Richter, Telekom, BUX) is beleértve, továbbá indexek, arany, ezüst, olaj, deviza, kripto. Az árfolyamok a TradingView nyilvános (nem hivatalos) screener API-jából jönnek, a grafikon a TradingView hivatalos, beágyazható widgetje. A BÉT és az amerikai tőzsdék adatai kb. 15 perc késéssel érkeznek.
  - **Twelve Data:** [ingyenes kulcs](https://twelvedata.com/pricing), utána `SECRET_TWELVEDATA_KEY=...` a `.env`-be. Ha van kulcs, alapból ezt használja. Saját grafikont és görbéket rajzol, de percenként 8 és naponta 800 lekérést enged, és a nem amerikai tőzsdék egy része csak fizetős csomagban érhető el.
  - **Yahoo Finance:** kulcs nélkül, de EU-s és felhős IP-ről jellemzően blokkol.
- A régebbi presetekkel létrehozott csempék automatikusan átállnak az új szolgáltatóra, nem kell őket újra felvenni.
- Az árak tájékoztató jellegűek, kereskedési döntéshez ne erre támaszkodj.

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

Az AI-t a fejléc **AI** gombjával állíthatod be (vagy az AI-csempék „AI beállítása” gombjával):
1. válassz szolgáltatót: **xAI Grok**, **OpenAI**, **OpenRouter**, **Ollama** (helyi, ingyenes) vagy **Egyéni** (bármilyen OpenAI-kompatibilis API),
2. írd be az **API kulcsot** (xAI: [console.x.ai](https://console.x.ai)) és a **modellt**,
3. **Mentés és kipróbálás**: egy rövid próbakérés azonnal megmutatja, működik-e.

Ezt használja az AI Chat, a Mail bot és a JARVIS napi brief. A kulcs csak a saját szervered adatbázisában tárolódik, a böngésző soha nem kapja vissza (csak az utolsó 4 karakterét látod). A fejlécben a pötty jelzi, be van-e állítva AI. A modellt csempénként is felülírhatod.

Haladóknak: a `.env`-ben megadott `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` tartalékként továbbra is működik. A felületen megadott érték felülírja.

### Mail bot

![Mail bot](docs/mail-bot.png)

A Mail bot IMAP-on letölti az olvasatlan leveleidet, és három fülön mutatja őket:
- **Összefoglaló:** rövid összegzés, a fontos levelek (számla, határidő, valódi emberektől jött levél), teendők és kategóriák. A spamet nem sorolja a fontosak közé.
- **Levelek:** a letöltött levelek listája (feladó, tárgy, időpont). Egy levélre kattintva látod az elejét, és egy kattintással kérhetsz róla összefoglalót vagy válasz-piszkozatot.
- **Kérdezz:** chat a leveleidről, például „Van fizetendő számlám?”, „Kinek kell válaszolnom?”, „Írj választ a 3. levélre”.

Beállítás:
1. Állíts be AI-t a fejléc **AI** gombjával (lásd fent).
2. A Mail bot csempe ⚙ beállításainál add meg az **IMAP szervert**, a **portot** (993, vagy 143 STARTTLS-sel), a **felhasználót** és a **jelszót**. Gmailnél és iCloudnál ez **app jelszó**, nem a rendes jelszó (Gmail: `imap.gmail.com`, iCloud: `imap.mail.me.com`, Outlook: `outlook.office365.com`). A jelszó helyett `{{secret:IMAP_PASSWORD}}` is írható; ekkor a `.env` `SECRET_IMAP_PASSWORD` értékét használja.
3. **▶ Futtatás**. Ha beállítasz automatikus futást (X percenként), a szerver a háttérben akkor is lefuttatja, ha a böngésző zárva van.

A bot csak olvas (`BODY.PEEK`), ezért a levelek nem lesznek olvasottnak jelölve. Az utolsó futás leveleinek eleje (levelenként max. 1200 karakter) a saját adatbázisodban tárolódik, hogy kérdezni lehessen róluk.

**Helyi modell (Ollama):** a kis modellek egyszerre csak kevés szöveget látnak (alapból ~4000 token), ezért a bot ilyenkor rövidebben adja át a leveleket. Egy 7B-s modell már használható összefoglalót ad, de a felhős modellek (Grok, GPT) érezhetően jobbak. Egy helyi modell egy-két percig is dolgozhat egy futáson.

> ⚠️ **Adatvédelem:** felhős AI esetén a levelek tárgya, feladója és szövegének eleje a szolgáltatóhoz kerül. Ollamával minden a gépeden marad.

### Látványterv (ComfyUI)

![Látványterv](docs/latvanyterv.png)

Vázlatból, kézi rajz fotójából vagy SketchUp/Revit képernyőképből készít látványtervet. A képet a **saját gépeden futó [ComfyUI](https://www.comfy.org/)** rendereli Stable Diffusion vagy FLUX modellel. Ha van hozzá ControlNet modell, a vázlat vonalai és a perspektíva megmaradnak. Semmi nem megy felhőbe. (Az Ollama erre nem jó, mert az szöveges modelleket futtat.)

Beállítás Macen:
1. Telepítsd a **ComfyUI Desktop** alkalmazást (comfy.org). Ez a **8000-es** porton fut, a kézi telepítésű ComfyUI a 8188-ason.
2. Tölts le egy modellt a ComfyUI `models/checkpoints` mappájába, például egy SDXL modellt (`sd_xl_base_1.0.safetensors`, vagy egy építészetre finomhangolt SDXL modellt a Civitai-ról), és hozzá egy **illő ControlNetet** a `models/controlnet` mappába. SDXL-hez SDXL canny vagy union ControlNet kell (pl. `controlnet-union-sdxl-1.0`), SD 1.5-höz `control_v11p_sd15_canny`. A csempe magától választ illő ControlNetet; ha nem talál, csak img2img fut.
3. A csempe ⚙ beállításainál add meg a címet: `http://host.docker.internal:8000` (Desktop) vagy `http://host.docker.internal:8188`.
4. Húzd a csempére a képet (vagy ⌘V), írd le angolul, mit szeretnél (pl. *modern family house, white plaster and larch cladding*), válassz hangulatot, majd **▶ Render**.

Bemenet szerint két mód van:
- **Vázlat:** vonalrajzhoz. A modell mindent újrarajzol, a ControlNet tartja a vonalakat. ControlNet nélkül ez nem működik.
- **Képernyőkép / fotó:** fehér makett, SketchUp-nézet vagy fotó. Az eredetiből a fényt és a tömegeket is megtartja, a **Szabadság** csúszkával állíthatod, mennyire térhet el tőle.

A renderek (az eredeti képpel együtt, csempénként az utolsó 40) a saját adatbázisodba kerülnek. A galériában egy képre kattintva összehasonlíthatod az eredetivel, letöltheted, vagy a beállításaival újra futtathatod. Egy SDXL render M1 Pro-n nagyjából 30–90 másodperc, egy FLUX render 1–3 perc.

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
