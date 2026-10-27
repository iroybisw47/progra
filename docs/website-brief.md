# Progra: brief for the marketing / home website

Build a marketing website for **Progra**, a productivity app that is already live on
the iPhone App Store and on the web at progra.world. The site explains what the app
is and how it works, and gets people to download it. Everything below describes the
real, shipping product. Please don't invent features that aren't listed here.

---

## 1. What Progra is, in one breath

Progra is a social productivity app. You set goals with a weekly hour target, clock
in when you work on them, check off daily habits, and your friends see your sessions
in a feed, where they can cheer you on. Your hours add up into charts, streaks and a
weekly review every Monday morning.

**Positioning line (in use today):** "The world's first community-based productivity app."
**Sign-in screen tagline:** "Log self improvement sessions, track your habits, and share
your progress with friends."
**App Store / metadata description:** "Study-time tracker: set goals, clock in, build
habits, and track progress with friends."

**The idea behind it:** working alone is hard to keep up. Progra treats your effort
like a workout app treats a run: every session is logged, counted, and visible to
friends who can like it, comment on it, or nudge you when you're behind. The
onboarding sums it up in three lines, and the site can use them as its spine:

1. "When you clock in on *[your goal]*, your friends see it in their feed."
2. "Your hours add up."
3. "And friends keep each other going."

## 2. Who it's for

- **Primary: college students.** Studying, problem sets, thesis work, prep for exams.
  There's a dedicated University of Washington cohort (UW students can add their
  major and interests to find classmates), so a student-leaning voice fits.
- **Also:** anyone working on self-improvement goals they want to put real hours into.
- Example goals the app itself suggests: "Launch my side project", "Get stronger",
  "Ace organic chem", "Train for a half marathon", "Learn Spanish", "Finish my thesis".

Ages 13+. It's a small, fast-growing beta (roughly 90+ members, with seats capped at 250
for now), built by a founder who signs release notes as "Ish from Progra", with
Jillian Growney as Head of Design.

## 3. How it works (the core loop)

### Step 1. Set goals and habits
- A **goal** is something you want to put time into, with a **weekly hour quota**
  (for example "Ace organic chem, 6 hrs / week"). Each goal has its own color.
- A **habit** is a daily check-off ("Read 20 pages", "Gym", "No phone before 9").
- Everything gets one of 11 palette colors and keeps it everywhere it appears.

### Step 2. Clock in
- Tap the big center **Clock** button, pick what you're working on (a goal or a
  category) and give the session a title.
- A full-screen **live timer** runs with a soft breathing glow. Pause, resume, take a
  break, add notes, and snap **one photo** of your desk or workout while you're in it.
- **iPhone Lock Screen Live Activity:** while you're clocked in, the Lock Screen and
  Dynamic Island show what you're working on and a running clock, with Pause and
  Clock out buttons right there.
- Optional reminders: when your planned time is up, and hourly while you work.
- Clock out → review the session → save. Mark any session **Private** or **Shared**.

### Step 3. Friends see it
- Your session shows up in your friends' **Feed**: "Maya clocked into Organic Chem
  for 1h 20m", with title, photo and a duration pill.
- A **"Clocked in now"** strip at the top of the feed shows which friends are
  working right now, with live timers.
- Friends give **kudos** (a heart), leave emoji reactions, and **comment** (with threaded
  replies).
- **Nudges:** if a friend is behind on a goal or has habits left today, you can send
  them a nudge from their profile with one of five messages: "Lock in", "Still got time
  today!", "Your friends are counting on you", "You can do this!", "Slow progress is
  better than no progress." It arrives as a push notification. Nudges are rate-limited,
  never sent before 9am in the friend's time zone, and anyone can turn them off.
- New members get a "just joined Progra" card in the feed.

### Step 4. Watch it add up
- **Progress (home):** a Today view (total time today, today's sessions, each goal's
  progress bar with % and hours left, habits to tap off) and a Week view (weekly total,
  time by category, goal quota bars, a Mon–Sun habit grid).
- **History:** month and year views with total hours, time by category, goal completion
  and a habit-completion calendar.
