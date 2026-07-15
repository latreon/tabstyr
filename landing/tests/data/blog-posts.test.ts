import { describe, expect, test } from 'vitest';
import { BLOG_POSTS } from '@/data/blog-posts';
import { renderMarkdown } from '@/lib/markdown';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('BLOG_POSTS', () => {
  test('is non-empty', () => {
    expect(BLOG_POSTS.length).toBeGreaterThan(0);
  });

  test('every post has all required non-empty fields', () => {
    for (const post of BLOG_POSTS) {
      expect(post.slug, 'slug').toBeTruthy();
      expect(post.title, `${post.slug}.title`).toBeTruthy();
      expect(post.date, `${post.slug}.date`).toBeTruthy();
      expect(post.excerpt, `${post.slug}.excerpt`).toBeTruthy();
      expect(post.body, `${post.slug}.body`).toBeTruthy();
    }
  });

  test('slugs are unique', () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('slugs are URL-safe (lowercase, hyphen-separated)', () => {
    for (const post of BLOG_POSTS) expect(post.slug).toMatch(SLUG_RE);
  });

  test('dates are YYYY-MM-DD and actually parse', () => {
    for (const post of BLOG_POSTS) {
      expect(post.date).toMatch(DATE_RE);
      expect(Number.isNaN(Date.parse(post.date))).toBe(false);
    }
  });

  test('every post body renders through renderMarkdown without throwing', () => {
    for (const post of BLOG_POSTS) {
      expect(() => renderMarkdown(post.body)).not.toThrow();
    }
  });

  test('every post body produces non-empty rendered HTML', () => {
    for (const post of BLOG_POSTS) {
      expect(renderMarkdown(post.body).length, post.slug).toBeGreaterThan(0);
    }
  });
});
