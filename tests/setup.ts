// Register the real i18n instance for every component mount so components that
// call useI18n() work in tests without each test wiring it up.
import { config } from '@vue/test-utils';
import { i18n } from '@/lib/i18n';

config.global.plugins = [i18n];
