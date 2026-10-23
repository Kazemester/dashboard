import { Router } from 'express';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { q } from '../db.js';
import { aiConfig, chat, isLocal, NOT_CONFIGURED } from '../llm.js';
import { getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

const r = Router();

// IMAP presets: Gmail → imap.gmail.com, iCloud → imap.mail.me.com, Outlook → outlook.office365.com
// Use an *app password* (Google / Apple both require it when 2FA is on).
// Pasted values often carry invisible leading/trailing spaces — "mail.example.hu " does not resolve.
const clean = (v, fallback) => resolveSecrets(String(v ?? '').trim() || fallback).trim();

// Turn low-level connection errors into something actionable.
function explain(err, host, port) {
  const code = err.code || err.cause?.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Nem található a levelezőszerver: "${host}". Ellenőrizd a nevét (elírás, szóköz). Ha a név jó, a Docker konténer nem éri el a DNS-t.`;
  }
  if (code === 'ECONNREFUSED') return `A szerver (${host}:${port}) elutasította a kapcsolatot. Jó a port? IMAP: 993 (SSL) vagy 143 (STARTTLS).`;
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ETIMEOUT' || /timeout|timed out|required time/i.test(err.message)) {
    return `Nem jön válasz innen: ${host}:${port}. Rossz port, tűzfal, vagy a szolgáltató csak a saját hálózatáról engedi az IMAP-ot.`;
  }
  if (err.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed/i.test(`${err.responseText} ${err.message}`)) {
    return 'A bejelentkezés nem sikerült: hibás felhasználónév vagy jelszó. Gmail / iCloud esetén app jelszó kell, nem a rendes jelszó.';
  }
  if (/certificate|self.signed|CERT_/i.test(err.message)) return `A szerver SSL tanúsítványa nem érvényes (${host}): ${err.message}`;
  return `Levelezés hiba (${host}:${port}): ${err.responseText || err.message}`;
}

// Newsletters turn into walls of tracking links and invisible padding characters when
// converted to plain text. Keep only what a human would read.
export function readable(text) {
  return String(text ?? '')
    .replace(/[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/g, '')
    .replace(/\[\s*(https?:|mailto:|cid:)[^\]]*\]/gi, ' ') // [https://…] link targets
    .replace(/<\s*(https?:|mailto:)[^>]*>/gi, ' ') // <https://…>
    .replace(/\b(https?:\/\/|www\.)\S+/gi, ' ') // bare links
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/([-_=*~#.|])\1{3,}/g, ' ') // separator lines
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchMails(cfg) {
  const host = clean(cfg.imapHost, '{{secret:IMAP_HOST}}');
  const port = Number(cfg.imapPort) || 993;
  const client = new ImapFlow({
    host,
    port,
    secure: port !== 143, // 993: SSL from the start; 143: plain, upgraded with STARTTLS
    auth: {
      user: clean(cfg.imapUser, '{{secret:IMAP_USER}}'),
      pass: clean(cfg.imapPassword, '{{secret:IMAP_PASSWORD}}'),
    },
    logger: false,
    connectionTimeout: 20_000,
  });
  client.on('error', () => {}); // socket errors after connect are reported by the awaited calls
  try {
    await client.connect();
  } catch (err) {
    throw new HttpError(502, explain(err, host, port));
  }
  const mails = [];
  const lock = await client.getMailboxLock(cfg.mailbox || 'INBOX');
  try {
    const since = new Date(Date.now() - (Number(cfg.hours) || 24) * 3600_000);
    const criteria = { since, ...(cfg.unreadOnly !== false ? { seen: false } : {}) };
    const uids = ((await client.search(criteria, { uid: true })) || []).slice(-(Number(cfg.maxMails) || 40));
    if (uids.length) {
      // Fetching the source does not set \Seen when we use BODY.PEEK (imapflow default for `source`).
      for await (const msg of client.fetch(uids, { envelope: true, source: { maxLength: 60_000 } }, { uid: true })) {
        const parsed = await simpleParser(msg.source).catch(() => null);
        mails.push({
          from: msg.envelope.from?.map((a) => `${a.name || ''} <${a.address}>`).join(', '),
          subject: msg.envelope.subject || '(no subject)',
          date: msg.envelope.date,
          text: readable(parsed?.text).slice(0, 1200),
        });
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return mails;
}

const PROMPT = `You are an email triage assistant. You receive the user's recent emails as a numbered list.
Reply with ONE JSON object and nothing else, using exactly these English keys:
{"headline": "...", "important": [{"n": 1, "from": "...", "subject": "...", "why": "...", "action": "..."}],
 "todos": ["..."], "categories": [{"name": "...", "count": 0}]}
- headline: one or two sentences summarising the inbox
- important: only emails that need attention (bills, deadlines, personal messages from real people), max 6, n = email number.
  NEVER list spam, phishing, prize/lottery or "enter your card details" emails as important — count them under Spam
- todos: concrete action items, max 6
- categories: e.g. Work, Finance, Shopping, Newsletter, Social, Spam with counts
Be terse. Write every value in this language: `;

// Small local models see only a few thousand tokens: fit the email list into a character budget.
async function budgetFor() {
  const c = await aiConfig();
  return isLocal(c.baseUrl) ? 7000 : 40000;
}
function compact(mails, budget) {
  const head = (m, i) => `#${i + 1} | ${m.date ? new Date(m.date).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : ''} | ${m.from} | ${m.subject}`;
  const fixed = mails.map(head).join('\n').length;
  const per = Math.max(0, Math.min(1200, Math.floor((budget - fixed) / Math.max(1, mails.length))));
  return mails.map((m, i) => `${head(m, i)}${per > 40 ? `\n   ${m.text.slice(0, per)}` : ''}`).join('\n');
}

// Small models sometimes return objects (or JSON strings of objects) instead of plain todo sentences.
function todoText(t) {
  if (typeof t === 'string' && t.trim().startsWith('{')) {
    try {
      t = JSON.parse(t);
    } catch {
      return t;
    }
  }
  if (typeof t === 'string') return t;
  if (!t || typeof t !== 'object') return null;
  const what = t.text ?? t.todo ?? t.teendő ?? t.action ?? t.task ?? t.why;
  const about = t.subject ?? t.tárgy;
  return [about, what].filter(Boolean).join(' — ') || null;
}

// Accept the shapes small models actually produce: code fences, prose around the JSON, Hungarian keys.
export function normalizeDigest(raw) {
  let obj = null;
  const text = String(raw ?? '').replace(/```(json)?/gi, '');
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      obj = JSON.parse(m[0]);
    } catch {
      obj = null;
    }
  }
  if (!obj || typeof obj !== 'object') return { headline: text.trim().slice(0, 600) || null, important: [], todos: [], categories: [] };
  const pick = (...keys) => keys.map((k) => obj[k]).find((v) => v !== undefined);
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return {
    headline: pick('headline', 'summary', 'összefoglaló', 'osszefoglalo', 'összegzés', 'cím') ?? null,
    important: arr(pick('important', 'fontos', 'fontos_levelek', 'priority')).map((x) =>
      typeof x === 'string' ? { subject: x } : { n: x.n ?? x.szam, from: x.from ?? x.feladó ?? x.felado, subject: x.subject ?? x.tárgy ?? x.targy, why: x.why ?? x.miért ?? x.ok, action: x.action ?? x.teendő ?? x.teendo },
    ),
    todos: arr(pick('todos', 'teendők', 'teendok', 'tasks', 'feladatok')).map(todoText).filter(Boolean),
    categories: arr(pick('categories', 'kategóriák', 'kategoriak')).map((c) => (typeof c === 'string' ? { name: c, count: null } : { name: c.name ?? c.név ?? c.nev, count: c.count ?? c.db ?? null })),
  };
}

// Take sender / subject of "important" items from the actual email (#n) instead of the model's copy,
// and drop typical scam mails a small model may still flag as important.
const SCAM = /(nyert|nyeremény|gratulálunk|lottery|winner|you have won|bankkártya adat|card details|verify your account|jelszavát erősítse)/i;
function groundDigest(d, mails) {
  d.important = d.important
    .map((it) => {
      const m = Number.isInteger(Number(it.n)) ? mails[Number(it.n) - 1] : null;
      return m ? { ...it, n: Number(it.n), from: m.from, subject: m.subject } : it;
    })
    .filter((it) => !SCAM.test(`${it.subject ?? ''} ${it.why ?? ''}`));
  return d;
}

const MAIL_KEEP = 1200; // characters of each email body kept for questions

export async function runDigest(widget) {
  const cfg = widget.config;
  const fetched = await fetchMails(cfg); // read the mailbox even without AI: the list is useful on its own
  const mails = [...fetched].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  let result;
  if (!mails.length) {
    result = { headline: 'Nincs új levél a megadott időszakban.', important: [], categories: [], todos: [] };
  } else if (!(await aiConfig()).configured) {
    result = { headline: null, important: [], categories: [], todos: [], aiError: NOT_CONFIGURED };
  } else {
    const extra = cfg.instructions ? `\nExtra rules from the user: ${cfg.instructions}` : '';
    try {
      const raw = await chat(
        [
          { role: 'system', content: PROMPT + (cfg.language || 'Hungarian') + extra },
          { role: 'user', content: compact(mails, await budgetFor()) },
        ],
        { json: true, model: cfg.model || undefined, temperature: 0.2 },
      );
      result = groundDigest(normalizeDigest(raw), mails);
      if (!result.headline && !result.important.length && !result.todos.length) {
        result.aiError = 'Az AI nem adott használható összefoglalót. Kisebb helyi modellnél próbáld kevesebb levéllel, vagy kérdezz a Kérdezz fülön.';
      }
    } catch (err) {
      result = { headline: null, important: [], categories: [], todos: [], aiError: err.message };
    }
  }
  result.mailCount = mails.length;
  result.mails = mails.map((m) => ({ from: m.from, subject: m.subject, date: m.date, text: m.text.slice(0, MAIL_KEEP) }));
  const { rows } = await q(
    'INSERT INTO mail_digests (widget_id, result) VALUES ($1, $2) RETURNING result, created_at',
    [widget.id, JSON.stringify(result)],
  );
  await q(
    `DELETE FROM mail_digests WHERE widget_id = $1 AND id NOT IN
       (SELECT id FROM mail_digests WHERE widget_id = $1 ORDER BY id DESC LIMIT 5)`,
    [widget.id],
  );
  return rows[0];
}

r.get('/widgets/:id/mail', async (req, res) => {
  await getWidget(req.params.id, 'maildigest');
  const { rows } = await q(
    'SELECT result, created_at FROM mail_digests WHERE widget_id = $1 ORDER BY id DESC LIMIT 1',
    [req.params.id],
  );
  const d = rows[0];
  // older runs were stored before readable() existed
  if (d?.result?.mails) d.result.mails = d.result.mails.map((m) => ({ ...m, text: readable(m.text) }));
  res.json(d ?? null);
});

// ---------- ask the bot about the fetched emails ----------
const ASK_PROMPT = `You are the user's email assistant. Below are their recent emails, numbered (#1 is the newest).
Answer the user's question using only these emails. Refer to emails by number and sender (e.g. "#3, Kovács Anna").
If asked to write a reply, draft it ready to send. If the emails don't contain the answer, say so.
Be concise. Answer in this language: `;

r.get('/widgets/:id/mail/thread', async (req, res) => {
  await getWidget(req.params.id, 'maildigest');
  const { rows } = await q('SELECT id, role, content, created_at FROM chat_messages WHERE widget_id = $1 ORDER BY id', [req.params.id]);
  res.json(rows);
});

r.delete('/widgets/:id/mail/thread', async (req, res) => {
  await q('DELETE FROM chat_messages WHERE widget_id = $1', [req.params.id]);
  res.json({ ok: true });
});

r.post('/widgets/:id/mail/ask', async (req, res) => {
  const w = await getWidget(req.params.id, 'maildigest');
  const question = String(req.body?.question ?? '').trim();
  if (!question) throw new HttpError(400, 'Írj be egy kérdést.');
  if (!(await aiConfig()).configured) throw new HttpError(400, NOT_CONFIGURED);
  const { rows: d } = await q('SELECT result FROM mail_digests WHERE widget_id = $1 ORDER BY id DESC LIMIT 1', [w.id]);
  const mails = d[0]?.result?.mails?.map((m) => ({ ...m, text: readable(m.text) }));
  if (!mails?.length) throw new HttpError(400, 'Még nincsenek letöltött levelek: nyomd meg a Futtatás gombot.');
  const { rows: history } = await q('SELECT role, content FROM chat_messages WHERE widget_id = $1 ORDER BY id DESC LIMIT 8', [w.id]);
  const system = `${ASK_PROMPT}${w.config.language || 'Hungarian'}\n\nEMAILS:\n${compact(mails, await budgetFor())}`;
  const answer = await chat([{ role: 'system', content: system }, ...history.reverse(), { role: 'user', content: question }], {
    model: w.config.model || undefined,
    temperature: 0.3,
  });
  await q("INSERT INTO chat_messages (widget_id, role, content) VALUES ($1, 'user', $2)", [w.id, question]);
  const { rows } = await q(
    "INSERT INTO chat_messages (widget_id, role, content) VALUES ($1, 'assistant', $2) RETURNING id, role, content, created_at",
    [w.id, answer],
  );
  res.json(rows[0]);
});

const running = new Set();
r.post('/widgets/:id/mail/run', async (req, res) => {
  const w = await getWidget(req.params.id, 'maildigest');
  if (running.has(w.id)) throw new HttpError(409, 'Digest already running');
  running.add(w.id);
  try {
    res.json(await runDigest(w));
  } finally {
    running.delete(w.id);
  }
});

// Background bot: re-runs digests whose "autoMinutes" interval elapsed.
export function startMailScheduler() {
  setInterval(async () => {
    try {
      const { rows } = await q(
        `SELECT w.*, (SELECT MAX(created_at) FROM mail_digests d WHERE d.widget_id = w.id) AS last_run
         FROM widgets w WHERE w.type = 'maildigest' AND COALESCE((w.config->>'autoMinutes')::int, 0) > 0`,
      );
      for (const w of rows) {
        const due = !w.last_run || Date.now() - new Date(w.last_run) > w.config.autoMinutes * 60_000;
        if (!due || running.has(w.id)) continue;
        running.add(w.id);
        runDigest(w)
          .catch((err) => console.error(`[mail] ${w.title}: ${err.message}`))
          .finally(() => running.delete(w.id));
      }
    } catch (err) {
      console.error('[mail scheduler]', err.message);
    }
  }, 60_000);
}

export default r;
