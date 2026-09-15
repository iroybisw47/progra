// The two OAuth buttons' shared shape: 46px, radius 14, 15px/600, dimmed but
// still tappable while the terms gate is locked (see SignInButtons). Its own
// module so the buttons and the gate don't import each other.
export const AUTH_BUTTON =
  "flex h-[46px] w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold transition-[transform,opacity] duration-200 active:scale-[.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-45 disabled:opacity-45";
