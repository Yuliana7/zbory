# Збори · Zbory

**Turn a Monobank jar statement into a clear picture of your fundraiser — and into ready-to-post graphics for Instagram, Telegram and Stories.**

**[Open the app → yuliana7.github.io/zbory](https://yuliana7.github.io/zbory/)** · **[Посібник для волонтерів (українською) →](docs/USER_GUIDE.uk.md)**

> 🇺🇦 **Коротко:** веб-застосунок для волонтерів. Завантажте CSV-виписку банки monobank або отримайте дані одразу через Monobank API (за персональним токеном, без файлу) — отримайте аналітику збору (хто і коли донатить, хто тримає збір) та 24 готові шаблони для сторіс і дописів з вашим фоном, кольорами та текстами. Усе працює у браузері, виписка нікуди не надсилається. Інтерфейс — українською.

<p align="center">
  <img src="docs/screenshots/20-export-with-photo.jpg" alt="A friends leaderboard card with your own photo, on a phone" width="260">
  &nbsp;&nbsp;
  <img src="docs/screenshots/14-background-editor.jpg" alt="Full-screen background editor with pinch-to-zoom and rotate" width="260">
</p>

## Why this exists

Running a fundraiser is two jobs. The first is raising the money; the second is *keeping people engaged* — posting updates, saying thank you, showing how far you've come and what's still missing. Volunteers usually do the second job by hand: copy numbers out of a bank statement, work out percentages, then fight a design tool on a phone at midnight.

Monobank jars give you a CSV statement (or an API) and not much else. Zbory takes that data and does the tedious parts:

- **See what's happening** — totals, pace, best day, who donates repeatedly and who carries the jar, when your audience is online, and how your helpers' own jars are doing.
- **Keep people in the race** — it tracks your helpers' jars and raffles: how many people qualify for a prize, which jars are in the running, and the biggest donation so far.
- **Make the graphic in a minute, on a phone** — pick a template, drop in your own photo, remove what you don't need, download a PNG sized for Stories or a post.

It is built for Ukrainian volunteers, mostly working from a phone, so the whole flow is touch-first and the UI is in Ukrainian.

## Screenshots

All screenshots use made-up demo data: the names, amounts and jars are invented.

**Step 1 — your projects, and three ways to start a new one**

| Start | Saved projects | The «Редагувати» menu |
| :---: | :---: | :---: |
| ![CSV, Monobank API or manual entry](docs/screenshots/01-start.jpg) | ![Saved projects, each with Аналітика and Редагувати](docs/screenshots/04-projects.jpg) | ![Menu: update from Monobank, add CSV, edit rows, goal, friends, raffles, rename, download, delete](docs/screenshots/05-edit-menu.jpg) |

**Step 2 — analytics.** One **Оновити** brings in the main jar and every linked friendly jar together.

| Overview | Friendly jars | After a renew |
| :---: | :---: | :---: |
| ![Total raised with the renew button](docs/screenshots/06-analytics.jpg) | ![Friendly jars with targets](docs/screenshots/07-analytics-friends.jpg) | ![What the renew brought, and which jars it can't read](docs/screenshots/25-renew-report.jpg) |

| Raffles and the daily chart | Who holds the fundraiser up |
| :---: | :---: |
| <img src="docs/screenshots/32-analytics-raffles.jpg" alt="Raffles and the last 30 days" width="260"> | <img src="docs/screenshots/08-analytics-audience.jpg" alt="Audience card" width="260"> |

**Friendly jars, in detail**

| All jars | One jar over time | Adding by link |
| :---: | :---: | :---: |
| ![Totals, search, filters and every jar](docs/screenshots/26-friends-page.jpg) | ![Amount growing towards the target, with a daily breakdown](docs/screenshots/27-jar-chart.jpg) | ![Adding jars by their normal link](docs/screenshots/24-friends-editor.jpg) |

**Day by day, and raffles**

| Any period | One day and when people donate | Raffles |
| :---: | :---: | :---: |
| ![Period picker, totals and daily bars](docs/screenshots/29-daily.jpg) | ![One day's breakdown and the weekday × hour map](docs/screenshots/30-daily-day.jpg) | ![Prizes, conditions and who qualifies](docs/screenshots/28-raffles.jpg) |

**Steps 3–4 — pick templates, edit, export**

| Gallery | Friendly jars templates | Raffle templates |
| :---: | :---: | :---: |
| ![Template gallery](docs/screenshots/09-gallery.jpg) | ![The friends group in the gallery](docs/screenshots/10-gallery-friends.jpg) | ![The raffles group in the gallery](docs/screenshots/31-gallery-raffles.jpg) |

| Editor | Text size per element | Friends picker |
| :---: | :---: | :---: |
| ![Editing the card](docs/screenshots/11-export.jpg) | ![Full-screen editor with a size slider for the selected element](docs/screenshots/35-element-editor.jpg) | ![Choose which friends are on the card](docs/screenshots/12-export-friends.jpg) |

| Themes | Background | Donation stats card |
| :---: | :---: | :---: |
| ![Saved themes](docs/screenshots/15-export-themes.jpg) | ![Colours and your own photo](docs/screenshots/13-export-background.jpg) | ![Median, most frequent and mean donation](docs/screenshots/33-card-donation-stats.jpg) |

The exported PNG (1080×1920 here):

<p align="center"><img src="docs/screenshots/card-friends-leaderboard.jpg" alt="Exported friends leaderboard card" width="260"></p>

On desktop: [projects](docs/screenshots/22-desktop-projects.jpg) · [analytics](docs/screenshots/23-desktop-analytics.jpg) · [editor](docs/screenshots/21-desktop-export.jpg).

Importing from the Monobank API has its own [step-by-step guide](#importing-from-monobank-step-by-step) below.

## Features

### Analytics
- Parses the CSV statement exported from a Monobank jar, **or fetches it straight from the Monobank API**, or lets you type donations in by hand.
- Total raised, donation count, typical (median) vs. average donation, most frequent amount, best day, time-of-day activity, campaign duration.
- **One Оновити** on the total reads the main jar's statement and every linked helper jar in parallel, then saves once, so the page can't drift out of sync. Jars entered by hand can't be read, so the report names them.
- A daily chart of donations and withdrawals for up to the last 30 days. **Детальніше** opens **День за днем**: any period compared with the one before, daily bars or a running total, a tap-through breakdown of each day (amount, donors, hours, comments), a weekday × hour map of when people donate, and a shortcut to a card for that period. The «На рахунку» / refunds figures appear only when there are withdrawals or refunds.
- Repeat donors and most generous donors; anonymous donations are counted but kept out of the lists.
- **«Хто тримає збір»:** how much of the jar the regular donors and the top three carry, with a one-tap shortcut to a thank-you template.
- Goal: shown as progress on the templates.
- **Refund detection** — Monobank doesn't list refunds in the statement; the app infers them from balance vs. donations vs. withdrawals.

### Templates & editing
- **24 templates** in six groups: progress, activity, people, friendly jars, raffles and reports.
- **Three formats:** 1080×1080 post, 1080×1350 (4:5) post, 1080×1920 Story.
- **Every element is yours to change** — in the full-screen **Редагувати елементи** view, tap an element to resize its text (50–200%) or remove it, with one undo for both. Any label or text can be edited too.
- **Your own background** with a full-screen, gesture-isolated editor: drag, pinch-to-zoom, two-finger rotate, brightness and opacity. The page doesn't scroll or move the photo by accident while you edit. Large phone photos are scaled down to 3000 px on upload (about 1:1 at maximum zoom), which keeps exports and saved projects light.
- 8 colour palettes, overall and per-element text size, per-card date ranges. On a phone the preview shrinks as you scroll, down to a third of its size, so the controls have room.
- **Series:** build several cards at once; they share one background and style (a card can detach and keep its own).
- **Themes:** save the current look under a name and switch between looks across fundraisers. Applying a theme copies it, so editing or deleting a theme never changes a card you already made. A theme can also be updated with your latest tweaks («Оновити тему»).
- Export a single **PNG**, or the whole series as one **ZIP**. On iOS the file goes through the share sheet ("Save Image").

### Several fundraisers
- **Library** of saved fundraisers kept on your device. Step 1 has two views, *Мої збори* and *Новий збір* (only the latter if nothing is saved). **Аналітика →** on a saved fundraiser goes straight to the analytics with its goal, helpers, background and style intact; **Редагувати** opens a small menu (update from Monobank, add a CSV, edit rows, goal, friends, rename, download CSV, delete), and each option opens a focused full screen for just that one thing. Whatever brings data in saves it automatically and opens the analytics. **Зберегти копію всіх зборів** writes every project to one JSON file (helper history included, the token never), and **Відновити з копії** brings it back on any device without overwriting anything newer.
- **Merge** several statement files into one fundraiser (long campaigns come in chunks).
- **Compare fundraisers:** open several at once for a cross-campaign view and report templates ("Звіт за період", comparison chart).

### Raffles
Prizes live with the project (**Редагувати → Розіграші**, or on the analytics). The app only shows who is in the running; the draw happens elsewhere.

- **Donors:** an optional minimum. A named person counts once and their donations add up; each anonymous donation counts on its own and has to reach the minimum by itself.
- **Friendly jars:** an optional amount raised, with a list of the eligible jars.
- **Biggest donation:** the top amount and how many people match it, with no names on the card. A tie says the winner is picked at random.

Donor and biggest-donation raffles cover the whole fundraiser or any period, even one day. Each type has its own card.

### Monobank API import
Skip the CSV: paste your personal API token and the app pulls a jar's donations directly: jar picker and date range the first time, then **Оновити** on the analytics fetches everything new in one go. Remembering the token on the device is opt-in. See the [step-by-step guide](#importing-from-monobank-step-by-step).

### Friendly jars (дружні збори)
Monobank lets helpers open their own jars that pay into yours. Those donations are already in your statement, just without saying who brought them. Add each helper and you get a leaderboard, a stats card, a page of their own and an optional "of which via friends" line on the progress card. It is **attribution only** and never changes your totals.

**Adding them.** Paste a helper's normal `send.monobank.ua/jar/…` link, one or several at once. The app reads the name, amount, goal and status, and accepts only jars that feed this project's main jar: every helper jar names its main jar, and the project knows its own from the API's `sendId`. A jar that feeds nothing, or feeds another fundraiser, is refused, by long id too. You can also type a helper in by hand, without a link.

Links are resolved by a small stateless worker (see `worker/`), because Monobank's lookup can't be called from a browser. Reading amounts uses one community-documented, unofficial public endpoint (`GET api.monobank.ua/bank/jar/{id}`, no token). If either is unavailable, a pasted long id or manual entry still works; see [finding a long id](#finding-a-helper-jars-long-id).

**Targets.** A helper with a target gets a bar towards it (`raised / target`). Going past the target is fine: the bar fills up, the real percentage (e.g. `142%`) is shown and the helper gets a green ✓. Helpers without a target keep relative bars until any helper gets one.

**Status.** Every helper has an *Відкрита / Закрита* switch. A linked jar the API reports as closed switches by itself, and a closed helper is skipped by renews and stays editable by hand.

**The friends page.** The analytics shows a summary and the five most recently changed jars. **Детальніше** opens every jar with search, filters (open, reached, closed, stalled, no link), sorting, what's left to the target, growth and a forecast at the recent pace. Tap a jar for a chart of its amount growing towards the target and a breakdown of the recorded days. Monobank has no history, so the app keeps its own: one point a day, when the amount changes.

**Staying up to date.** **Оновлювати при відкритті** (on by default) renews stale data when the page opens, but only if it can do all of it in one request. An opt-in **daily reminder** adds a repeating calendar event, so you open the app regularly and the history stays accurate.

**On the cards.** The leaderboard and closed-jars templates have a *Показувати на картці* checklist. It only picks the rows: totals and "reached the target" always count every jar. **Завершені банки друзів** wraps up the closed jars and is offered once a closed helper has raised something. **Завантажити CSV** exports the helper list.

#### Finding a helper jar's long id

Only needed if pasting the link doesn't work. Monobank doesn't show the long id anywhere in its app or on a jar's page, so it has to be read from the page's own network traffic. It takes a minute, **once per helper jar**, on a computer (the browser developer tools are awkward on a phone):

1. Open the helper's public jar link in a desktop browser — the `https://send.monobank.ua/jar/…` link they share.
2. Open the developer tools (**F12**, or **Ctrl+Shift+I** / **⌥⌘I** on a Mac; in Safari first enable *Develop* in *Settings → Advanced*) and go to the **Network** tab.
3. **Reload the page** while the Network tab is open, and type `handler` into the filter box.
4. Click the **`handler`** request (a `POST` to `send.monobank.ua/api/handler`; if there are two, either works) and open its **Response** (or **Preview**) tab.
5. Find **`extJarId`** in the JSON — a long string of letters and digits, about 32 characters, like `3xpbdqzsr7At11TZ9UPtsXneijoi61K2` — and copy only that value.
6. Paste it into the helper's row (link icon → *Прив'язати банку*) or into **Додати за посиланням**. The id is also accepted inside the full link `https://api.monobank.ua/bank/jar/<id>`.

The same response also names the jar's owner (`ownerName`) and shows the jar it belongs to (`mainJar`), which is a handy way to check you picked the right jar. The id is the helper jar's public identifier, not a secret credential, but there is no reason to post it either. If the request isn't there, the page may have changed: manual entry keeps working.

### Everything else
- Installable **PWA**, works offline after the first visit, with an update prompt. The installed app paints the status-bar area in the app's indigo on both iOS and Android.
- **Private by design:** no accounts, no analytics, and no backend apart from one stateless lookup (below) that stores nothing and never sees your statement or token. Your statement is parsed in the browser and stays there (localStorage for the last session, IndexedDB for saved fundraisers). The only outside calls are API import, renewing jars (by hand, or on opening the page if that's turned on), and resolving a pasted jar link through `worker/`.
- Self-hosted Inter font (Cyrillic included), so exported PNGs look the same on every device.

## How to use it

1. **Get your data.** Either export the jar's statement as **CSV** in the monobank app (Monobank support can also send a statement file; the app understands both layouts), or use *З Monobank API* with a personal token — no file needed.
2. **Start a project** in *Новий збір*: upload the CSV, [import via the Monobank API](#importing-from-monobank-step-by-step), or choose *Створити вручну*. It is saved automatically and the analytics opens; the goal and friendly jars can be set from **Редагувати** or the analytics.
3. **Read the analytics,** then go on to the gallery.
4. **Pick one or more templates.** Select several to make a series with a shared look.
5. **Edit and export.** Change the format, add your photo (*Фон та стиль → Редагувати позицію*), resize or remove elements, edit text, save a theme, then **Завантажити PNG** (or the ZIP for a series).
6. **Come back any time:** every fundraiser is saved as it changes — pick it in *Мої збори* and tap **Аналітика →**.

## Importing from Monobank (step by step)

No CSV needed: the app can read a jar's donations straight from Monobank with a personal API token. It takes about a minute the first time.

<p align="center">
  <img src="docs/screenshots/16-monobank-token.jpg" alt="Instructions and token field" width="230">
  &nbsp;
  <img src="docs/screenshots/17-monobank-jars.jpg" alt="Choosing a jar" width="230">
  &nbsp;
  <img src="docs/screenshots/18-monobank-range.jpg" alt="Choosing the date range" width="230">
</p>

### 1. Get a token
1. Open **[api.monobank.ua](https://api.monobank.ua/)** and sign in through the monobank app.
2. Copy the personal token the site shows you. (The same instructions are on the import screen.)

### 2. Import
1. On step 1 open **Новий збір → З Monobank API**.
2. Paste the token and tap **Показати мої банки**.
3. Pick the jar. Only **hryvnia** jars can be imported; jars in other currencies are listed but greyed out. The jar's goal is used as the campaign goal.
4. Choose the dates — by default the **last 30 days**. Tap **Отримати виписку**.
5. The project is saved automatically, named after the jar, and the analytics opens. Rows can be corrected later from **Редагувати → Редагувати рядки**.

### 3. Update it later
Tap **Оновити** on the total in the analytics (or **Мої збори → Редагувати → Оновити з Monobank**). The app fetches from the day of your newest saved donation until now, merges it, skips anything already there and saves. It asks for the token unless you chose to remember it.

<p align="center">
  <img src="docs/screenshots/05-edit-menu.jpg" alt="The Редагувати menu on a saved project" width="230">
</p>

### Good to know
- **Your token stays on your device.** It is never logged and is sent only to `api.monobank.ua`. By default it lives in memory only; tick **Запам'ятати токен на цьому пристрої** to keep it in this browser's storage for one-tap renews (**Видалити токен** removes it). Only the donations it returned, and the jar's id and name, are saved.
- **Times are shown in your own time zone.** Every donation is stored with its exact moment (Unix time): the API gives it directly, and Monobank's CSV exports — which are always in Kyiv time, with no zone written in them — are read as Kyiv time. That is why rows from the API and from a CSV of the same jar line up and are never counted twice, wherever your device is. (CSV files the app writes stay in Kyiv time, so they re-upload cleanly.) The date range you pick means days on your own clock.
- **Long periods take a few minutes.** Monobank allows one request per minute per endpoint and 31 days per statement request, so a long range is fetched in parts with a visible countdown, and you can stop at any time. A short range is instant.
- **"Monobank did not accept the token"** — copy it again, completely, with no extra characters.
- **"Monobank asks to wait"** — you hit its rate limit; the app waits a minute and retries by itself.
- **Nothing found for the period** — pick wider dates.
- **Friendly jars.** Donations that came through helpers are included like any other donation, but the statement doesn't say who brought them, so [helper jars are tracked separately](#friendly-jars-дружні-збори).
- No token handy? The CSV export and manual entry work exactly as before.

## Tech stack

| | |
| --- | --- |
| UI | React 18 + TypeScript |
| Build | Vite 6, `vite-plugin-pwa` (Workbox) |
| Styling | Tailwind CSS 3 |
| i18n | i18next / react-i18next (Ukrainian) |
| Charts | hand-rolled CSS/SVG charts |
| CSV | PapaParse |
| Image export | `html-to-image` (cards render at native 1080 px and are rasterised offscreen) |
| Monobank | plain `fetch` against the personal API (`src/utils/monobankApi.ts`), which answers browser preflights; a small Cloudflare Worker (`worker/`) only for turning a share link into a long id |
| Storage | IndexedDB (fundraisers, themes) behind a small key-value wrapper with in-memory fallback; localStorage for preferences and, by choice, the token |
| ZIP | a tiny store-only writer (`src/utils/zip.ts`) — PNGs are already compressed, so no dependency |

A few design decisions worth knowing about:

- **Cards are plain React components at 1080 px wide**, scaled down for preview with CSS `zoom` and captured at native size for export — what you see is what you download.
- **Elements** are declared per template (`TEMPLATE_REMOVABLE_ELEMENTS`) and marked with `data-element` in the markup, so every template gets the elements editor for free. Text sizes read a `--el-scale` CSS variable set on those elements.
- **Friendly jars are attribution only.** A helper is `{ name, raised, target?, jarId?, parentJar?, closed?, updatedAt?, syncedAt?, history? }` and is never added to any total: those donations are already in the main jar's statement.
- **Every data change takes one path** (`commitRows` in `AppContext`): save to the library, recompute, open the analytics.
- **The preview's collapse runs on the compositor**, driven by the scroll position (`useCollapsingPreview`), so scrolling causes no React work or layout.
- **Downloads go through one helper** (`src/utils/download.ts`): the share sheet on iOS, an in-document anchor with a delayed `revokeObjectURL` everywhere else.

### Project layout

```
src/
  pages/            Upload, Insights, Gallery, Export (the four steps)
    ExportPage/       editor: canvas, panels, background gestures, ZIP export
  components/
    templates/        the card templates + shared card shell
    insights/         charts, analytics panels, the friends and day-by-day pages
    upload/           new-project options, manual entry, Monobank import, saved-project list and
                      its Редагувати menu; screens/ holds the home page and the focused screens
  context/          app state (reducer) and session wiring
  utils/            parsing, aggregation, insights, storage, export, template config
  i18n/locales/uk/  all UI strings
tests/
  data/             synthetic statements (fake names) used by the tests
  render/           server-render + logic test suites
worker/             the Cloudflare Worker behind adding a jar by link
```

## Development

```bash
npm install
npm run dev          # http://localhost:5173/zbory/
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (the app is served under `/zbory/`) |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run docs:screenshots` | Retake the docs screenshots in WebKit, with made-up data (run `npx playwright install webkit` once first) |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run test:render` | Run the test suites |
| `npm run test:tz` | Run the time-handling suites under several time zones |

### Tests

`npm run test:render` bundles each `tests/render/*Test.ts(x)` suite with esbuild and runs it in Node. They cover template markup (server-rendered), insight and balance maths, the campaign/theme stores, merging, friendly jars, the Monobank client (windowing, paging, rate limits, mapping, with a faked `fetch` and clock), raffles, the day-by-day maths, Ukrainian plural forms, the backup, and image resizing. Fixtures in `tests/data/` are **synthetic** statements — nothing in the repo is a real donor's data.

To try the app without your own statement, upload `tests/data/Zbir_long.csv`.

### Deployment

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`. The app lives under a subpath, so `BASE` in `vite.config.ts` is `/zbory/` and the PWA manifest paths are prefixed with it — keep both in sync if the path changes.

## Roadmap

- **Custom template builder** — compose your own card from the available elements.
- **Friendly jars through an official API** — the personal API exposes nothing about them (`client-info` lists only your own jars, and statement items don't say which helper a donation came through), so the app relies on unofficial endpoints. Being unofficial, none of it is relied on: manual entry always works.

## Contributing

Issues and pull requests are welcome. Please run `npm run lint`, `npm run test:render` and `npm run build` before opening a PR. The repo is public, so tests and screenshots use made-up data only.

## License

[MIT](LICENSE) © 2026 Yuliana Romaniv. Free to use, copy, modify and distribute, with the license notice kept. The Inter font bundled with the app is licensed separately under the SIL Open Font License.