- **Weekly review (every Monday, 6am):** a full-screen, story-style recap of last week
  you tap through: hours tracked vs. your 8-week average → where the time went →
  weekly goals → habits → friends → your rank among friends → a closing quote
  ("Opportunity is missed by most because it comes dressed in overalls and looks like
  work." Thomas Edison) and "Start your next session".
  **Share your week:** post the review to the feed with a caption (hours · % of goals ·
  % of habits), and friends can like and comment on it.

### Step 5. Keep the streak
**Streaks** launch on Wednesday, October 21, 2026, so the site should treat them as new.
- Show up once a day: clock in for at least 5 minutes, or check off one habit.
- Your streak sits as a 🔥 badge next to your name on your profile; tap it for your
  longest streak and freezes.
- **2 free freezes every month:** miss a day and one is used automatically.
- Friends see your streak (it only counts what you've shared).

## 4. Other true things worth mentioning

- **Privacy is per item.** Every session, goal and habit can be private. Only accepted
  friends see your goals, habits and sessions; everyone else sees your name and avatar.
  You can block and report. Photos have their location data stripped.
- **Dark mode:** follows your phone's setting, or pick Light or Dark yourself.
- **Works everywhere:** a native iPhone app on the App Store, and the same app at
  progra.world on any browser (it can be added to the home screen).
- **Sign in** with Google or email, or with Apple in the iPhone app.
- **Friends:** search by name or username, "People on Progra" discovery, invite links.
- **Release notes in the app:** every big update shows a short "What's new" note
  from the founder.
- **Feedback built in:** "Report a bug" and "Make a suggestion" in Settings.

## 5. Do NOT claim these

- **No Google Calendar sync.** It existed once and is turned off. Don't mention calendars.
- **No AI.** There's no AI or LLM in the product. Don't say "AI-powered" anywhere.
- **No scheduling or auto-planning** of your week.
- **No Android app.** iPhone app + web only. (Android users can use the web app.)
- Push notifications (nudges, likes, comments) reach **iPhone app** users only, not the
  web version.
- Don't invent user counts, ratings, testimonials or press quotes. Use placeholders
  clearly marked `[placeholder]` if a layout needs them.

## 6. Suggested site structure

One long, scrollable home page, mobile-first (most visitors arrive from a phone via
Instagram or a friend's invite), then a few small pages.

1. **Hero.** Headline + one-line sub + primary CTA **"Download on the App Store"**
   (https://apps.apple.com/app/progra/id6798377328) + secondary **"Open on the web"**
   (https://progra.world/login). Visual: an iPhone showing the live timer or the feed,
   ideally with the Lock Screen Live Activity beside it.
   Headline directions to try: "Clock in. Your friends are watching (in a good way)." /
   "Study with your friends, even when you're apart." / "Make your hours count, together."
2. **How it works:** the three onboarding lines as three steps, each with a phone frame
   (goal setup → feed post → week chart).
3. **Feature sections**, one per idea, alternating text and phone mockups:
   - Clock in: live timer, photo, Lock Screen Live Activity
   - Your progress: goal quota bars, category donut, habit grid, month/year history
   - Friends: feed, "Clocked in now", kudos, comments, nudges
   - Weekly review: the Monday story slides
   - Streaks (badge it **New**): fire badge, freezes
4. **Privacy:** short and plain: private/shared per session, friends-only, block/report.
5. **Who it's for:** students first; the six example goals as colored chips.
6. **A note from the founder** (short, warm, first person, signed "Ish"). Leave the text
   as a placeholder for Ish to write.
7. **FAQ:** Is it free? `[confirm]` · Is there an Android app? (No, use the web app) ·
   Who can see my sessions? · What counts toward a streak? · Why is there a waitlist?
   (Beta seats are capped; you'll get in as seats open.)
8. **Final CTA** + footer: © 2026 Progra · Support (/support) · Privacy Policy
   (/privacy) · Terms of Service (/terms) · Instagram @progra.world
   (https://www.instagram.com/progra.world/) · support@progra.world

## 7. Visual language (match the app)

The app has a distinct, calm, "editorial" look. The site should feel like the same
product: flat, white, typographic, more magazine than tech startup.

**Principles**
- Flat white surfaces split by **hairline rules**. Few or no cards, no heavy shadows,
  no glassmorphism, no gradients in UI chrome.
- **Section labels** are tiny uppercase eyebrows (10–11px, letter-spaced, grey).
- Big numbers and headings in a serif; everything else in a clean grotesk.
- Color comes from the *data*: goals, categories and habits each carry one of the
  palette colors. Navy is reserved for buttons and primary actions, never for data.
- Calm and matter-of-fact. Missing a goal is never shown as red alarm; the delete red
  is a muted terracotta.
- Motion is gentle: elements rise in, the headline types itself in letter by letter
  behind a navy caret, a week of bars pulses softly. Respect reduced-motion.

**Type**
- Headings and display numbers: **Newsreader** (serif, medium weight, slightly tight
  tracking, around -0.02em at large sizes).
- UI and body: **Hanken Grotesk**.
- Both on Google Fonts.

**Core colors (light)**
| Role | Hex |
|---|---|
| Background / screen | `#ffffff` |
| Ink (headings, body) | `#1b2129` |
| Secondary text | `#5d6672` |
| Brand / primary buttons (navy) | `#1c3a5e` |
| Deep navy (dark surfaces, Live Activity dark) | `#142c49` |
| Track / subtle fill | `#f1f3f5` |
| Inset / hover | `#f6f7f8` |
| Control border | `#e6e9ed` |
| Hairlines | `#eceef1`, `#f4f5f7` |
| Destructive (muted terracotta) | `#9c5148` |
| Corner radius base | `0.9rem` |

**Entity palette (goals / categories / habits)**, in the app's order. Use the fill
for dots, bars and donut arcs; use the ink only when the color is text on white.
| Name | Fill | Ink |
|---|---|---|
| Maroon | `#8E3A44` | `#6E2530` |
| Red | `#DE5148` | `#BE362D` |
| Orange | `#E07042` | `#C24E14` |
| Gold | `#D6A728` | `#8F6C0A` |
| Light green | `#7CBE6D` | `#356B2F` |
| Green | `#2E8B50` | `#175E33` |
| Light blue | `#77B7C6` | `#22758C` |
| Dark blue | `#395AA0` | `#33518F` |
| Purple | `#A084B3` | `#7A57A0` |
| Dark purple | `#6F4E93` | `#533672` |
| Pink | `#D06DA1` | `#BA4485` |
Glyphs inside a filled color chip (check marks, icons) are always white.

**Logo**
A rounded app-icon tile with a full-bleed four-corner gradient (crimson-red top-left,
warm gold top-right, indigo-blue bottom-left, teal-light-blue bottom-right). On it, a
white **segmented ring** (a thick donut split into about 5 arcs by thin gaps, like a
time-by-goal chart) with **two white clock hands** inside it. It fuses the app's two
ideas: time split across goals, and clocking in. The rainbow gradient belongs to the
logo only. Don't spread it across the site's UI; it can appear in the hero as the icon
itself.

**Dark mode:** offer it, following the system setting, with deep navy surfaces
(around `#142c49`) and the same palette.

## 8. App screens to depict in mockups

Draw these as realistic iPhone frames in the app's style (white, hairlines, serif
numbers, palette dots). Sample data is fine; use friendly made-up names like "Maya Chen".
- **Live timer:** large serif elapsed time ("1:24:07"), the task title, goal color
  marker, Pause and Clock out, an "Add photo" chip, and a soft glow while running.
- **Lock Screen Live Activity:** white card, serif task name, small caps
  "ORGANIC CHEM · TRACKING", hairline, running clock, Pause | Clock out.
- **Feed:** "Clocked in now" strip with two friends and live durations; below it a
  session card: avatar, "clocked into ● Organic Chem for 1h 20m", title "Day one",
  photo, heart with 3 kudos, comment preview.
- **Progress, Today:** "2h 45m today" hero, goal rows with colored progress bars and
  "62% · 2.3 hrs left", habits with tap-to-check circles.
- **Week view / History:** category donut or stacked bar, goal quota bars, Mon–Sun
  habit grid.
- **Weekly review slide:** full-screen story with tap-progress segments at the top,
  "11.5 hrs" huge in serif, "↑ 2.1 vs. your 8-week average".
- **Profile with streak:** "Maya Chen 🔥 7", stats row, "Weekly reviews" rows
  ("11.5 hrs · 86% goals · 64% habits").
- **Nudge sheet:** pick a goal → pick a message → navy bubble "Nudge sent to Maya".

Bottom nav in the app (useful for mockups): **Progress · Feed · [Clock] · Friends ·
You**, with Clock as the raised center button. While you're tracking, the button shows
a live ticking time.

## 9. Voice and copy

- Warm, direct, a little playful, never corporate. Written like a student who built
  the thing for their friends. Short sentences.
- Encouraging without guilt: "Slow progress is better than no progress" is the tone.
- Say "clock in", "session", "goal", "habit", "kudos", "nudge", "weekly review",
  "streak": these are the app's real words.
- Avoid "AI", "productivity hacks", "10x", "grind", "optimize".

## 10. Technical notes for the build

- Static marketing page; mobile-first, fully responsive, fast.
- Keep the existing legal routes as links: `/support`, `/privacy`, `/terms` already exist
  on progra.world. The site's CTAs go to the App Store and to `progra.world/login`.
- Use Apple's official "Download on the App Store" badge.
- Open Graph image: the logo tile + "Progra" in Newsreader + the tagline.
