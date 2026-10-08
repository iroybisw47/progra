# Progra — History Tab Handoff (Claude Code)

Add a **History** tab to the existing Progress screen of `iroybisw47/progra` (branch `main`). This is the ONLY change — do not restyle or touch any other screen, component, or route.

## What to build

1. **Frontend**: a third chip "History" next to the existing Today/Week switcher on Progress. Spec: `HISTORY-SPEC.md`. Ground truth: `html/Progra Dashboard Navy.dc.html` — the logic class's `tab === "history"` branch and the `YEAR` constant show the exact markup, inline styles, and data shapes. Screenshots: `screenshots/app-progress-history.png` (Year scope), `app-progress-history-month.png` (Month scope); `app-progress.png` shows the untouched Today view for context.
2. **Backend**: one endpoint powering it (below). Reuse the repo's existing stack, auth, and session/habit tables; add nothing else.

## Rules

- Match the app's existing tokens: Hanken Grotesk UI text, Newsreader for the big title, tabular-nums on all numbers, hairlines #eceef1/#f4f5f7, brand navy #1c3a5e, entity colors from the existing palette.
- Follow existing chip styling for the History chip and the Year/Month toggle (same pill pattern).
- Build → run → click everything (chip, Year/Month toggle, month stepper ‹ ›, scroll) → zero console errors → one commit: `feat: progress history tab`.
- The `YEAR` mock constant in the HTML is the acceptance fixture: an API returning those values must render those exact screens.

## Backend contract

### GET /me/history?year=YYYY[&month=1-12]

Aggregates the user's existing sessions, goals, categories, and habit checks. Omit `month` for Year scope.

Response:
```json
{
  "total_ms": 1051200000,
  "session_count": 318,
  "range_label": "Jan – Jul",
  "goals":      [{ "id": "g1", "title": "Thesis draft", "palette_idx": 5, "ms": 345600000, "share": 0.33 }],
  "categories": [{ "id": "c1", "name": "Thesis",       "palette_idx": 5, "ms": 426600000, "share": 0.41 }],
  "goal_completion": {
    "weeks_elapsed": 27,
    "overall_rate": 0.72,
    "per_goal": [{ "id": "g1", "weeks_met": 21 }]
  },
  "habit_completion": {
    "overall_rate": 0.59,
    "per_habit": [{ "id": "h1", "name": "Wake by 7", "palette_idx": 2, "rate": 0.82 }],
    "calendar": [{ "date": "2026-07-01", "done": 5, "total": 8 }]
  }
}
```

Formulas:
- Week window = Mon 00:00–Sun 24:00 in the user's timezone; a session counts toward the period containing its `started_at`.
- `goal_completion`: a week is "met" for a goal when its summed hours ≥ its weekly quota; `overall_rate` = met-weeks / (weeks_elapsed × active goals). Month scope uses only that month's weeks.
- `habit_completion.rate` = checks / scheduled days in range; `calendar` (Month scope only) = per-day count of checked habits vs habits scheduled that day. Days after today are omitted.
- Sessions crossing midnight count toward their start day. Archived goals/habits still appear in past ranges.

Client renders month-scoped hours/sessions by re-calling the endpoint with `month`, not by filtering client-side.

## Definition of done

- History chip appears on Progress; Year and Month scopes both render with real data; month stepper clamps to Jan…current month.
- Habit calendar shows real per-day counts for the selected month.
- No other screen changed; build clean; no console errors.
