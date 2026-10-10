import { Router } from 'express';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { q } from '../db.js';
import { chat, llmConfigured } from '../llm.js';
import { getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

const r = Router();

// IMAP presets: Gmail → imap.gmail.com, iCloud → imap.mail.me.com, Outlook → outlook.office365.com
// Use an *app password* (Google / Apple both require it when 2FA is on).
async function fetchMails(cfg) {
  const client = new ImapFlow({
    host: resolveSecrets(cfg.imapHost || '{{secret:IMAP_HOST}}'),
    port: Number(cfg.imapPort) || 993,
    secure: true,
    auth: {
      user: resolveSecrets(cfg.imapUser || '{{secret:IMAP_USER}}'),
      pass: resolveSecrets(cfg.imapPassword || '{{secret:IMAP_PASSWORD}}'),
    },
    logger: false,
  });
  await client.connect();
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
          text: (parsed?.text || '').replace(/\s+/g, ' ').slice(0, 1200),
        });
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return mails;
}

const PROMPT = `You are an email triage bot. You receive a JSON list of emails.
Return ONLY a JSON object with this shape:
{
  "headline": "one-sentence overview",
  "important": [{"from": "...", "subject": "...", "why": "short reason", "action": "suggested next step"}],
  "categories": [{"name": "e.g. Work / Finance / Newsletter / Social / Spam", "count": 0, "examples": ["subject", "..."]}],
  "todos": ["concrete action items extracted from the emails"]
}
Be terse. Ignore obvious marketing in "important". Respond in the language: `;

export async function runDigest(widget) {
  if (!llmConfigured()) throw new HttpError(400, 'LLM_API_KEY is not set in .env');
  const cfg = widget.config;
  const mails = await fetchMails(cfg);
  let result;
  if (!mails.length) {
    result = { headline: 'Nincs új levél a megadott időszakban.', important: [], categories: [], todos: [] };
  } else {
    const extra = cfg.instructions ? `\nExtra user rules: ${cfg.instructions}` : '';
    const raw = await chat(
      [
        { role: 'system', content: PROMPT + (cfg.language || 'Hungarian') + extra },
        { role: 'user', content: JSON.stringify(mails) },
      ],
      { json: true, model: cfg.model || undefined, temperature: 0.2 },
    );
    try {
      result = JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim());
    } catch {
      result = { headline: raw.slice(0, 500), important: [], categories: [], todos: [] };
    }
  }
  result.mailCount = mails.length;
  const { rows } = await q(
    'INSERT INTO mail_digests (widget_id, result) VALUES ($1, $2) RETURNING result, created_at',
    [widget.id, JSON.stringify(result)],
  );
  await q(
    `DELETE FROM mail_digests WHERE widget_id = $1 AND id NOT IN
       (SELECT id FROM mail_digests WHERE widget_id = $1 ORDER BY id DESC LIMIT 20)`,
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
  res.json(rows[0] ?? null);
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
