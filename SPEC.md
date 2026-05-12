# Progra — v0 Spec

## What this is

A personal productivity webapp for one user (me). Built as a PWA so it
installs on iPhone home screen.

## v0 scope: Just Clock-In

A single screen with a list of categories. Each category has a clock-in
button. Tapping it starts a timer; tapping again stops it and logs the
session. The screen shows total minutes per category for the current
week.

## What's in v0

- One page (the home page) — no routing, no other screens
- Categories are user-defined: an input + "Add category" button creates
  a new one. A small "x" deletes one.
- Each category row shows:
  - The category name
  - Total minutes spent on it this week (Monday 12:00am - Sunday 11:59pm)
  - A clock-in / clock-out button
  - When clocked in, a live-updating elapsed timer
- Only one category can be clocked in at a time. Clocking into a new one
  stops the current one automatically.
- All data persists in browser localStorage. No backend, no auth, no
  signup. One user, this device.
- PWA-installable: manifest + icon so "Add to Home Screen" on iPhone
  works.

## What's NOT in v0

- No weekly plan, no actionables, no goals
- No AI / Claude API integration
- No multi-user, no auth, no Supabase
- No history view (only "this week" matters)
- No editing of past sessions
- No dark mode toggle (use system default)
- No notifications

## Tech stack (already set up)

- Next.js 16 App Router, TypeScript, Tailwind
- shadcn/ui (Nova preset, Base UI primitives, Lucide icons, Geist font)
- localStorage for persistence
- Deployed to Vercel on every push to `main`

## UI principles

- Mobile-first. Designed to look great on iPhone, acceptable on desktop.
- Minimal. One screen, big tappable buttons, no chrome.
- Tactile. Clock-in/out should feel satisfying — large button, clear
  state change, smooth timer.
- No dialogs unless necessary. Inline editing where possible.

## Success criterion

I use it every day this week without feeling like it's broken.
