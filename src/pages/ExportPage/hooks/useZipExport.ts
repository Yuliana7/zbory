import { useState, useRef, useEffect } from 'react';
import type { CardState } from '../../../types';
import { FORMAT_DIMS } from '../../../utils/exportStack';
import { renderToPNGDataUrl, dataUrlToBytes } from '../../../utils/exportPNG';
import { createZip } from '../../../utils/zip';

/**
 * Renders every card in the stack offscreen, one at a time (each with its own
 * saved state), and bundles the PNGs into a single downloaded ZIP.
 */
export function useZipExport(cards: CardState[]) {
  const [zipQueue, setZipQueue] = useState<number[]>([]);
  const zipResults = useRef<{ name: string; data: Uint8Array }[]>([]);
  const zipRef = useRef<HTMLDivElement>(null);
  const zipInnerRef = useRef<HTMLDivElement>(null);
  const zipCurrentIdx = zipQueue.length > 0 ? zipQueue[0] : null;
  const zipCard = zipCurrentIdx !== null ? cards[zipCurrentIdx] : null;

  useEffect(() => {
    if (zipCurrentIdx === null) return;
    let cancelled = false;
    const zipCard = cards[zipCurrentIdx];
    const run = async () => {
      // Give the offscreen card a beat to lay out and paint
      await new Promise((r) => setTimeout(r, 150));
      const el = zipRef.current;
      if (!el || cancelled) return;
      const d = FORMAT_DIMS[zipCard.format];
      try {
        const dataUrl = await renderToPNGDataUrl(el, d.width, d.height);
        zipResults.current.push({
          name: `${zipCurrentIdx + 1}-zbory-${zipCard.templateId}-${zipCard.format}.png`,
          data: dataUrlToBytes(dataUrl),
        });
      } catch (err) {
        console.error(`ZIP export failed for ${zipCard.templateId}:`, err);
      }
      if (cancelled) return;
      setZipQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0 && zipResults.current.length > 0) {
          const blob = createZip(zipResults.current);
          zipResults.current = [];
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `zbory-${Date.now()}.zip`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
        return rest;
      });
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the queue head only
  }, [zipCurrentIdx]);

  const startZipExport = () => {
    if (zipQueue.length > 0) return;
    zipResults.current = [];
    setZipQueue(cards.map((_, i) => i));
  };

  return { zipQueue, zipRef, zipInnerRef, zipCard, startZipExport };
}
