/** Restricted document grammar for owner-approved legal sources; never parses raw HTML. */
export type LegalBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };
export function legalBlocks(markdown: string): LegalBlock[] {
  const lines = markdown.split('\n');
  const blocks: LegalBlock[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i++;
      continue;
    }
    const item = /^(?:(-)|(\d+)\.) (.+)$/.exec(line);
    if (item) {
      const ordered = !!item[2],
        items: string[] = [];
      while (i < lines.length) {
        if (!lines[i].trim()) {
          i++;
          continue;
        }
        const next = /^(?:(-)|(\d+)\.) (.+)$/.exec(lines[i].trimEnd());
        if (!next || !!next[2] !== ordered) break;
        items.push(next[3]);
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim())
      paragraph.push(lines[i++].trimEnd());
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}
