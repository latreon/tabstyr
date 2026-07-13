// Minimal markdown → HTML for our own content (GitHub release bodies, blog
// posts) — trusted, authored by us, not user input, so v-html on the output
// is fine. Covers only the subset we actually use: ##/### headings, -/  -
// bullets (one level of nesting), **bold**, *italic*/_italic_, `code`,
// [text](url) links, blank-line paragraphs.

function renderInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // bold first, so a lone * pair below can't split it
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const external = /^https?:\/\//.test(href);
      return external
        ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
        : `<a href="${href}">${label}</a>`;
    });
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let listDepth = 0; // 0 = no list open, 1 = top-level <ul>, 2 = nested <ul> also open

  function closeLists(to: number) {
    while (listDepth > to) {
      out.push('</ul>');
      listDepth--;
    }
  }

  for (const line of lines) {
    const h3 = /^##\s+(.*)/.exec(line);
    const h4 = /^###\s+(.*)/.exec(line);
    const nested = /^ {2,}-\s+(.*)/.exec(line);
    const top = /^-\s+(.*)/.exec(line);

    if (h3) {
      closeLists(0);
      out.push(`<h3>${renderInline(h3[1])}</h3>`);
    } else if (h4) {
      closeLists(0);
      out.push(`<h4>${renderInline(h4[1])}</h4>`);
    } else if (nested) {
      if (listDepth < 2) { out.push('<ul>'); listDepth = 2; }
      out.push(`<li>${renderInline(nested[1])}</li>`);
    } else if (top) {
      closeLists(1);
      if (listDepth < 1) { out.push('<ul>'); listDepth = 1; }
      out.push(`<li>${renderInline(top[1])}</li>`);
    } else if (line.trim() === '') {
      closeLists(0);
    } else {
      closeLists(0);
      out.push(`<p>${renderInline(line)}</p>`);
    }
  }
  closeLists(0);
  return out.join('\n');
}
