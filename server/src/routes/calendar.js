import { Router } from 'express';
import ical from 'node-ical';
import { getWidget, cached } from '../util.js';
import { resolveSecrets } from '../secrets.js';

const r = Router();

// Any iCal (.ics) feed works:
//  - Google Calendar: Settings → your calendar → "Secret address in iCal format"
//  - iCloud: Calendar app → share calendar → "Public Calendar" → copy the webcal:// link
//  - Outlook / Proton / Nextcloud: their ICS publish link
async function loadFeed(url) {
  const data = await ical.async.fromURL(resolveSecrets(url).replace(/^webcal:\/\//i, 'https://'));
  return Object.values(data).filter((e) => e.type === 'VEVENT');
}

function expand(event, from, to) {
  try {
    return ical.expandRecurringEvent(event, { from, to, expandOngoing: true });
  } catch {
    return [];
  }
}

// Events of a calendar widget between today 00:00 and today + days.
export async function loadEvents(w, days = Number(w.config.days) || 7) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 86400_000);

  const sources = (w.config.sources ?? []).filter((s) => s?.url);
  const results = await Promise.all(
    sources.map(async (src, idx) => {
      try {
        const events = await cached(`${w.id}:cal:${src.url}`, 5 * 60_000, () => loadFeed(src.url));
        return events.flatMap((ev) =>
          expand(ev, from, to).map((inst) => ({
            title: inst.summary?.val ?? inst.summary ?? '(no title)',
            start: inst.start,
            end: inst.end,
            allDay: inst.isFullDay,
            location: ev.location?.val ?? ev.location ?? '',
            source: src.name || `Calendar ${idx + 1}`,
            color: src.color || '#67e8f9',
          })),
        );
      } catch (err) {
        return [{ error: `${src.name || src.url}: ${err.message}` }];
      }
    }),
  );
  const flat = results.flat();
  return {
    events: flat.filter((e) => !e.error).sort((a, b) => new Date(a.start) - new Date(b.start)),
    errors: flat.filter((e) => e.error).map((e) => e.error),
  };
}

r.get('/widgets/:id/calendar', async (req, res) => {
  const w = await getWidget(req.params.id, 'calendar');
  res.json(await loadEvents(w));
});

export default r;
