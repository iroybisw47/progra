// The App Store listing. Its own module rather than a constant inside
// lib/invite-share.ts, because the public invite landing (app/i/[username]) is
// a Server Component and needs the URL, while invite-share reaches for
// navigator and lib/analytics. Same reason NATIVE_AUTH_REDIRECT lives in
// lib/native-auth.ts rather than lib/native.ts.
//
// Deliberately COUNTRYLESS. `/us/app/...` pins the US storefront, and a
// recipient signed into another country's store lands on "not available in your
// country". Apple 301s this form to the visitor's own storefront, and the page
// it lands on serves the same og:url/og:title/og:image either way — so link
// previews in iMessage/WhatsApp are identical. The `progra` slug stays: in a
// plain-text target with no preview card, the URL then self-describes.
export const APP_STORE_URL = "https://apps.apple.com/app/progra/id6798377328";

// The same destination, stripped for DISPLAY under the share buttons. Replaces
// the old `${SITE_HOST}/i/${username}` caption. Not derived from the URL: the
// numeric id is noise in an 11px line and truncates to nothing legible.
export const APP_STORE_DISPLAY = "apps.apple.com/app/progra";
