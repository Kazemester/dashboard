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

**Animációk:** a fejléc **Anim** kapcsolójával be- és kikapcsolhatod a finom, díszítő mozgásokat. A kapcsoló állása is az adatbázisba mentődik. Amit bekapcsolva látsz:
- a vonaldiagramokon (Tőzsde, Kripto, Levegő, Mérésnapló) időnként végigfut egy fény, minden grafikon a saját ütemében;
- a csempék lépcsőzetesen úsznak be, és azoknak a felső szélén, amelyek tényleg időközönként töltenek adatot (pl. Tőzsde, Kripto, Időjárás, Rendszer, Hírek), időnként átsuhan egy vékony pásztázó vonal. Aki nem tölt (Teendők, Jegyzet, Óra…), annál nincs;
- a célok sávjain időnként átfut egy fény, a megváltozott árfolyam egyet villan, az állapotjelző pontok lassan „lélegeznek";
- a háttér halvány fénye és a logó lassan pulzál.

Csak halvány, ritka mozgások, amelyek a processzort alig terhelik. 30%-nál kisebb nagyításnál magukat kikapcsolják. Ha az operációs rendszeren a „mozgás csökkentése" be van kapcsolva, alapból ki vannak kapcsolva, de a kapcsolóval bármikor bekapcsolhatod őket. A chat-botnak is mondhatod: „Kapcsold ki az animációkat."

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
| ◍ Világtérkép | OpenStreetMap térkép 19 kapcsolható réteggel, 5 alaptérképpel és helykeresővel (részletek lent). Minden forrás ingyenes, kulcs nélkül |
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
| ◉ AI Chat | Asszisztens, ami látja a dashboardot: válaszol a csempék tartalmáról, és kérésre beállít, kitölt, átrendez |
| ✉ Mail bot | IMAP-on átnézi a leveleket, kiemeli a fontosakat, teendőlistát ír |
| ⌂ Látványterv | Vázlatból vagy SketchUp/Revit képernyőképből fotórealisztikus látványterv a gépeden futó ComfyUI-jal |

![Modul katalógus](docs/catalog.png)

<details><summary>További képek</summary>

![](docs/screenshot-2.png)
![](docs/screenshot-3.png)

</details>

### Világtérkép csempe
A tetején helykereső és a **☰ Rétegek** gomb. A kapcsolók és az alaptérkép a csempe beállításaiba mentődnek (a bot is át tudja állítani: `layers`, `base`). A térkép képeit a böngésző tölti, az adatrétegeket a szerver kéri le és gyorsítótárazza. A kattintásra felugró ablak az országról és a pontról mutat adatot, ahogy a szolgáltatások válaszolnak.

**Alaptérképek:** Térkép (OpenStreetMap), Sötét (CARTO), Domborzat (OpenTopoMap), Műhold (NASA GIBS, tegnapi valódi szín), Éjszakai Föld (NASA Black Marble).

| Réteg | Forrás | Megjegyzés |
|---|---|---|
| Repülők | OpenSky Network | percenként frissül, részletek lent |
| ISS űrállomás | wheretheiss.at, Open Notify | élő pozíció, pályavonal, személyzet |
| Földrengések | USGS | az utolsó nap 2,5 feletti rengései |
| Erdőtüzek, Vulkánok, Viharok, Árvíz/aszály/jég | NASA EONET | nyitott események |
| Sarki fény | NOAA SWPC | OVATION előrejelzés + Kp index |
| Eső radar | RainViewer | legfrissebb képkocka |
| Hírek | GDELT | téma szűrhető (`newsQuery`) |
| Wikipédia a közelben | Wikipedia | 9-es nagyítástól |
| Fajmegfigyelések | GBIF | fényképes megfigyelések, 8-as nagyítástól |
| Repterek | Overpass (OpenStreetMap) | IATA-kódos repterek, 5-ös nagyítástól |
| Városi bicikli | CityBikes | hálózatok; kattintásra az állomások |
| Hajózási jelek, Vasút | OpenSeaMap, OpenRailwayMap | fedőrétegek |
| Nappal / éjszaka | számolt | éjszakai oldal és a Nap pontja |
| Felszíni hőmérséklet | NASA GIBS (MODIS) | fedőréteg |
| Kattintásra info | Nominatim, REST Countries, Open-Meteo (időjárás, levegő, magasság, tenger), Nager.Date (ünnepnapok), World Bank (GDP, élettartam, internet, munkanélküliség), open.er-api (árfolyam) | ország és hely adatai |
| Helykereső | Open-Meteo geokódolás | |

