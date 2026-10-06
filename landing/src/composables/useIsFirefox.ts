import { onMounted, ref } from 'vue';

// Read after mount: prerendered HTML is built without a visitor's browser.
export function useIsFirefox() {
  const isFirefox = ref(false);
  onMounted(() => {
    isFirefox.value = navigator.userAgent.includes('Firefox/');
  });
  return isFirefox;
}
