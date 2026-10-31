// Tile types added by the finance module; merged into REGISTRY in registry.js.
import Kpi from './Kpi.jsx';
import Balance from './Balance.jsx';
import Budget from './Budget.jsx';
import Cashflow from './Cashflow.jsx';
import Portfolio from './Portfolio.jsx';

const REFRESH_OPTIONS = [[1, '1 percenként'], [3, '3 percenként'], [5, '5 percenként'], [15, '15 percenként'], [30, '30 percenként'], [60, 'óránként']];

const expenseTileField = (key, label) => ({
  key,
  label,
  placeholder: 'Az első Költségkövető',
  help: 'A Költségkövető csempe címe; üresen az elsőt használja.',
});

export default {
  portfolio: {
    name: 'Portfólió',
    icon: '◔',
    category: 'money',
    description: 'Befektetéseid élő árfolyamon: részvények, ETF-ek, kripto. Vételeket és eladásokat rögzítesz (darab, ár, dátum), és látod az értéket, a hozamot, az átlagárat és az eloszlást.',
    size: { w: 5, h: 9, minW: 3, minH: 6 },
    component: Portfolio,
    defaultConfig: { base: 'HUF', refreshMin: 3, alertPct: 0 },
    fields: [
      { key: 'base', label: 'Alappénznem', type: 'select', options: [['HUF', 'HUF (forint)'], ['EUR', 'EUR (euró)'], ['USD', 'USD (dollár)']] },
      { key: 'alertPct', label: 'Árriasztás a telefonra', type: 'select', options: [[0, 'Ki'], [3, 'Napi ±3% mozgásnál'], [5, 'Napi ±5% mozgásnál'], [10, 'Napi ±10% mozgásnál']], help: 'Push-értesítést küld, ha egy papír vagy az egész portfólió napi változása eléri ezt (papíronként naponta egyszer). A csengőben kapcsold be az értesítéseket.' },
      { key: 'refreshMin', label: 'Frissítés', type: 'select', options: REFRESH_OPTIONS, help: 'Ilyen gyakran kérem le az árakat. A TradingView egyes tőzsdéken (pl. BÉT) 15 perccel késve adja az árat.' },
    ],
  },
  kpi: {
    name: 'Mutatók',
    icon: '▦',
    category: 'money',
    description: 'Pénzügyi mutatók kártyákon változással: kézi érték, havi kiadás, bevétel vagy bármely JSON API.',
    size: { w: 4, h: 6, minW: 2, minH: 3 },
    component: Kpi,
    defaultConfig: {
      metrics: [
        { label: 'Havi bevétel', source: 'income' },
        { label: 'Havi kiadás', source: 'expenses' },
      ],
    },
    fields: [
      {
        key: 'metrics',
        label: 'Mutatók',
        type: 'list',
        addLabel: 'Mutató',
        newItem: { source: 'manual' },
        fields: [
          { key: 'label', placeholder: 'Név' },
          {
            key: 'source',
            type: 'select',
            options: [
              ['manual', 'Kézi érték'],
              ['expenses', 'Havi kiadás (Költségkövető)'],
              ['income', 'Havi bevétel (Költségkövető)'],
              ['api', 'JSON API'],
            ],
          },
          { key: 'value', type: 'number', placeholder: 'Érték (kézi)' },
          { key: 'previous', type: 'number', placeholder: 'Előző érték (kézi)' },
          { key: 'tile', placeholder: 'Költségkövető címe (opcionális)' },
          { key: 'url', placeholder: 'API URL (https://…)' },
          { key: 'path', placeholder: 'Útvonal, pl. data.price' },
          { key: 'unit', placeholder: 'Pénznem / egység (HUF, USD, kg…)' },
          { key: 'icon', placeholder: 'Ikon (pl. ★)' },
        ],
        help:
          'Kézi: érték + előző érték. Kiadás/bevétel: e hónap eddigi összege az előző hónap azonos napjaihoz képest. JSON API: a szerver kéri le (titkos kulcs: {{secret:NEV}}), a változás a tegnapi értékhez képest számol. Az első kártya kiemelt.',
      },
    ],
  },
  balance: {
    name: 'Egyenleg',
    icon: '◎',
    category: 'money',
    description: 'Teljes egyenleg több pénznemű számlából, átváltással, havi változással és gyors bevétel/kiadás rögzítéssel.',
    size: { w: 4, h: 7, minW: 3, minH: 6 },
    component: Balance,
    defaultConfig: {
      base: 'HUF',
      accounts: [
        { name: 'Folyószámla', currency: 'HUF', amount: 0, active: true },
        { name: 'Euró', currency: 'EUR', amount: 0, active: true },
      ],
    },
    fields: [
      { key: 'base', label: 'Alap pénznem', placeholder: 'HUF' },
      {
        key: 'accounts',
        label: 'Számlák',
        type: 'list',
        addLabel: 'Számla',
        newItem: { currency: 'HUF', amount: 0, active: true },
        fields: [
          { key: 'name', placeholder: 'Név' },
          { key: 'currency', placeholder: 'Pénznem (HUF, EUR, USD…)' },
          { key: 'amount', type: 'number', placeholder: 'Összeg' },
          { key: 'limit', type: 'number', placeholder: 'Havi limit (opcionális)' },
          { key: 'active', type: 'checkbox', checkLabel: 'Aktív', default: true },
        ],
        help: 'Az összeget a csempén is átírhatod koppintással. Árfolyam: open.er-api.com (6 óránként frissül).',
      },
      expenseTileField('expenseTile', 'Bevétel/kiadás rögzítése ide'),
    ],
  },
  budget: {
    name: 'Havi keret',
    icon: '▭',
    category: 'money',
    description: 'A hónap kiadásai a havi kerethez képest: hátralévő napok és naponta még költhető összeg.',
    size: { w: 4, h: 4, minW: 2, minH: 3 },
    component: Budget,
    defaultConfig: { limit: '', source: '' },
    fields: [
      { key: 'limit', label: 'Havi keret (üres = a Költségkövető kerete)', type: 'number', min: 0 },
      expenseTileField('source', 'Költségkövető'),
    ],
  },
  cashflow: {
    name: 'Bevétel & kiadás',
    icon: '▥',
    category: 'money',
    description: 'Havi bevétel és kiadás oszlopdiagramon az összes Költségkövető alapján, a hónap nettó egyenlegével.',
    size: { w: 5, h: 6, minW: 3, minH: 4 },
    component: Cashflow,
    defaultConfig: { months: 8 },
    fields: [{ key: 'months', label: 'Hónapok száma (3–12)', type: 'number', min: 3, max: 12 }],
  },
};
