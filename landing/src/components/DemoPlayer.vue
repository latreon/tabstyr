<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  src: string;
  poster: string;
  label: string;
  watchLabel: string;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);
const wrapEl = ref<HTMLElement | null>(null);
const started = ref(false); // has playback ever begun — swaps the poster out for good
const playing = ref(false);
const ended = ref(false);
const muted = ref(true); // starts muted so the initial play() is never blocked by autoplay policy
const duration = ref(0);
const currentTime = ref(0);
const showControls = ref(true);
const scrubbing = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function fmt(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (playing.value && !scrubbing.value) showControls.value = false;
  }, 2200);
}
function wake() {
  showControls.value = true;
  scheduleHide();
}

async function play() {
  started.value = true;
  ended.value = false;
  try {
    await videoEl.value?.play();
  } catch {
    // Autoplay-with-sound can be blocked; muted is the fallback and is already
    // the default state here, so a retry would succeed — surfacing an error
    // isn't useful to the visitor.
  }
}
function togglePlay() {
  if (!started.value) { void play(); return; }
  if (videoEl.value?.paused) void play();
  else videoEl.value?.pause();
}
function toggleMute() {
  muted.value = !muted.value;
}
function onTimeUpdate() {
  if (!videoEl.value) return;
  currentTime.value = videoEl.value.currentTime;
}
function onLoadedMetadata() {
  if (!videoEl.value) return;
  duration.value = videoEl.value.duration;
}
function onEnded() {
  playing.value = false;
  ended.value = true;
  showControls.value = true;
}
function replay() {
  if (!videoEl.value) return;
  videoEl.value.currentTime = 0;
  ended.value = false;
  void play();
}

function seekTo(clientX: number) {
  const bar = wrapEl.value?.querySelector('.scrub') as HTMLElement | null;
  if (!bar || !videoEl.value || !duration.value) return;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  videoEl.value.currentTime = ratio * duration.value;
}
function onScrubDown(e: MouseEvent) {
  scrubbing.value = true;
  seekTo(e.clientX);
}
function onScrubMove(e: MouseEvent) {
  if (scrubbing.value) seekTo(e.clientX);
}
function onScrubUp() {
  scrubbing.value = false;
  scheduleHide();
}

function onFullscreen() {
  wrapEl.value?.requestFullscreen?.().catch(() => {});
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    togglePlay();
  }
}

onMounted(() => {
  window.addEventListener('mouseup', onScrubUp);
  window.addEventListener('mousemove', onScrubMove);
});
onBeforeUnmount(() => {
  clearTimeout(hideTimer);
  window.removeEventListener('mouseup', onScrubUp);
  window.removeEventListener('mousemove', onScrubMove);
});
</script>

<template>
  <figure ref="wrapEl" class="player" :class="{ idle: !showControls && playing }" @mousemove="wake" @mouseleave="() => playing && (showControls = false)">
    <!-- preload="none": nothing downloads until the visitor presses play, so
         the 1.8MB clip never costs a byte of the initial page weight. -->
    <video
      ref="videoEl"
      preload="none"
      :poster="poster"
      :aria-label="label"
      @click="togglePlay"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      :muted="muted"
    >
      <source :src="src" type="video/mp4" />
    </video>

    <!-- Cold-start cover: the real poster image plus a big glass play button.
         Once playback starts this fades out and never comes back (a
         re-poster on pause would fight the custom controls below). -->
    <button v-if="!started" type="button" class="cover" :aria-label="watchLabel" @click="play" @keydown="onKeydown">
      <span class="ring" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span class="watch-label">{{ watchLabel }}</span>
    </button>

    <!-- Replay overlay once the clip finishes. -->
    <button v-else-if="ended" type="button" class="cover replay-cover" aria-label="Replay" @click="replay">
      <span class="ring" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4v6h6" /><path d="M4.5 13a8 8 0 1 0 2-8.5L4 8" />
        </svg>
      </span>
    </button>

    <!-- Custom control bar — replaces the browser's native (inconsistent,
         dated-looking) controls entirely. -->
    <div v-if="started" class="controls" :class="{ visible: showControls || !playing }">
      <div
        class="scrub"
        role="slider"
        :aria-valuenow="Math.round(currentTime)"
        :aria-valuemax="Math.round(duration)"
        aria-label="Seek"
        tabindex="0"
        @mousedown="onScrubDown"
      >
        <div class="scrub-fill" :style="{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }" />
        <div class="scrub-thumb" :style="{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }" />
      </div>

      <div class="row">
        <button type="button" class="icon-btn" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay">
          <svg v-if="playing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 5v14M16 5v14" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5z" /></svg>
        </button>

        <span class="time">{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>

        <span class="spacer" />

        <button type="button" class="icon-btn" :aria-label="muted ? 'Unmute' : 'Mute'" @click="toggleMute">
          <svg v-if="muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M17 9l4 6M21 9l-4 6" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 7a7 7 0 0 1 0 10" />
          </svg>
        </button>

        <button type="button" class="icon-btn" aria-label="Fullscreen" @click="onFullscreen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.player {
  position: relative;
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-pop);
  background: #000;
  aspect-ratio: 16 / 10;
  cursor: pointer;
}
.player video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.player.idle { cursor: none; }

.cover {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.45));
  color: #fff;
}
.ring {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 0 0 rgba(139, 139, 250, 0.5);
  transition: transform 200ms ease, background 200ms ease, box-shadow 200ms ease;
  animation: pulse 2600ms ease-out infinite;
}
.cover:hover .ring, .cover:focus-visible .ring {
  transform: scale(1.08);
  background: var(--accent-grad);
}
.ring svg { width: 30px; height: 30px; margin-left: 3px; }
.watch-label {
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.replay-cover { background: rgba(10, 10, 15, 0.55); }
.replay-cover .ring { animation: none; }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(139, 139, 250, 0.45); }
  70% { box-shadow: 0 0 0 16px rgba(139, 139, 250, 0); }
  100% { box-shadow: 0 0 0 0 rgba(139, 139, 250, 0); }
}

.controls {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 10px 14px 12px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.72) 60%);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 200ms ease, transform 200ms ease;
  pointer-events: none;
}
.controls.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }

.scrub {
  position: relative;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  margin-bottom: 10px;
  cursor: pointer;
}
.scrub-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: var(--accent-grad);
}
.scrub-thumb {
  position: absolute;
  top: 50%;
  width: 11px; height: 11px;
  border-radius: 999px;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.25);
}

.row { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 32px; height: 32px;
  display: grid; place-items: center;
  border: none; background: transparent;
  color: #fff; cursor: pointer;
  border-radius: 8px;
  transition: background 160ms ease;
}
.icon-btn:hover, .icon-btn:focus-visible { background: rgba(255, 255, 255, 0.14); }
.icon-btn svg { width: 18px; height: 18px; }
.time { color: rgba(255, 255, 255, 0.85); font-size: 12.5px; font-variant-numeric: tabular-nums; margin-left: 4px; }
.spacer { flex: 1; }
</style>