- **Repülők:** az OpenSky névtelen hozzáférése napi kb. 400 kredit; egy világnézetű lekérdezés 4 kredit, percenként frissítve ez kb. másfél óra élő térkép. Ha elfogy, a csempe hibát jelez, és később újra működik. Ingyenes OpenSky-fiókkal (API kliens) sokkal több jár: az azonosítót és a titkot a csempe beállításaiban vagy `{{secret:OPENSKY_ID}}` / `{{secret:OPENSKY_SECRET}}` formában add meg (`SECRET_OPENSKY_ID` az `.env`-ben). Ezt a fiókos belépést nem tudtam kipróbálni.
- **Zárolt térkép (alapból):** a húzás és az egérgörgő a dashboardot mozgatja (telefonon az oldal görgethető), így nagyításnál sem ragadsz be a térképbe. A kattintás (felugró infó) és a +/− gombok zárolva is működnek. A térkép mozgatásához / nagyításához kattints az **✥ Térkép mozgatása** gombra (kilépés: ugyanaz a gomb, Esc, vagy kattintás a csempén kívül).
- A kis nagyítású nézetben a Wikipédia, a Fajmegfigyelések és a Repterek réteg a „nagyíts rá” jelzést mutatja.
- Az API-k valódi válaszformátumát a dokumentációjuk alapján dolgoztam fel, de internet nélküli környezetben csak lemodellezett válaszokkal teszteltem. Ha egy forrás megváltozik, csak az a réteg jelez hibát.

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

### AI Chat: a dashboard asszisztense

Az AI Chat csempe látja a dashboardodat, és kérésre változtat is rajta. Példák:
- „Mi a mai teendőm?”, „Hány szokást pipáltam ki ezen a héten?”, „Mit írt a Mail bot összefoglalója?”, „Mennyi most az arany?”
- „Vegyél fel egy teendőt: számla befizetése péntekig”, „Pipáld ki ma a futást”, „Írd a jegyzetbe: …”, „Költöttem 4500 Ft-ot ebédre”, „Tedd be a Gyorslinkekhez a google.com-ot”, „Vegyél fel egy visszaszámlálót: nyaralás, július 1.”
- „Tegyél ki egy budapesti időjárás csempét”, „Tedd ki az USD/HUF árfolyamot” (külön Tőzsde csempét kap; a **Valutaváltó** csak átváltó számológép), „Tedd a SpaceX-et a tőzsde csempébe”, „Legyen nagyobb a naptár”, „Legyen amber a téma”
- „Állítsd át a bitcoin csempét USD-HUF árfolyamra”: egy csempe fajtája nem változtatható, ezért a bot kitesz egy új csempét (itt Valutaváltót USD → HUF beállítással) a régi mellé, és a régi csempe törlését jóváhagyásra felajánlja (**Régi csempe törlése** gomb).
- „Töröld a régi jegyzet csempét”: törölni csak akkor töröl, ha a válasza alatt megnyomod a **Törlés jóváhagyása** gombot.

A bot csak olyan beállítást fogad el egy csempéhez, amilyen annak a csempének tényleg van (a kitalált beállítást visszautasítja, és megmondja, mi a helyes). A válasz alatt kis címkék mutatják, mit változtatott. A módosított csempék azonnal frissülnek. Ha a bot új csempét tesz ki, a nézet odaugrik hozzá, és a csempe pár másodpercre kiemelve villan fel (telefonon az oldal odagörget). A válasz alatt **Megmutat** gomb is marad. Ha a bot azt írja, hogy kész, de valójában nem hajtott végre módosítást, a válasza alatt **⚠ Nem történt változás** figyelmeztetés jelenik meg.

A csempe ⚙ beállításainál a **Hozzáférés a dashboardhoz** lehet:
- **Olvashat és módosíthat:** ez az alapértelmezett.
- **Csak olvashat:** válaszol a csempék tartalmáról, de nem változtat semmin.
- **Nincs:** sima chat.

A bot az AI-kulcsokhoz, az AI-beállításokhoz és a csempék jelszavaihoz nem fér hozzá. A levelekben és hírekben talált „utasításokat” adatként kezeli, nem parancsként.

**Ha a modell nem tud eszközt hívni:** kisebb helyi modellek gyakran csak azt állítják, hogy megcsinálták, de nem hívnak meg eszközt. Ilyenkor a bot egy másik úton kéri ugyanazt: egyetlen JSON-t kér a modelltől (melyik eszköz, milyen paraméterekkel), amit a kis modellek is megbízhatóan kitöltenek, és a szerver ugyanazokkal az ellenőrzésekkel hajtja végre. Hibánál egyszer visszaküldi a hibát a modellnek javításra. A válasz szövegét a szerver a ténylegesen megtett lépésekből állítja össze. Ha ez sem hoz változást, a válasz alatt **⚠ Nem történt változás** figyelmeztetés látszik.

