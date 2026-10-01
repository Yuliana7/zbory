/** Paints the area the OS draws over the page (status bar / notch) in the app's
 * indigo, so the installed app looks the same on iOS as on Android — where the
 * browser paints it from the manifest's theme_color. Zero height wherever the OS
 * keeps the page below its own status bar. */
export function SafeAreaTopBar() {
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[400] bg-indigo-600 pointer-events-none"
      style={{ height: 'var(--safe-top)' }}
    />
  )
}
