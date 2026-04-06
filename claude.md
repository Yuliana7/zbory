# "Zbory" app

## Intro:
I want to build a tool for Ukrainian volunteers to help them collect statistics and insigts from the fundraiser campaigns. 

## Goal:
This tool should be optimised to output png files the size of instagram posts and stories.
For example, consider this data format from a fundraiser:

Дата та час операції Категорія операції Сума Валюта Додаткова інформація Коментар до платежу Залишок Валюта залишку
09.10.2025 18:13 За посиланням 2000.00 UAH Від: Назар Поповнення рахунку банки 170000.00 UAH
09.10.2025 17:27 Разові поповнення 20.00 UAH З чорної картки Поповнення рахунку банки 168000.00 UAH
09.10.2025 17:26 За посиланням 30.00 UAH Від: Яна Поповнення рахунку банки 167980.00 UAH

The number of data entries can be very large, depending on the target of the campaign obvously.

Who exactly are your users? -> “Instagram-only” people
Typical dataset size? -> thousands of rows, needs to be able to process heavy csv files, as some fundraisers are for millinons of hryvnias and can last up to 6 months (lots of dinations)

## Tech stack
TS (type safety), ReactJS/Vue.js 

## Development plan

### V1 Feature Set

1. CSV Upload (single format)
Drag & drop file
Show preview (first 5–10 rows)
Auto-detect columns:
date/time
amount
(optional) donor name

👉 No manual mapping UI (too complex for v1)

2. Auto Insights (generated instantly)

Keep it to 5–6 insights max:

💰 Summary
Total collected
Number of donations
Average donation
📈 Progress
Cumulative donations over time
🔥 Best day
“Most donations received on X”
⏰ Best time
“Most donations happen around 20:00–22:00”
⚖️ Donation distribution
% small vs large donations

👉 Important:
These should be sentences, not charts-first thinking

3. Instagram Templates (this is the product)

Start with 3 templates only:

🟪 Template 1: Progress Card (Post)
Total raised
Progress bar
Goal (optional input)
📱 Template 2: Daily Activity (Story)
Donations over time chart
Highlight best day
💛 Template 3: Thank You Card
Total donors
Total amount
Simple emotional tone

👉 Each template:

fixed layout
auto-filled
minimal customization

4. Export to PNG
1080×1080 (post)
1080×1920 (story)
One-click download
❌ Explicitly NOT in V1
No accounts
No saving projects
No editing charts manually
No ML
No multi-file merging
No mobile app

### Data Pipeline (simple + scalable)

Here’s the clean mental model:

CSV → Parse → Normalize → Aggregate → Insights → Visual Templates → PNG
🧱 Step-by-step

1. Parse CSV

Use something like:

papaparse

Output:

RawRow[]

2. Normalize data

Convert into clean structure:

type Donation = {
  timestamp: Date
  amount: number
  donor?: string
}

Handle:

Ukrainian formats (, vs .)
date parsing (DD.MM.YYYY HH:mm)

3. Aggregate (this is key)

Create derived data:

type Aggregates = {
  totalAmount: number
  donationCount: number
  avgDonation: number

  byDay: Map<string, number>
  byHour: Map<number, number>

  cumulative: Array<{ date: string, total: number }>
}

👉 This step makes everything fast later

4. Generate insights

Turn aggregates → human text:

type Insight = {
  title: string
  value: string
}

Example:

"Most donations happen between 20:00–22:00"

5. Feed templates

Each template gets:

{
  aggregates,
  insights,
  goal?: number
}

6. Render → PNG

Two approaches:

render via <canvas>

### UI Structure (super minimal)

Think: 3 screens max

🟩 Screen 1: Upload
----------------------------------
  Drop your CSV file here
----------------------------------

[ Upload button ]

(Example file link)

After upload:

show small preview table
auto-confirm parsing

👉 No settings yet

🟦 Screen 2: Insights + Templates

Split into 2 parts:

------------------------------
Insights (left)
------------------------------
💰 Total: 170,000 UAH
🔥 Best day: Oct 9
⏰ Peak time: 20:00–22:00
...

------------------------------
Templates (right)
------------------------------
[ Progress Card ]
[ Daily Activity ]
[ Thank You ]

👉 Clicking template → opens preview

🟪 Screen 3: Preview + Export
[ Template Preview ]

[ Optional: Enter Goal ]

[ Download PNG ]
🎨 UX principles (this will make or break it)
1. No empty states confusion

Always show something useful immediately

2. Opinionated defaults
auto currency = UAH
auto formatting
no configuration overload
3. Fast feedback
parsing < 1–2 seconds
preview instant
4. Emotional tone

Not just stats:

👉 “You’ve collected 170,000 UAH 💙💛”
👉 “People supported you most on Friday”

🧠 Final framing

You’re not building:

a data analytics tool

You’re building:

✨ a storytelling engine for fundraisers

## Instructions
Always ask before writing code if the info is unclear or you need to clarify something;
Iterate, do not write everything in one bulk, let me review;
Mind, the interface should be in Ukrainian;
Feel free to use TailwindCSS or Material UI as a component library;
Mind the scaling in the future, we will add more features;
We may need to add ML later, make the forntend adaptable;
This is a PWA, make it look nice on any screen, so the user just downloads the code and opens their browser