import { useTranslation } from 'react-i18next';
import type { SharedStyle } from '../../../types';
import { PALETTES } from '../../../utils/palettes';
import { CheckIcon, ImageIcon } from '../../../icons';
import { Collapsible } from '../shared';

interface BackgroundPanelProps {
  open: boolean;
  onToggle: () => void;
  style: SharedStyle;
  onPatchStyle: (patch: Partial<SharedStyle>) => void;
  styleBadge?: string;
  bgInputRef: React.RefObject<HTMLInputElement>;
  onBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditPosition: () => void;
}

export function BackgroundPanel({
  open, onToggle, style, onPatchStyle, styleBadge, bgInputRef, onBgUpload, onEditPosition,
}: BackgroundPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('background.label')} badge={styleBadge} badgeColor="indigo" open={open} onToggle={onToggle}>
      <div className="space-y-4">
        {/* Palette swatches */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">{t('palette.label')}</p>
          <div className="grid grid-cols-4 gap-2">
            {PALETTES.map((pal) => (
              <button
                key={pal.id}
                onClick={() => onPatchStyle({ palette: pal })}
                title={pal.name}
                className={`relative rounded-lg overflow-hidden h-10 transition-all ${style.palette.id === pal.id
                  ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105'
                  : 'hover:ring-1 hover:ring-gray-300'
                  }`}
                style={{ background: pal.background }}
              >
                <span className="absolute inset-0 flex items-end justify-start p-1" style={{ color: pal.primary, fontSize: 8, fontWeight: 600, opacity: 0.85 }}>
                  {pal.name}
                </span>
                {style.palette.id === pal.id && (
                  <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                    <CheckIcon className="w-2 h-2 text-indigo-600" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Background override */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">{t('background.ownLabel')}</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onPatchStyle({ bgTransparent: !style.bgTransparent, bgImage: null, bgColor: null })}
              title={t('background.transparent')}
              className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${style.bgTransparent ? 'border-indigo-500 scale-105' : 'border-gray-200 hover:border-gray-400'}`}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" fill="#fff" />
                <rect x="0" y="0" width="10" height="10" fill="#ccc" /><rect x="20" y="0" width="10" height="10" fill="#ccc" />
                <rect x="10" y="10" width="10" height="10" fill="#ccc" /><rect x="30" y="10" width="10" height="10" fill="#ccc" />
                <rect x="0" y="20" width="10" height="10" fill="#ccc" /><rect x="20" y="20" width="10" height="10" fill="#ccc" />
                <rect x="10" y="30" width="10" height="10" fill="#ccc" /><rect x="30" y="30" width="10" height="10" fill="#ccc" />
              </svg>
            </button>
            <label title={t('background.customColor')} className="relative w-10 h-10 rounded-lg border-2 overflow-hidden cursor-pointer transition-all hover:border-indigo-400 border-gray-200">
              <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={style.bgColor ?? '#ffffff'} onChange={(e) => onPatchStyle({ bgColor: e.target.value, bgImage: null, bgTransparent: false })} />
              <div className="w-full h-full" style={{ background: style.bgColor ?? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
            </label>
            <button
              onClick={() => bgInputRef.current?.click()}
              title={t('background.uploadPhoto')}
              className={`w-10 h-10 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${style.bgImage ? 'border-indigo-500' : 'border-gray-200 hover:border-gray-400'}`}
              style={style.bgImage ? { backgroundImage: `url(${style.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
              {!style.bgImage && <ImageIcon className="w-5 h-5 text-gray-400" />}
            </button>
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={onBgUpload} />
          </div>
          {style.bgImage && (
            <div className="mt-3">
              <button
                onClick={onEditPosition}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                           bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                {t('background.editPosition')}
              </button>
            </div>
          )}
          {(style.bgImage || style.bgColor || style.bgTransparent) && (
            <button onClick={() => onPatchStyle({ bgImage: null, bgColor: null, bgTransparent: false, bgBrightness: 1, bgOpacity: 1, bgZoom: 1, bgOffsetX: 0, bgOffsetY: 0, bgRotate: 0 })} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
              {t('background.reset')}
            </button>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
