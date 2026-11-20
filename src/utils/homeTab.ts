// The home screen's two views, remembered for the visit: coming back from a jar's cards (or from adding
// jars) lands where it should.

export type HomeTab = 'saved' | 'own';
const TAB_KEY = 'zbory.homeTab';

/** null = nothing chosen this visit yet */
export const readHomeTab = (): HomeTab | null => {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return v === 'own' || v === 'saved' ? v : null;
  } catch {
    return null;
  }
};

export const rememberHomeTab = (tab: HomeTab) => {
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    /* only the memory of the tab is lost */
  }
};
