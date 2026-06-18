import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Adds `.is-visible` to every `.reveal` element the first time it scrolls into
 * view. Pure IntersectionObserver — no animation library. Returns `run()` so the
 * scan can be repeated after route/content changes (newly mounted `.reveal` els).
 */
export function useReveal() {
  let observer: IntersectionObserver | null = null;

  function run() {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
      );
    }
    els.forEach((el) => observer?.observe(el));
  }

  onMounted(run);
  onBeforeUnmount(() => observer?.disconnect());

  return { run };
}
