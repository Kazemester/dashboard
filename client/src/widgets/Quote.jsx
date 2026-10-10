import React, { useState } from 'react';

const QUOTES = [
  ['A legjobb módja annak, hogy megjósold a jövőt, ha megteremted.', 'Peter Drucker'],
  ['Nem az a kérdés, hogy van-e időd, hanem hogy mire használod.', 'ismeretlen'],
  ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['Make it work, make it right, make it fast.', 'Kent Beck'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Az ember addig él, amíg tanul.', 'magyar közmondás'],
  ['Lassan járj, tovább érsz.', 'magyar közmondás'],
  ['Sometimes you gotta run before you can walk.', 'Tony Stark'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'kínai közmondás'],
  ['What gets measured gets managed.', 'Peter Drucker'],
  ['Focus is saying no to a thousand good ideas.', 'Steve Jobs'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Discipline equals freedom.', 'Jocko Willink'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['First, solve the problem. Then, write the code.', 'John Johnson'],
  ['Any sufficiently advanced technology is indistinguishable from magic.', 'Arthur C. Clarke'],
  ['Well begun is half done.', 'Arisztotelész'],
  ['If you can’t explain it simply, you don’t understand it well enough.', 'a mondást Einsteinnek tulajdonítják'],
  ['Hope is not a strategy.', 'mérnöki mondás'],
  ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
  ['Amit ma megtehetsz, ne halaszd holnapra.', 'magyar közmondás'],
  ['Small daily improvements over time lead to stunning results.', 'Robin Sharma'],
  ['The obstacle is the way.', 'Ryan Holiday (Marcus Aurelius nyomán)'],
  ['Stay hungry, stay foolish.', 'Whole Earth Catalog / Steve Jobs'],
];

export default function Quote({ widget }) {
  const dayIndex = Math.floor(Date.now() / 86400_000);
  const extra = String(widget.config.custom || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [t, a] = l.split(/\s+[—–-]\s+/);
      return [t, a || ''];
    });
  const list = widget.config.onlyCustom && extra.length ? extra : [...QUOTES, ...extra];
  const [offset, setOffset] = useState(0);
  const [text, author] = list[(dayIndex + offset) % list.length];
  return (
    <div className="quote" onClick={() => setOffset((o) => o + 1)} title="Kattints a következőhöz">
      <blockquote>{text}</blockquote>
      {author && <cite>— {author}</cite>}
    </div>
  );
}
