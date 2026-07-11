# Progra — conventions for building with this design system

Progra is a personal productivity PWA (weekly goals, deep-work clock-in,
habits, Sunday recap) with a **calm, warm, paper-like** look: cream surfaces,
deep-teal brand, serif headings, no alarmist reds. Designs should feel quiet
and editorial, mobile-first (the app runs at phone width — main columns are
`max-w-md`, centered).

## Setup

No provider is required. Components work as-is once `styles.css` is loaded.
Typography comes from Google Fonts at runtime (Hanken Grotesk for UI text,
Newsreader for headings) via `tokens/fonts.css` — already in the `styles.css`
import closure; nothing to wire.

## Styling idiom

Tailwind utility classes — BUT the shipped stylesheet is compiled from the
app's own usage, so **only utilities the app already uses exist**. Stick to
this vocabulary for your own layout glue; for anything else, use inline
`style` with the CSS custom properties below (they are all defined in
`_ds_bundle.css`).

Verified utility vocabulary (semantic shadcn tokens): `bg-background`,
`bg-card`, `bg-muted`, `bg-primary` + `text-primary-foreground`,
`bg-secondary`, `text-muted-foreground`, `text-destructive`, `bg-brand`,
`text-brand`, `font-heading` (Newsreader serif), `font-mono` + `tabular-nums`
(stat numbers), `rounded-xl`, `max-w-md`, plus common layout utilities
(`flex`, `flex-col`, `items-center`, `gap-1`–`gap-5`, `px-*`, `py-*`,
`text-xs/sm/3xl`, `font-medium`).

Design-token custom properties for inline styles (light/dark aware):
`--brand` (deep teal #355a52), `--brand-deep`, `--sand`, `--sand-ink`,
`--screen` (page background), `--card-warm`, `--inset`, `--track` (progress
track), `--hairline`, `--divider`, `--ink` (strongest text), `--body`,
`--faint`, `--caption`, `--done` (success), `--busy` (calendar-busy), and the
shadcn set (`--background`, `--foreground`, `--primary`, `--muted`, `--card`,
`--border`, `--destructive`, `--radius`).

Number displays use `font-mono tabular-nums` (e.g. "18.5h"). Headings and
card titles render in Newsreader via `font-heading` (CardTitle applies it
itself). Body/UI text is Hanken Grotesk by default. Soft desaturated accent
colors only — never saturated alert red; destructive actions use the muted
`text-destructive` treatment Button/Badge already carry.

## Where the truth lives

Read `styles.css` → `_ds_bundle.css` (all tokens + every compiled utility)
and `tokens/fonts.css` before inventing styles. Each component's API is its
`components/general/<Name>/<Name>.d.ts`; usage patterns and realistic content
examples are in the matching `<Name>.prompt.md`.

## Idiomatic example

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent,
         Button, GoalProgressBar } from "progra"; // window.Progra.*

<div className="flex flex-col gap-5 max-w-md">
  <Card>
    <CardHeader>
      <CardTitle>Time this week</CardTitle>
      <CardDescription>Mon 6 – Sun 12 Jul</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="font-mono text-3xl tabular-nums">18.5h</div>
      <GoalProgressBar title="Thesis" quotaHours={10} actualMs={27000000} />
      <Button>Clock in</Button>
    </CardContent>
  </Card>
</div>
```
