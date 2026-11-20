import { useTranslation } from 'react-i18next';
import { XIcon } from '../icons';

/** Search by name above a long list. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { t } = useTranslation();
  const label = placeholder ?? t('list.search');
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        // 16px on a phone: anything smaller makes iOS zoom in on focus
        className="w-full pl-3 pr-9 py-2 rounded-lg border border-gray-200 bg-white text-base sm:text-sm text-gray-900 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('list.clear')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** ‹ Назад · 11–20 з 34 · Далі › — shown only when there is more than one page. */
export function Pager({ page, pages, size, shown, total, onPage }: { page: number; pages: number; size: number; shown: number; total: number; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  const from = page * size + 1;
  const button = 'px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 font-medium text-gray-700 transition-colors';
  return (
    <nav aria-label={t('list.pages')} className="flex items-center justify-between gap-3 text-sm text-gray-600">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} className={button}>
        ‹ {t('list.prev')}
      </button>
      <span>{t('list.range', { from, to: from + shown - 1, total })}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages - 1} className={button}>
        {t('list.next')} ›
      </button>
    </nav>
  );
}
