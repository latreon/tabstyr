<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RingLogo from './RingLogo.vue';
import LangSwitch from './LangSwitch.vue';
import { FORMSPREE_ENDPOINT, HCAPTCHA_SITEKEY } from '@/site';
import { localizedPath, locale, useI18n } from '@/i18n';
import SelectBox from './SelectBox.vue';

const { t, tm } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));

const CATEGORIES = computed(() => tm<string[]>('ideaPage.categories'));

const category = ref(CATEGORIES.value[0]);
// When the language switches, the category labels change — keep the selection on a
// valid option (default to the first) so the dropdown and submitted value stay in sync.
watch(CATEGORIES, (next) => {
  if (!next.includes(category.value)) category.value = next[0];
});
const message = ref('');
const email = ref('');
const honeypot = ref(''); // spam trap — real users never fill this
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle');

// hCaptcha (optional) — renders only when a sitekey is configured. The script is
// loaded on this page only, so the third-party request stays off the rest of the site.
const captchaEl = ref<HTMLElement | null>(null);
const captchaSolved = ref(false);
let widgetId: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hc = (): any => (window as unknown as { hcaptcha?: any }).hcaptcha;

function loadHcaptchaScript(): Promise<void> {
  if (hc()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('hCaptcha failed to load'));
    document.head.appendChild(s);
  });
}

onMounted(async () => {
  if (!HCAPTCHA_SITEKEY) return;
  try {
    await loadHcaptchaScript();
    if (hc() && captchaEl.value) {
      widgetId = hc().render(captchaEl.value, {
        sitekey: HCAPTCHA_SITEKEY,
        callback: () => (captchaSolved.value = true),
        'expired-callback': () => (captchaSolved.value = false),
        'error-callback': () => (captchaSolved.value = false),
      });
    }
  } catch {
    // Captcha blocked/offline. The form still posts; Formspree's honeypot + limits
    // remain. If Formspree REQUIRES the captcha, the submit fails closed — intended.
  }
});

onBeforeUnmount(() => {
  if (HCAPTCHA_SITEKEY && hc() && widgetId !== undefined) {
    try { hc().reset(widgetId); } catch { /* noop */ }
  }
});

