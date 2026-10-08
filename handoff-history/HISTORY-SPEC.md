# Progress → History tab — UI spec

Scope: ONE addition to the existing Progress screen. Everything else in the app stays untouched.

## History tab (added after initial handoff)

Third chip in the Today/Week switcher: **History**. Reference: html/Progra Dashboard Navy.dc.html (tab === "history"), screenshots/app-progress-history.png and app-progress-history-month.png.

Layout (scrollable, hidden scrollbar):
1. **Scope toggle** — Year / Month pill pair (same style as Today/Week chips) top-left. In Month scope a stepper appears top-right: ‹ chevron, month name (min-width 78px, centered), › chevron; 26px square buttons, radius 9px, border 1.5px #eceef1; chevrons disable (color #dfe3e8) at Jan / current month.
2. **Title block** — "2026" or "June 2026" in Newsreader 600 34px; under it total hours (Hanken 600 19px, e.g. "292h") + session count caption ("318 sessions · Jan – Jul").
3. **Time list** — header "TIME". Goals first, then categories, one line each, no row separators: 8px dot (round for goals, 2px-radius square for categories) + grey prefix "Goal:" / "Category:" + name, then right-aligned: 96px × 4px mini-bar (fill = entity color, width relative to the largest row), hours (600 12px), share % (11px #8b929c). Bars scale to the max row, not to 100%.
4. **Goal completion** — header + right-aligned "72% of quotas met". Per goal one line: dot, title, mini-bar of completion %, "21/27 wks", bold %.
5. **Habit completion** — header + right-aligned "59% overall" (year) or "62% in June" (month).
   - Year scope: per-habit one-line rows (dot, name, mini-bar, %).
   - Month scope: **calendar grid** — 7 columns M T W T F S S (9px caps letters), day cells 30px tall, radius 8px, each showing the count of habits completed that day; fill navy rgba(28,58,94, .08 + count/total*.82), number white when ≥ half done, navy otherwise; 0-days #f4f5f7 with faint "0"; future days white with #f1f3f5 hairline; leading pad cells empty. Caption under grid: "Habits completed each day, of 8".

Month scope re-scopes every section (total, sessions, time split, goal completion, habit completion) to the selected month. Data source: see BACKEND.md → GET /me/history.
