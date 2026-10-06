import { useState } from 'react';

interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD, or '' while empty
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

/** A date input with a floating label: while the field is empty the label sits inside it
 * as grey placeholder text, and once there is a value (or focus) it moves up and shrinks,
 * so a filled field is still clearly "З" or "По". The native "dd.mm.yyyy" hint is hidden
 * while the label is acting as the placeholder. */
export function DateField({ label, value, onChange, min, max, disabled }: DateFieldProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value !== '';
  return (
    <label className="relative block min-w-0">
      <span
        className={`pointer-events-none absolute left-3 z-10 transition-all duration-150 ${
          floated ? 'top-2 text-[11px] font-medium text-gray-500' : 'top-1/2 -translate-y-1/2 text-base text-gray-400'
        }`}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // text-base (16px): anything smaller makes iOS zoom the page on focus.
        // min-w-0 + w-full: iOS gives date inputs an intrinsic width that otherwise squeezes the grid.
        className={`date-field ${floated ? '' : 'date-empty'} block w-full min-w-0 h-14 pt-5 pb-1 px-3 rounded-lg border border-gray-300 bg-white
                    text-base text-gray-900 disabled:bg-gray-50 disabled:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
      />
    </label>
  );
}
