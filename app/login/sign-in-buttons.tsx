import { AppleSignInButton } from "./apple-sign-in-button";
import { GoogleSignInButton } from "./google-sign-in-button";

// Every sign-in surface renders this rather than the individual buttons, so
// Apple's Guideline 4.8 "equal prominence" is decided in exactly one place.
//
// Apple sits ABOVE Google, at the same width and height. On the website
// AppleSignInButton renders null — 4.8 governs the app, and progra.world has
// no Apple provider configured — so the web layout is unchanged.
export function SignInButtons({
  next,
  referrer,
  googleLabel,
}: {
  next?: string;
  referrer?: string;
  googleLabel?: string;
}) {
  return (
    // w-full is LOAD-BEARING. The signed-out landing in app/page.tsx puts
    // `items-center` on its flex column, so children shrink to their content
    // instead of stretching. Before this wrapper existed the button's own
    // w-full defeated that; without w-full here the wrapper collapses and the
    // button renders ~157px wide instead of filling the column.
    <div className="flex w-full flex-col gap-3">
      <AppleSignInButton next={next} referrer={referrer} />
      <GoogleSignInButton next={next} referrer={referrer} label={googleLabel} />
    </div>
  );
}
