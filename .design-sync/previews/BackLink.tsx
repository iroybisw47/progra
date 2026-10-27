import { BackLink } from "progra";

// Top-left way home on the "Your data" pages (Goals, Habits, Categories,
// Past sessions), which are reached only through Settings.
export function Default() {
  return <BackLink />;
}

export function CustomTarget() {
  return <BackLink href="/me" label="You" />;
}
