import { describe, expect, test } from 'vitest';
import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  test('renders ## and ### headings', () => {
    expect(renderMarkdown('## Section\n### Sub')).toBe('<h3>Section</h3>\n<h4>Sub</h4>');
  });

  test('renders a paragraph', () => {
    expect(renderMarkdown('Just some text.')).toBe('<p>Just some text.</p>');
  });

  test('renders a single-level bullet list', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
  });

  test('renders a nested bullet list, closing both levels', () => {
    const out = renderMarkdown('- top\n  - nested\n- top2');
    expect(out).toBe('<ul>\n<li>top</li>\n<ul>\n<li>nested</li>\n</ul>\n<li>top2</li>\n</ul>');
  });

  test('closes an open list before a heading or paragraph', () => {
    expect(renderMarkdown('- a\n## Next')).toBe('<ul>\n<li>a</li>\n</ul>\n<h3>Next</h3>');
    expect(renderMarkdown('- a\n\ntext')).toBe('<ul>\n<li>a</li>\n</ul>\n<p>text</p>');
  });

  test('renders bold, italic (both markers), and code inline', () => {
    expect(renderMarkdown('**bold** and *italic* and _also italic_ and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <em>also italic</em> and <code>code</code></p>',
    );
  });

  test('bold is resolved before italic so **x** is not split by the * pair', () => {
    expect(renderMarkdown('**bold text**')).toBe('<p><strong>bold text</strong></p>');
  });

  test('renders an external link with target=_blank and rel=noopener', () => {
    expect(renderMarkdown('[TabStyr](https://tabstyr.com)')).toBe(
      '<p><a href="https://tabstyr.com" target="_blank" rel="noopener">TabStyr</a></p>',
    );
  });

  test('renders an internal link without target/rel', () => {
    expect(renderMarkdown('[privacy policy](/privacy)')).toBe('<p><a href="/privacy">privacy policy</a></p>');
  });

  test('escapes HTML-significant characters so raw markup cannot leak through', () => {
    expect(renderMarkdown('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
  });

  test('escapes characters inside a heading and a list item too', () => {
    expect(renderMarkdown('## a < b')).toBe('<h3>a &lt; b</h3>');
    expect(renderMarkdown('- a & b')).toBe('<ul>\n<li>a &amp; b</li>\n</ul>');
  });

  test('blank lines separate paragraphs without stray empty tags', () => {
    expect(renderMarkdown('first\n\nsecond')).toBe('<p>first</p>\n<p>second</p>');
  });

  test('empty input renders nothing', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
