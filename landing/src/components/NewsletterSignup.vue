<script setup lang="ts">
import { computed, ref } from 'vue';
import { FORMSPREE_ENDPOINT } from '@/site';
import { useI18n } from '@/i18n';

const { t } = useI18n();

const email = ref('');
const honeypot = ref(''); // spam trap — real users never fill this
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle');

// Same Formspree endpoint as the idea form; a `type` field + distinct subject
// keep newsletter signups sortable from feedback in the inbox. No separate
// backend needed, which keeps the site's "no third-party analytics" promise.
const configured = computed(() => !FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID'));
const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
const canSend = computed(() => configured.value && isValidEmail.value && state.value !== 'sending');

async function submit() {
  if (!canSend.value) return;
  if (honeypot.value) return; // bot filled the trap — silently drop
  state.value = 'sending';
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({
        type: 'newsletter',
        email: email.value.trim(),
        _subject: 'TabStyr — newsletter signup',
        _gotcha: honeypot.value,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = 'done';
    email.value = '';
  } catch {
    state.value = 'error';
  }
}
</script>

<template>
  <section class="news" aria-labelledby="news-title">
    <h3 id="news-title" class="head">{{ t('newsletter.title') }}</h3>
    <p class="sub">{{ t('newsletter.sub') }}</p>

    <p v-if="state === 'done'" class="ok" role="status" aria-live="polite">{{ t('newsletter.done') }}</p>

    <form v-else class="row" novalidate @submit.prevent="submit">
      <label for="news-email" class="sr-only">{{ t('newsletter.title') }}</label>
      <input
        id="news-email"
        v-model="email"
        type="email"
        class="control"
        :placeholder="t('newsletter.placeholder')"
        autocomplete="email"
        required
      />
      <!-- honeypot: hidden from users, dropped by Formspree's _gotcha too -->
      <input v-model="honeypot" name="_gotcha" class="gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button type="submit" class="btn btn-primary" :disabled="!canSend">
        {{ state === 'sending' ? t('newsletter.sending') : t('newsletter.button') }}
      </button>
    </form>

    <p v-if="state === 'error'" class="err" role="alert">{{ t('newsletter.error') }}</p>
  </section>
</template>

<style scoped>
.news { max-width: 300px; }
.head { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); margin: 0 0 4px; }
.sub { color: var(--text-3); font-size: 14px; line-height: 1.5; margin: 0 0 14px; max-width: 260px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.control {
  flex: 1 1 160px; min-width: 0; box-sizing: border-box;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); font: inherit; font-size: 15px; padding: 11px 13px;
  transition: border-color 160ms ease;
}
.control:focus { outline: none; border-color: var(--accent); }
.row .btn { height: 44px; padding: 0 18px; font-size: 14px; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gotcha { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.ok { color: var(--accent); font-size: 14px; margin: 0; font-weight: 600; }
.err { color: #ff8080; font-size: 14px; margin: 10px 0 0; }
</style>
