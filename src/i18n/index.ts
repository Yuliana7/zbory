import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonUk from './locales/uk/common.json';
import uploadUk from './locales/uk/upload.json';
import insightsUk from './locales/uk/insights.json';
import galleryUk from './locales/uk/gallery.json';
import exportUk from './locales/uk/export.json';
import cardsUk from './locales/uk/cards.json';
import templatesUk from './locales/uk/templates.json';
import manualUk from './locales/uk/manual.json';
import campaignsUk from './locales/uk/campaigns.json';

i18n.use(initReactI18next).init({
  lng: 'uk',
  fallbackLng: 'uk',
  ns: ['common', 'upload', 'insights', 'gallery', 'export', 'cards', 'templates', 'manual', 'campaigns'],
  defaultNS: 'common',
  resources: {
    uk: {
      common: commonUk,
      upload: uploadUk,
      insights: insightsUk,
      gallery: galleryUk,
      export: exportUk,
      cards: cardsUk,
      templates: templatesUk,
      manual: manualUk,
      campaigns: campaignsUk,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
