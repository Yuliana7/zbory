import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'zbory.chunkReload';

/** React.lazy for a named export. After a deploy an open tab can ask for a chunk that no longer
 * exists; it reloads once to pick up the new build instead of leaving a blank page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each page has its own props
export function lazyNamed<M extends Record<K, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => {
    try {
      const mod = await load();
      sessionStorage.removeItem(RELOAD_KEY);
      return { default: mod[name] };
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
