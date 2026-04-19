import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonUk from './locales/uk/common.json';
import uploadUk from './locales/uk/upload.json';
import insightsUk from './locales/uk/insights.json';
import galleryUk from './locales/uk/gallery.json';
import exportUk from './locales/uk/export.json';
import cardsUk from './locales/uk/cards.json';

i18n.use(initReactI18next).init({
  lng: 'uk',
  fallbackLng: 'uk',
  ns: ['common', 'upload', 'insights', 'gallery', 'export', 'cards'],
  defaultNS: 'common',
  resources: {
    uk: {
      common: commonUk,
      upload: uploadUk,
      insights: insightsUk,
      gallery: galleryUk,
      export: exportUk,
      cards: cardsUk,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