// Until a real Formspree id is pasted in site.ts, disable the form and explain.
const configured = computed(() => !FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID'));
const canSend = computed(
  () =>
    configured.value &&
    message.value.trim().length > 0 &&
    state.value !== 'sending' &&
    (!HCAPTCHA_SITEKEY || captchaSolved.value),
);

function resetCaptcha() {
  if (HCAPTCHA_SITEKEY && hc() && widgetId !== undefined) {
    try { hc().reset(widgetId); } catch { /* noop */ }
    captchaSolved.value = false;
  }
}

async function submit() {
  if (!canSend.value) return;
  if (honeypot.value) return; // bot filled the trap — silently drop
  const captchaToken: string = HCAPTCHA_SITEKEY && hc() ? hc().getResponse(widgetId) || '' : '';
  if (HCAPTCHA_SITEKEY && !captchaToken) return; // captcha required but unsolved
  state.value = 'sending';
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({
        category: category.value,
        message: message.value.trim(),
        email: email.value.trim() || undefined,
        _subject: `TabStyr idea — ${category.value}`,
        // Formspree's server-side spam trap: a non-empty value here is dropped by
        // Formspree itself, so bots that bypass our client check are still filtered.
        _gotcha: honeypot.value,
        // hCaptcha token — Formspree validates this server-side when hCaptcha is
        // enabled on the form. Omitted entirely when no sitekey is configured.
        ...(captchaToken ? { 'h-captcha-response': captchaToken } : {}),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.value = 'done';
    message.value = '';
    email.value = '';
    resetCaptcha();
  } catch {
    state.value = 'error';
    resetCaptcha();
  }
}
</script>

<template>
  <div class="idea">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <div class="bar-right">
          <LangSwitch />
          <a :href="home" class="back">{{ t('ideaPage.back') }}</a>
        </div>
      </div>
    </header>

    <main class="container body">
      <span class="eyebrow">{{ t('ideaPage.eyebrow') }}</span>
      <h1 class="title">{{ t('ideaPage.titleLead') }} <span class="gradient-text">{{ t('ideaPage.titleAccent') }}</span> {{ t('ideaPage.titleTail') }}</h1>
      <p class="lead">{{ t('ideaPage.lead') }}</p>

      <div class="card glass">
        <!-- Success -->
        <div v-if="state === 'done'" class="result" role="status" aria-live="polite">
          <div class="check" aria-hidden="true">✓</div>
          <h2>{{ t('ideaPage.thankYou') }}</h2>
          <p>{{ t('ideaPage.successBody') }}</p>
          <button type="button" class="btn btn-secondary" @click="state = 'idle'">{{ t('ideaPage.sendAnother') }}</button>
        </div>

        <!-- Not configured yet -->
        <p v-else-if="!configured" class="notice">{{ t('ideaPage.notConfigured') }}</p>

        <!-- Form -->
        <form v-else class="form" @submit.prevent="submit">
          <div class="field">
            <span class="label">{{ t('ideaPage.typeLabel') }}</span>
            <SelectBox v-model="category" :options="CATEGORIES" :label="t('ideaPage.ideaTypeAria')" />
          </div>

          <label class="field">
            <span class="label">{{ t('ideaPage.ideaLabel') }} <span class="req">*</span></span>
            <textarea
              v-model="message"
              class="control"
              rows="5"
              required
              maxlength="2000"
              :placeholder="t('ideaPage.placeholder')"
            />
          </label>

          <label class="field">
            <span class="label">{{ t('ideaPage.emailLabel') }} <span class="opt">{{ t('ideaPage.emailOpt') }}</span></span>
            <input v-model="email" type="email" class="control" placeholder="you@example.com" autocomplete="email" />
          </label>

          <!-- honeypot: visually hidden, off-screen; bots fill it, humans don't.
               name="_gotcha" engages Formspree's own server-side spam filter too. -->
          <input v-model="honeypot" name="_gotcha" class="gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" />

          <!-- hCaptcha widget — rendered only when VITE_HCAPTCHA_SITEKEY is set -->
          <div v-if="HCAPTCHA_SITEKEY" ref="captchaEl" class="captcha" />

          <div class="actions">
            <button type="submit" class="btn btn-primary" :disabled="!canSend">
              {{ state === 'sending' ? t('ideaPage.sending') : t('ideaPage.send') }}
            </button>
            <p v-if="state === 'error'" class="err" role="alert">{{ t('ideaPage.error') }}</p>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.idea { position: relative; min-height: 100vh; }
.orb {
  position: fixed; top: -180px; left: 50%; transform: translateX(-50%);
  width: 700px; height: 380px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.18), transparent 70%); filter: blur(60px);
}
.bar { position: relative; z-index: 1; border-bottom: 1px solid var(--border); }
.bar-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.bar-right { display: flex; align-items: center; gap: 20px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.back { font-size: 14px; color: var(--text-2); transition: color 160ms ease; }
.back:hover { color: var(--text); }
.body { position: relative; z-index: 1; padding-top: 56px; padding-bottom: 96px; }
.eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.title { font-size: clamp(2rem, 1.5rem + 2.6vw, 3rem); font-weight: 700; margin: 12px 0 0; }
.lead { color: var(--text-2); margin: 16px 0 28px; font-size: 16px; line-height: 1.6; max-width: 540px; }
.card { padding: 28px; }
.form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.label { font-size: 13px; font-weight: 600; color: var(--text-2); }
.req { color: var(--accent); }
.opt { color: var(--text-3); font-weight: 400; }
.control {
  width: 100%; box-sizing: border-box;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); font: inherit; font-size: 15px; padding: 11px 13px;
  transition: border-color 160ms ease;
}
.control:focus { outline: none; border-color: var(--accent); }
textarea.control { resize: vertical; min-height: 110px; line-height: 1.5; }
.gotcha { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.captcha { min-height: 78px; }
.actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.err { color: #ff8080; font-size: 14px; margin: 0; }
.notice { color: var(--text-2); font-size: 15px; line-height: 1.6; margin: 0; }
.notice code { background: var(--accent-muted); color: var(--accent); padding: 1px 6px; border-radius: 6px; font-size: 13px; }
.result { text-align: center; padding: 16px 0; }
.result h2 { font-size: 22px; font-weight: 700; margin: 14px 0 6px; }
.result p { color: var(--text-2); margin: 0 0 20px; }
.check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--accent-muted); color: var(--accent); font-size: 26px; font-weight: 700;
}
a { color: var(--accent); }
</style>
