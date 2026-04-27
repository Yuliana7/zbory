import type { TemplateType } from '../types';

export interface TextFieldDef {
  key: string;
  label: string;
  multiline?: boolean;
}

export const TEMPLATE_TEXT_FIELDS: Record<TemplateType, TextFieldDef[]> = {
  progress: [
    { key: 'title', label: 'Назва' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'collectedLabel', label: 'Мітка "Зібрано"' },
    { key: 'currencyLabel', label: 'Назва валюти' },
    { key: 'goalLabel', label: 'Мітка цілі' },
    { key: 'statDonations', label: 'Мітка "Донатів"' },
    { key: 'statAverage', label: 'Мітка "Середній"' },
    { key: 'statMax', label: 'Мітка "Найбільший"' },
  ],
  'daily-activity': [
    { key: 'title', label: 'Назва' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'totalLabel', label: 'Мітка суми' },
    { key: 'chartLabel', label: 'Підпис графіку' },
    { key: 'barsLabel', label: 'Підпис стовпчиків' },
    { key: 'bestDayLabel', label: 'Підпис найкращого дня' },
    { key: 'statDonations', label: 'Мітка "Донатів"' },
    { key: 'statAverage', label: 'Мітка "Середній"' },
  ],
  'thank-you': [
    { key: 'title', label: 'Заголовок' },
    { key: 'amountLabel', label: 'Підпис суми' },
    { key: 'message', label: 'Повідомлення', multiline: true },
    { key: 'donorsLabel', label: 'Підпис донорів' },
    { key: 'branding', label: 'Брендинг внизу' },
  ],
  milestone: [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'achievedLabel', label: 'Текст досягнення' },
    { key: 'collectedLabel', label: 'Мітка зібраного' },
    { key: 'goalLabel', label: 'Мітка цілі' },
    { key: 'donationsLabel', label: 'Мітка донатів' },
  ],
  'top-donors': [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'anonymousLabel', label: 'Текст анонімного' },
    { key: 'donationsLabel', label: 'Підпис (донат/донати)' },
    { key: 'totalDonorsLabel', label: 'Підпис загальної кількості' },
  ],
  'donors-count': [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'donorsLabel', label: 'Підпис під числом' },
    { key: 'avgLabel', label: 'Мітка середнього' },
    { key: 'maxLabel', label: 'Мітка максимального' },
    { key: 'totalLabel', label: 'Мітка суми' },
    { key: 'smallLabel', label: 'Мітка малих (<100 ₴)' },
    { key: 'mediumLabel', label: 'Мітка середніх (100–1000 ₴)' },
    { key: 'largeLabel', label: 'Мітка великих (>1000 ₴)' },
  ],
  urgency: [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'remainingLabel', label: 'Підпис залишку' },
    { key: 'callToAction', label: 'Заклик до дії' },
    { key: 'collectedLabel', label: 'Мітка зібраного' },
    { key: 'goalLabel', label: 'Мітка цілі' },
  ],
  'weekly-recap': [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'thisWeekLabel', label: 'Мітка цього тижня' },
    { key: 'prevWeekLabel', label: 'Мітка попереднього тижня' },
    { key: 'bestDayLabel', label: 'Підпис найкращого дня' },
    { key: 'donationsLabel', label: 'Мітка донатів' },
  ],
  speed: [
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Підзаголовок' },
    { key: 'totalLabel', label: 'Мітка суми' },
    { key: 'donationsLabel', label: 'Мітка донатів' },
    { key: 'peakLabel', label: 'Підпис піку' },
    { key: 'hourlyLabel', label: 'Підпис погодинного графіку' },
  ],
};

export const TEMPLATE_SUPPORTS_DATE_RANGE: Record<TemplateType, boolean> = {
  progress: true,
  'daily-activity': true,
  'thank-you': false,
  milestone: true,
  'top-donors': true,
  'donors-count': true,
  urgency: true,
  'weekly-recap': true,
  speed: true,
};

export const TEMPLATE_REQUIRES_GOAL: Record<TemplateType, boolean> = {
  progress: false,
  'daily-activity': false,
  'thank-you': false,
  milestone: true,
  'top-donors': false,
  'donors-count': false,
  urgency: true,
  'weekly-recap': false,
  speed: false,
};

export const TEMPLATE_DEFAULT_FORMAT: Record<TemplateType, 'post' | 'story'> = {
  progress: 'post',
  'daily-activity': 'story',
  'thank-you': 'post',
  milestone: 'post',
  'top-donors': 'story',
  'donors-count': 'post',
  urgency: 'post',
  'weekly-recap': 'story',
  speed: 'post',
};
