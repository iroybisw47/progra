"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { answerSurvey } from "@/app/actions/survey";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/v2/primary-button";
import { firstUnanswered, type Survey } from "@/lib/survey";
import { useTakeoverActive } from "@/lib/takeover";
import { cn } from "@/lib/utils";

type Result = { ok: true; done: boolean } | { error: string };

// The write, as a prop so the dev preview can run the modal with no database
// (app/dev/survey).
export type SurveyAnswerFn = (
  surveyId: string,
  questionId: string,
  optionId: string
) => Promise<Result>;

// The in-app survey (lib/survey.ts), mounted by the root layout only while
// surveyOwed() says this member hasn't finished it and at least one question
// is still unanswered. One question at a time, and NO WAY OUT, by the owner's
// decision: no close button, the backdrop and Escape do nothing, and the only
// control is Next once an option is picked. Answers are write-once, so picking
// is a separate step from committing.
//
// Progress, for WhatsNewModal's reasons: an allowlist of "/", and never over
// the weekly review takeover. It waits, unanswered, until then.
//
// Each answer revalidates the layout, so `answered` arrives fresh from the
// server; the local list covers the moment between the action returning and
// the new payload landing. The last answer stamps survey_done and the layout
// drops this out of the tree.
export function SurveyModal({
  survey,
  answered,
  submit = answerSurvey,
  anywhere = false,
}: {
  survey: Survey;
  answered: string[];
  submit?: SurveyAnswerFn;
  // The dev preview only: skip the "/" allowlist.
  anywhere?: boolean;
}) {
  const pathname = usePathname();
  const takenOver = useTakeoverActive();
  const [local, setLocal] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();
  const headerRef = useRef<HTMLDivElement>(null);

  const index = firstUnanswered([...answered, ...local], survey);

  // After the hooks: this survives navigation away from "/".
  if ((pathname !== "/" && !anywhere) || takenOver || finished || index === null) return null;

  const question = survey.questions[index];
  const total = survey.questions.length;
  const last = index === total - 1;

  function next() {
    if (!picked || pending) return;
    const optionId = picked;
    startTransition(async () => {
      let r: Result;
      try {
        r = await submit(survey.id, question.id, optionId);
      } catch {
        r = { error: "Couldn't save that answer. Check your connection and try again." };
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPicked(null);
      setLocal((l) => [...l, question.id]);
      if (r.done) {
        setFinished(true);
        toast.success("Thanks! Your answers help decide what's next for Progra.");
      }
    });
  }

  return (
    // Controlled and never closed from inside: Escape asks onOpenChange(false),
    // which is ignored, and disablePointerDismissal keeps the backdrop inert.
    <Dialog open onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent
        className="bg-card text-ink max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_2rem)] gap-4 overflow-y-auto rounded-[22px] p-5 sm:max-w-sm"
        showCloseButton={false}
        // Focus lands on the header, not the first option, whose focus ring
        // read as a pre-selected answer.
        initialFocus={headerRef}
      >
        <DialogHeader ref={headerRef} tabIndex={-1} className="gap-2 outline-none">
          <div className="flex items-center gap-2.5">
            <Image
              src="/progra-logo.png"
              alt=""
              width={32}
              height={32}
              unoptimized
              className="size-8 rounded-[8px]"
            />
            <div className="flex flex-col">
              <span className="text-ink text-[13px] font-semibold">
                {survey.title}
              </span>
              <DialogDescription className="text-caption text-[12px]">
                Question {index + 1} of {total}
              </DialogDescription>
            </div>
          </div>
          {/* One segment per question: done, current, still to come. */}
          <div aria-hidden className="mt-1 flex gap-1">
            {survey.questions.map((q, i) => (
              <span
                key={q.id}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= index ? "bg-brand" : "bg-track"
                )}
              />
            ))}
          </div>
          {index === 0 && (
            <p className="text-body mt-1 text-[13.5px] leading-[1.5] text-pretty">
              {survey.intro}
            </p>
          )}
          <DialogTitle className="text-ink mt-1 text-[19px] leading-snug text-pretty">
            {question.prompt}
          </DialogTitle>
        </DialogHeader>

        <div role="radiogroup" aria-label={question.prompt} className="flex flex-col gap-2">
          {question.options.map((o) => {
            const on = picked === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                onClick={() => setPicked(o.id)}
                className={cn(
                  "flex items-start gap-3 rounded-[15px] border-[1.5px] px-3.5 py-3 text-left transition-colors disabled:opacity-60",
                  on
                    ? "border-brand bg-[color-mix(in_oklab,var(--brand)_7%,transparent)]"
                    : "border-control-border"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                    on ? "border-brand" : "border-control-border"
                  )}
                >
                  {on && <span className="bg-brand size-2 rounded-full" />}
                </span>
                <span className="text-ink text-[14px] leading-[1.45] text-pretty">
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>

        <PrimaryButton disabled={!picked || pending} onClick={next}>
          {pending ? "Saving…" : last ? "Submit" : "Next"}
        </PrimaryButton>
      </DialogContent>
    </Dialog>
  );
}
