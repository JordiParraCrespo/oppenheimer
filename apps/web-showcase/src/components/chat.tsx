"use client";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@oppenheimer/design-system-web/attachment";
import { Avatar, AvatarFallback } from "@oppenheimer/design-system-web/avatar";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
} from "@oppenheimer/design-system-web/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@oppenheimer/design-system-web/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@oppenheimer/design-system-web/message-scroller";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@oppenheimer/design-system-web/questionnaire";
import { FileTextIcon, ImageIcon, SheetIcon, XIcon } from "lucide-react";
import * as React from "react";

/* ── Attachment ─────────────────────────────────────────────────────────── */

const FILES = [
  { icon: FileTextIcon, name: "q3-pipeline.pdf", meta: "PDF · 2.4 MB" },
  { icon: SheetIcon, name: "leads-export.csv", meta: "CSV · 184 KB" },
  { icon: ImageIcon, name: "funnel-chart.png", meta: "PNG · 640 KB" },
];

export function Attachments() {
  return (
    <AttachmentGroup>
      {FILES.map((file) => (
        <Attachment key={file.name}>
          <AttachmentMedia>
            <file.icon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
            <AttachmentDescription>{file.meta}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label={`Remove ${file.name}`}>
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  );
}

/* ── Bubble ─────────────────────────────────────────────────────────────── */

export function Bubbles() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <BubbleGroup className="items-end">
        <Bubble>
          <BubbleContent>Which leads moved stage this week?</BubbleContent>
        </Bubble>
      </BubbleGroup>
      <BubbleGroup>
        <Bubble variant="muted">
          <BubbleContent>
            Four moved to Qualified and one to Lost. Priya Nair and Tomás Rivera
            are the two worth a follow-up.
          </BubbleContent>
        </Bubble>
      </BubbleGroup>
    </div>
  );
}

/* ── Message ────────────────────────────────────────────────────────────── */

export function Messages() {
  return (
    <MessageGroup className="w-full max-w-lg">
      <Message>
        <MessageAvatar>
          <Avatar size={28}>
            <AvatarFallback gradient="purple">D</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent>
              Can you summarise the pipeline for me?
            </BubbleContent>
          </Bubble>
          <MessageFooter>Dana Whitfield · 09:24</MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>
              Six deals are in Qualified, worth €48k combined.
            </BubbleContent>
          </Bubble>
          <MessageFooter>Assistant · 09:24</MessageFooter>
        </MessageContent>
      </Message>
    </MessageGroup>
  );
}

/* ── Message scroller ───────────────────────────────────────────────────── */

const THREAD = [
  { role: "user", text: "How many leads came in last week?" },
  { role: "assistant", text: "142 — up 12% on the week before." },
  { role: "user", text: "Which source drove most of them?" },
  {
    role: "assistant",
    text: "Organic search, at 58. Referral was second with 31.",
  },
  { role: "user", text: "And how many converted?" },
  {
    role: "assistant",
    text: "19 reached Qualified, a 13.4% rate. That is two points above your trailing average.",
  },
  { role: "user", text: "Show me the ones still untouched." },
  {
    role: "assistant",
    text: "Seven leads have had no contact in over five days. I can draft follow-ups for all of them.",
  },
];

export function Scroller() {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="h-72 w-full max-w-lg">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-4 p-1">
            {THREAD.map((turn) => (
              <MessageScrollerItem key={turn.text} messageId={turn.text}>
                <Message align={turn.role === "user" ? "end" : "start"}>
                  <MessageContent>
                    <Bubble
                      variant={turn.role === "user" ? "default" : "muted"}
                    >
                      <BubbleContent>{turn.text}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

/* ── Questionnaire ──────────────────────────────────────────────────────── */

export function QuestionnaireDemo() {
  return (
    <Questionnaire className="w-full max-w-lg">
      <QuestionnaireProgress />
      <QuestionnaireItem name="team-size">
        <QuestionnaireTitle>How big is your sales team?</QuestionnaireTitle>
        <QuestionnaireDescription>
          This sets the default seat count on your workspace.
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="solo">
            Just me
            <QuestionnaireChoiceDescription>
              A single-seat workspace.
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="small">
            2–10 people
            <QuestionnaireChoiceDescription>
              Shared pipeline, per-person lead assignment.
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="large">
            More than 10
            <QuestionnaireChoiceDescription>
              Adds territories and role-based access.
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireNext />
      </QuestionnaireActions>
    </Questionnaire>
  );
}
