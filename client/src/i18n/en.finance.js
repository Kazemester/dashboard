// English for the finance tiles (Mutatók, Egyenleg, Havi keret, Bevétel & kiadás) and the income additions of Költségkövető.
export default {
  // registry
  'Mutatók': 'Metrics',
  'Pénzügyi mutatók kártyákon változással: kézi érték, havi kiadás, bevétel vagy bármely JSON API.':
    'Financial metric cards with change: manual value, monthly spending, income or any JSON API.',
  'Havi bevétel': 'Monthly income',
  'Havi kiadás': 'Monthly spending',
  'Mutató': 'Metric',
  'Kézi érték': 'Manual value',
  'Havi kiadás (Költségkövető)': 'Monthly spending (Expense tracker)',
  'Havi bevétel (Költségkövető)': 'Monthly income (Expense tracker)',
  'JSON API': 'JSON API',
  'Érték (kézi)': 'Value (manual)',
  'Előző érték (kézi)': 'Previous value (manual)',
  'Költségkövető címe (opcionális)': 'Expense tracker title (optional)',
  'API URL (https://…)': 'API URL (https://…)',
  'Útvonal, pl. data.price': 'Path, e.g. data.price',
  'Pénznem / egység (HUF, USD, kg…)': 'Currency / unit (HUF, USD, kg…)',
  'Ikon (pl. ★)': 'Icon (e.g. ★)',
  'Kézi: érték + előző érték. Kiadás/bevétel: e hónap eddigi összege az előző hónap azonos napjaihoz képest. JSON API: a szerver kéri le (titkos kulcs: {{secret:NEV}}), a változás a tegnapi értékhez képest számol. Az első kártya kiemelt.':
    "Manual: value + previous value. Spending/income: this month so far vs the same days of last month. JSON API: fetched by the server (secret key: {{secret:NAME}}), the change is against yesterday's value. The first card is highlighted.",
  'Egyenleg': 'Balance',
  'Teljes egyenleg több pénznemű számlából, átváltással, havi változással és gyors bevétel/kiadás rögzítéssel.':
    'Total balance across multi-currency accounts, with conversion, monthly change and quick income/expense logging.',
  'Folyószámla': 'Current account',
  'Euró': 'Euro',
  'Alap pénznem': 'Base currency',
  'Számlák': 'Accounts',
  'Számla': 'Account',
  'Pénznem (HUF, EUR, USD…)': 'Currency (HUF, EUR, USD…)',
  'Havi limit (opcionális)': 'Monthly limit (optional)',
  'Aktív': 'Active',
  'Inaktív': 'Inactive',
  'Az összeget a csempén is átírhatod koppintással. Árfolyam: open.er-api.com (6 óránként frissül).':
    'You can also edit an amount on the tile by tapping it. Exchange rates: open.er-api.com (refreshed every 6 hours).',
  'Bevétel/kiadás rögzítése ide': 'Log income/expenses into',
  'Az első Költségkövető': 'The first Expense tracker',
  'A Költségkövető csempe címe; üresen az elsőt használja.': 'Title of the Expense tracker tile; empty uses the first one.',
  'Havi keret': 'Monthly budget',
  'A hónap kiadásai a havi kerethez képest: hátralévő napok és naponta még költhető összeg.':
    "This month's spending against the monthly limit: days left and what you can still spend per day.",
  'Havi keret (üres = a Költségkövető kerete)': 'Monthly limit (empty = the Expense tracker’s budget)',
  'Költségkövető': 'Expense tracker',
  'Bevétel & kiadás': 'Income & expenses',
  'Havi bevétel és kiadás oszlopdiagramon az összes Költségkövető alapján, a hónap nettó egyenlegével.':
    "Monthly income and spending as a bar chart from all Expense trackers, with this month's net.",
  'Hónapok száma (3–12)': 'Number of months (3–12)',

  // Mutatók tile
  'Még nincs mutató.': 'No metrics yet.',
  'az előzőhöz képest': 'vs previous',
  'tegnaphoz képest': 'vs yesterday',
  'ebben a hónapban': 'this month',
  'Nincs Költségkövető csempe': 'No Expense tracker tile',
  'Nincs ilyen nevű Költségkövető': 'No Expense tracker with that title',
  'Adj meg egy URL-t': 'Enter a URL',
  'Nem szám az útvonalon': 'No number at that path',
  'Ismeretlen forrás': 'Unknown source',

  // Egyenleg tile
  'Teljes egyenleg': 'Total balance',
  'a múlt hónaphoz': 'vs last month',
  'nincs múlt havi adat': 'no data for last month',
  'Árfolyam nem elérhető: {e}': 'Exchange rates unavailable: {e}',
  'Ismeretlen pénznem': 'Unknown currency',
  'Bevétel': 'Income',
  'Kiadás': 'Expense',
  '{n} számla': '{n} accounts',
  'Koppints a szerkesztéshez': 'Tap to edit',
  'Keret: {v} / hó': 'Limit: {v} / month',
  'Egyenleg módosítása': 'Update a balance',
  'Csak naplózás': 'Log only',
  'Bevétel rögzítése': 'Log income',
  'Kiadás rögzítése': 'Log expense',
  'Ide kerül: {t}': 'Goes to: {t}',
  'Összeg': 'Amount',
  'Megjegyzés': 'Note',
  'Mégse': 'Cancel',
  'Betöltés…': 'Loading…',

  // Havi keret tile
  'Adj hozzá egy Költségkövető csempét a kiadásokhoz.': 'Add an Expense tracker tile for your spending.',
  'Nincs beállított keret.': 'No limit set.',
  'Keret megadása': 'Set a limit',
  'Keret felett': 'Over the limit',
  'Közel a kerethez': 'Close to the limit',
  'Gyorsabb a tervezettnél': 'Ahead of pace',
  'Terv szerint': 'On track',
  'elköltve': 'spent',
  'Egyenletes tempó mai állása': 'Where an even pace would be today',
  '{v} maradt': '{v} left',
  '{v} túllépés': '{v} over',
  'nap van hátra': 'days left',
  'költhető naponta': 'per day left to spend',

  // Bevétel & kiadás tile
  'Bevétel és kiadás havonta': 'Income and expenses per month',
  'Nettó ebben a hónapban': 'Net this month',

  // Költségkövető additions
  'Nettó': 'Net',
  'Tétel típusa': 'Item type',
};
