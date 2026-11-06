// Tile types added by the activity module; merged into REGISTRY in registry.js.
import Activity from './Activity.jsx';

export default {
  activity: {
    name: 'Aktivitás',
    icon: '☰',
    accent: 'cyan',
    category: 'info',
    description: 'Legutóbbi események táblázata: teendők, kiadások, szokások, célok, fókusz, levelek és AI műveletek, kereséssel és szűrővel.',
    size: { w: 7, h: 6, minW: 3, minH: 4 },
    component: Activity,
    defaultConfig: { kinds: '', rows: 12 },
    fields: [
      {
        key: 'kinds',
        label: 'Alapértelmezett szűrő',
        placeholder: 'pl. todo, money, habit',
        help: 'Vesszővel elválasztott típusok (üres = mind): tile, todo, money, habit, goal, focus, mail, brief, ai',
      },
      { key: 'rows', label: 'Sorok oldalanként', type: 'number', min: 5, max: 100 },
    ],
  },
};
