import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

// Dark mode, without a `dark:` on every element: the colour scales the app uses are rebuilt on CSS
// variables, one set per kind of use (backgrounds, borders/lines, text/glyphs), and `.dark` on <html>
// swaps the values. A shade only flips where flipping is right:
//   backgrounds and borders: the light shades (50–300) become deep ones; the strong shades (400+)
//     stay, so a solid indigo button, its hover, and the always-dark bar of the editor are untouched;
//   text: the dark shades (500–900) become light ones; the light shades (50–300) stay, as they are
//     only ever used on a coloured or dark fill.
// `bg-white` is handled in index.css (a white card and a translucent white glass are both "white").
const NAMES = ['gray', 'indigo', 'purple', 'red', 'amber', 'green', 'emerald']
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

// Greys of the dark theme: a navy-tinted ramp, cards on #1a2133 over a darker page.
const DARK_GRAY = {
  bg: { 50: '#131929', 100: '#232b41', 200: '#2e3852', 300: '#3c4864' },
  bd: { 50: '#222a3f', 100: '#2a3450', 200: '#353f5c', 300: '#465270' },
  ink: { 400: '#67738f', 500: '#8f9ab5', 600: '#aab4cb', 700: '#c4cce0', 800: '#dde2ee', 900: '#f1f4fa' },
}
// Coloured scales: the light shade ↔ its deep mirror (50↔950 …), the text shades ↔ light ones.
const MIRROR = { 50: 950, 100: 900, 200: 800, 300: 700 }
const INK = { 500: 400, 600: 400, 700: 300, 800: 200, 900: 100 }

const light = (name, shade) => rgb(colors[name][shade])
// the page's wash: calmer than the deepest purple/indigo of the scale
const DARK_WASH = { 'bg-indigo-50': '#191d42', 'bg-purple-50': '#2a1a4a' }
const dark = (group, name, shade) => {
  if (DARK_WASH[`${group}-${name}-${shade}`]) return DARK_WASH[`${group}-${name}-${shade}`]
  if (name === 'gray') return DARK_GRAY[group][shade]
  if (group === 'ink') return INK[shade] ? colors[name][INK[shade]] : null
  return MIRROR[shade] ? colors[name][MIRROR[shade]] : null
}

/** A colour scale whose values come from variables: `--{group}-{name}-{shade}` */
const scale = (group) =>
  Object.fromEntries(
    NAMES.map((name) => [
      name,
      Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${group}-${name}-${s}) / <alpha-value>)`])),
    ]),
  )

const darkTheme = plugin(({ addBase }) => {
  const root = {}
  const night = {}
  for (const group of ['bg', 'bd', 'ink']) {
    for (const name of NAMES) {
      for (const shade of SHADES) {
        const key = `--${group}-${name}-${shade}`
        root[key] = light(name, shade)
        const d = dark(group, name, shade)
        if (d) night[key] = rgb(d)
      }
    }
  }
  addBase({ ':root': root, '.dark': night })
})

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // the dark theme's variables sit under `.dark`; the class is set from a script, so no source file has it
  safelist: ['dark'],
  theme: {
    extend: {
      colors: {
        'ukraine-blue': '#0057B7',
        'ukraine-yellow': '#FFD700',
      },
      // the app's one gradient (indigo-900 → indigo-600): cards, tiles and the logo all use it
      backgroundImage: { brand: 'linear-gradient(to bottom right, #312e81, #4f46e5)' },
      backgroundColor: scale('bg'),
      gradientColorStops: scale('bg'),
      borderColor: scale('bd'),
      divideColor: scale('bd'),
      ringColor: scale('bd'),
      stroke: scale('bd'),
      textColor: scale('ink'),
      placeholderColor: scale('ink'),
      fill: scale('ink'),
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [darkTheme],
}