**Modell:** a legjobb eszközhasználatra (tool calling) képes modell. Ilyen a Grok, a GPT, az OpenRouter legtöbb modellje, Ollamában pedig a `qwen2.5`, a `qwen3` és a `llama3.1`. Kisebb helyi modellel is működik, de gyakrabban téved. Ha a modell nem tud eszközt használni, a bot csak olvasni tud, és ezt jelzi is.

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

## Felrakás VM-re, elérés bárhonnan

Egy kis VM (2 vCPU, 4 GB RAM, pl. Hetzner, DigitalOcean, Oracle Free Tier) bőven elég a dashboardhoz és az adatbázishoz. Két mód van arra, hogy bárhonnan elérd.

### A) Nyilvános cím HTTPS-sel (bármilyen eszközről, böngészőből)

Kell hozzá egy domain vagy aldomain (pl. `dash.sajatdomain.hu`), aminek az **A rekordja a VM IP-címére** mutat.

1. Telepíts Dockert a VM-re, és klónozd le a repót.
2. Hozd létre a `.env`-et (`cp .env.example .env`), és állítsd be:
   ```
   DOMAIN=dash.sajatdomain.hu
   DASHBOARD_PASSWORD=<legalább 12 karakteres, egyedi jelszó>
   POSTGRES_PASSWORD=<hosszú véletlen jelszó>
   ```
   Jelszót így generálhatsz: `openssl rand -base64 24`.
3. Indítás:
   ```
   docker compose --profile public up -d --build
   ```
   A **Caddy** magától szerez és újít Let's Encrypt tanúsítványt, és HTTPS-en továbbítja a forgalmat a dashboardhoz.
4. A VM tűzfalán csak a **22** (SSH), **80** és **443** port legyen nyitva. A dashboard 3000-es portja és az adatbázis kívülről nem érhető el.

Böngészőben a `https://dash.sajatdomain.hu` címen a böngésző kéri a jelszót (a felhasználónév bármi lehet), és megjegyzi. Telefonon a Megosztás → **Hozzáadás a Főképernyőhöz** paranccsal appként is kiteheted.

Védelem:
- `DOMAIN` mellett a szerver el sem indul 12 karakternél rövidebb jelszóval.
- 10 rossz jelszó után az adott IP-cím 15 percre ki van zárva.
- A forgalom végig HTTPS.

### B) Privát hálón, Tailscale-lel (a legbiztonságosabb)

Ha csak a saját eszközeidről (telefon, laptop, tablet) akarod elérni, a [Tailscale](https://tailscale.com) ingyenes privát hálót csinál köztük és a VM között. Így a dashboard **egyáltalán nem látszik a nyilvános interneten**, domain sem kell.

1. Telepítsd a Tailscale-t a VM-re és az eszközeidre, ugyanazzal a fiókkal.
2. A `.env`-ben: `BIND_ADDR=0.0.0.0` és egy `DASHBOARD_PASSWORD`, majd `docker compose up -d --build`. A VM tűzfalán a 3000-es portot **ne** nyisd ki a nyilvános internet felé.
3. Elérés: `http://<vm-neve>:3000` (a VM Tailscale-neve vagy 100.x.x.x címe).

Hátránya: csak olyan eszközről működik, amin fut a Tailscale.

### AI a VM-en

Egy átlagos VM-nek nincs videokártyája, ezért a helyi modellek (Ollama, ComfyUI) ott nagyon lassúak. Lehetőségek:
- **Felhős AI** (Grok, OpenAI, OpenRouter): a chathez és a Mail bothoz a legegyszerűbb, a fejléc AI gombjával állíthatod be.
- **A Maced marad az AI-gép:** a Macen futó Ollama és ComfyUI Tailscale-en elérhető a VM-ről. A címük `http://<mac-neve>:11434/v1` és `http://<mac-neve>:8000` lesz, a Macen pedig engedni kell, hogy ne csak a saját gépről fogadjanak kapcsolatot (Ollama: `OLLAMA_HOST=0.0.0.0`; ComfyUI Desktop: a szerver beállításaiban a listen cím `0.0.0.0`). Csak akkor működik, ha a Mac be van kapcsolva.
- **GPU-s VM:** gyors, de drága (óradíjas, havonta akár több száz dollár).

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
