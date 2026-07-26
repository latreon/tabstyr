import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { focusTab, openDomain, openPage } from '@/lib/navigate';

// navigate.ts is the ONLY place the extension turns stored data (a domain string, a
// sub-page path) into a navigation. Both stores are writable by an imported backup,
// so these guards are the last line of defence against a crafted value opening a
// javascript:/data:/file: URL or a different origin. Untested until now.

let create: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
  create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
});

describe('openDomain', () => {
  test('opens a real hostname over https', () => {
    openDomain('github.com');
    expect(create).toHaveBeenCalledWith({ url: 'https://github.com/' });
  });

  test('opens a subdomain and a local dev host', () => {
    openDomain('docs.github.com');
    openDomain('localhost');
    expect(create).toHaveBeenNthCalledWith(1, { url: 'https://docs.github.com/' });
    expect(create).toHaveBeenNthCalledWith(2, { url: 'https://localhost/' });
  });

  test('refuses the scheme-word buckets domainOf() returns for internal pages', () => {
    for (const d of ['chrome', 'extension', 'file', 'about', 'other']) openDomain(d);
    expect(create).not.toHaveBeenCalled();
  });

  test('refuses a value carrying a path, query, fragment or credentials', () => {
    for (const d of [
      'github.com/../evil',
      'github.com?x=1',
      'github.com#f',
      'user:pass@github.com',
      'github.com:8080',
      'github .com',
      '',
    ]) {
      openDomain(d);
    }
    expect(create).not.toHaveBeenCalled();
  });

  test('refuses an attempt to smuggle another scheme', () => {
    for (const d of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//evil.com']) {
      openDomain(d);
    }
    expect(create).not.toHaveBeenCalled();
  });
});

describe('openPage', () => {
  test('opens a sub-page on the same host', () => {
    openPage('youtube.com', '/watch');
    expect(create).toHaveBeenCalledWith({ url: 'https://youtube.com/watch' });
  });

  test('adds the leading slash when the stored path lacks one', () => {
    openPage('youtube.com', 'watch');
    expect(create).toHaveBeenCalledWith({ url: 'https://youtube.com/watch' });
  });

  test('keeps a hash route (the stored SPA page identity)', () => {
    openPage('app.example.com', '/mail#/inbox');
    expect(create).toHaveBeenCalledWith({ url: 'https://app.example.com/mail#/inbox' });
  });

  test('refuses a path that would change the origin', () => {
    // `//evil.com/x` after the host reads as a new authority to some parsers; the
    // re-parse catches any result whose hostname is no longer the domain we vetted.
    openPage('good.com', '/@evil.com/x');
    openPage('good.com', '\\\\evil.com');
    for (const call of create.mock.calls) {
      expect(new URL((call[0] as { url: string }).url).hostname).toBe('good.com');
    }
  });

  test('refuses a non-web domain regardless of the path', () => {
    openPage('chrome', '/settings');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('focusTab', () => {
  test('activates the tab and raises its window', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5, windowId: 3 } as never);
    const winUpdate = vi.spyOn(fakeBrowser.windows, 'update').mockResolvedValue({} as never);
    await focusTab(5);
    expect(update).toHaveBeenCalledWith(5, { active: true });
    expect(winUpdate).toHaveBeenCalledWith(3, { focused: true });
  });

  test('a closed tab is logged, never thrown (the caller is a click handler)', async () => {
    vi.spyOn(fakeBrowser.tabs, 'update').mockRejectedValue(new Error('No tab with id'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(focusTab(999)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });
});
