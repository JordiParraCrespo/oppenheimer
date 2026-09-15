"use client";

import { Avatar, AvatarFallback } from "@oppenheimer/design-system-web/avatar";
import { Button } from "@oppenheimer/design-system-web/button";
import { FilterMenu } from "@oppenheimer/design-system-web/filter-menu";
import { IconButton } from "@oppenheimer/design-system-web/icon-button";
import {
  MailboxPicker,
  type MailboxOption,
} from "@oppenheimer/design-system-web/mailbox-picker";
import {
  MailboxRail,
  MailboxRailDomain,
  MailboxRailGroup,
  MailboxRailGroupLabel,
  MailboxRailItem,
  MailboxRailRow,
  MailboxRailSearch,
} from "@oppenheimer/design-system-web/mailbox-rail";
import { MailboxChip, MailboxTag } from "@oppenheimer/design-system-web/mailbox-tag";
import {
  MessageList,
  MessageListItem,
} from "@oppenheimer/design-system-web/message-list";
import {
  MessageAttachment,
  MessageReader,
  MessageReaderBody,
  MessageReaderHeader,
  MessageReaderIdentity,
  MessageReaderLink,
  MessageReaderMeta,
  MessageReaderSubject,
} from "@oppenheimer/design-system-web/message-reader";
import { ReplyBox } from "@oppenheimer/design-system-web/reply-box";
import {
  CircleDotIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  InboxIcon,
  MailIcon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  StarIcon,
  UserRoundIcon,
} from "lucide-react";
import * as React from "react";

const MAILBOXES: MailboxOption[] = [
  {
    address: "hola@adalgraphdigital.com",
    local: "hola",
    domain: "adalgraphdigital.com",
    label: "General",
    tone: "#2F80F6",
    unread: 3,
  },
  {
    address: "ventas@adalgraphdigital.com",
    local: "ventas",
    domain: "adalgraphdigital.com",
    label: "Sales",
    tone: "#1F9D57",
    unread: 1,
  },
  {
    address: "soporte@adalgraphdigital.com",
    local: "soporte",
    domain: "adalgraphdigital.com",
    label: "Support",
    tone: "#C77A16",
    unread: 0,
  },
  {
    address: "kitdigital@digitalizatupyme.org",
    local: "kitdigital",
    domain: "digitalizatupyme.org",
    label: "Kit Digital",
    tone: "#7A5CFF",
    unread: 5,
  },
  {
    address: "facturacion@digitalizatupyme.org",
    local: "facturacion",
    domain: "digitalizatupyme.org",
    label: "Billing",
    tone: "#12B5CE",
    unread: 0,
  },
];

export function MailRailDemo() {
  const [query, setQuery] = React.useState("");
  const [folder, setFolder] = React.useState("inbox");
  const [picked, setPicked] = React.useState("hola@adalgraphdigital.com");

  return (
    <div className="w-59 overflow-hidden rounded-2xl border border-border-subtle bg-card">
      <MailboxRail className="max-h-96 border-r-0">
        <MailboxRailRow
          icon={<InboxIcon />}
          count={24}
          active={folder === "inbox"}
          onClick={() => setFolder("inbox")}
        >
          Inbox
        </MailboxRailRow>
        <MailboxRailRow
          icon={<CircleDotIcon />}
          count={9}
          active={folder === "unread"}
          onClick={() => setFolder("unread")}
        >
          Unread
        </MailboxRailRow>
        <MailboxRailRow
          icon={<StarIcon />}
          count={3}
          active={folder === "starred"}
          onClick={() => setFolder("starred")}
        >
          Starred
        </MailboxRailRow>
        <MailboxRailRow
          icon={<FolderIcon />}
          active={folder === "archive"}
          onClick={() => setFolder("archive")}
        >
          Archived
        </MailboxRailRow>

        <MailboxRailGroupLabel>Mailboxes</MailboxRailGroupLabel>
        <MailboxRailSearch
          value={query}
          onValueChange={setQuery}
          placeholder="Filter mailboxes…"
        />

        <MailboxRailGroup>
          <MailboxRailDomain icon={<GlobeIcon />} count={4}>
            adalgraphdigital.com
          </MailboxRailDomain>
          {MAILBOXES.filter((box) => box.domain === "adalgraphdigital.com").map(
            (box) => (
              <MailboxRailItem
                key={box.address}
                tone={box.tone}
                count={box.unread}
                active={picked === box.address}
                onClick={() => setPicked(box.address)}
              >
                {box.local}
              </MailboxRailItem>
            ),
          )}
        </MailboxRailGroup>
      </MailboxRail>
    </div>
  );
}

export function MailboxPickerDemo() {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <MailboxPicker
      mailboxes={MAILBOXES}
      selected={selected}
      onSelectedChange={setSelected}
    />
  );
}

export function FacetFilterDemo() {
  const [selected, setSelected] = React.useState<string[]>(["unread"]);
  return (
    <FilterMenu
      align="start"
      selected={selected}
      onSelectedChange={setSelected}
      options={[
        {
          value: "unread",
          label: "Unread",
          icon: <CircleDotIcon />,
          count: 9,
        },
        { value: "starred", label: "Starred", icon: <StarIcon />, count: 3 },
        {
          value: "attachment",
          label: "Has attachment",
          icon: <PaperclipIcon />,
          count: 5,
        },
        {
          value: "lead",
          label: "Linked to a lead",
          icon: <UserRoundIcon />,
          count: 7,
        },
      ]}
    />
  );
}

export function MailboxTagDemo() {
  const [chips, setChips] = React.useState([
    "hola@adalgraphdigital.com",
    "kitdigital@digitalizatupyme.org",
  ]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MailboxTag tone="#1F9D57">ventas@adalgraphdigital.com</MailboxTag>
      {chips.map((chip) => (
        <MailboxChip
          key={chip}
          tone={MAILBOXES.find((box) => box.address === chip)?.tone}
          onRemove={() => setChips(chips.filter((entry) => entry !== chip))}
        >
          {chip}
        </MailboxChip>
      ))}
    </div>
  );
}

const MESSAGES = [
  {
    id: "m1",
    from: "Dana Whitfield",
    subject: "Re: Documentación Segmento II — firma pendiente",
    preview:
      "Perfecto, ya tengo el certificado digital. ¿Puedo enviaros el acuerdo firmado hoy mismo?",
    mailbox: "kitdigital@digitalizatupyme.org",
    tone: "#7A5CFF",
    gradient: "purple" as const,
    time: "9:42",
    unread: true,
    starred: true,
    attachment: true,
  },
  {
    id: "m2",
    from: "Priya Nair",
    subject: "Propuesta para 3 dominios — dudas sobre el alcance",
    preview:
      "Gracias por la propuesta. Nos encaja, pero querríamos entender qué incluye el mantenimiento…",
    mailbox: "ventas@adalgraphdigital.com",
    tone: "#1F9D57",
    gradient: "teal" as const,
    time: "8:15",
    unread: true,
    starred: false,
    attachment: false,
  },
  {
    id: "m3",
    from: "Google Search Console",
    subject: "Cobertura: 4 páginas nuevas indexadas",
    preview: "Se han indexado 4 páginas nuevas durante los últimos 7 días.",
    mailbox: "soporte@adalgraphdigital.com",
    tone: "#C77A16",
    gradient: "blue" as const,
    time: "Mon",
    unread: false,
    starred: false,
    attachment: false,
  },
];

export function MessageListDemo() {
  const [open, setOpen] = React.useState("m1");
  return (
    <div className="w-full max-w-160 overflow-hidden rounded-2xl border border-border-subtle">
      <MessageList>
        {MESSAGES.map((message) => (
          <MessageListItem
            key={message.id}
            unread={message.unread}
            selected={open === message.id}
            onClick={() => setOpen(message.id)}
            avatar={
              <Avatar size={34}>
                <AvatarFallback gradient={message.gradient}>
                  {message.from.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            }
            from={message.from}
            tag={<MailboxTag tone={message.tone}>{message.mailbox}</MailboxTag>}
            subject={message.subject}
            preview={message.preview}
            time={message.time}
            indicators={
              <>
                {message.attachment ? (
                  <PaperclipIcon className="text-ink-400" />
                ) : null}
                {message.starred ? (
                  <StarIcon className="text-status-paused" />
                ) : null}
              </>
            }
          />
        ))}
      </MessageList>
    </div>
  );
}

export function MessageReaderDemo() {
  const [reply, setReply] = React.useState("");
  return (
    <div className="w-full max-w-160 rounded-2xl border border-border-subtle bg-card p-6">
      <MessageReader>
        <MessageReaderHeader>
          <MessageReaderSubject>
            Re: Documentación Segmento II — firma pendiente
          </MessageReaderSubject>
          <MessageReaderMeta>
            <Avatar size={38} className="flex-none">
              <AvatarFallback gradient="purple">D</AvatarFallback>
            </Avatar>
            <MessageReaderIdentity
              name="Dana Whitfield"
              address="dana@northwind.co"
            />
            <MailboxTag tone="#7A5CFF">
              kitdigital@digitalizatupyme.org
            </MailboxTag>
            <span className="flex-none text-xs text-ink-400">9:42</span>
          </MessageReaderMeta>
        </MessageReaderHeader>

        <MessageReaderBody>
          <p>Hola,</p>
          <p>
            Perfecto, ya tengo el certificado digital renovado. ¿Puedo enviaros
            el acuerdo de prestación firmado hoy mismo o preferís esperar a la
            resolución?
          </p>
        </MessageReaderBody>

        <MessageAttachment
          icon={<FileTextIcon className="text-ink-600" />}
          name="acuerdo-kit-digital.pdf"
          size="248 KB"
          action={
            <IconButton size="sm" variant="ghost" aria-label="Download">
              <DownloadIcon />
            </IconButton>
          }
        />

        <MessageReaderLink icon={<UserRoundIcon className="text-ink-400" />}>
          Linked lead ·{" "}
          <span className="font-medium text-ink-900">Dana Whitfield</span>
        </MessageReaderLink>

        <ReplyBox
          value={reply}
          onValueChange={setReply}
          placeholder="Reply to Dana Whitfield from kitdigital@digitalizatupyme.org…"
          toolbar={
            <>
              <IconButton size="default" variant="ghost" aria-label="Attach">
                <PaperclipIcon />
              </IconButton>
              <IconButton
                size="default"
                variant="ghost"
                aria-label="Draft with AI"
              >
                <SparklesIcon />
              </IconButton>
            </>
          }
          actions={
            <Button
              size="sm"
              disabled={!reply.trim()}
              onClick={() => setReply("")}
            >
              <SendIcon />
              Send
            </Button>
          }
        />
      </MessageReader>
    </div>
  );
}

export function ReplyBoxDemo() {
  const [reply, setReply] = React.useState("");
  return (
    <div className="w-full max-w-140">
      <ReplyBox
        value={reply}
        onValueChange={setReply}
        placeholder="Reply to Priya Nair from ventas@adalgraphdigital.com…"
        className="mt-0"
        toolbar={
          <IconButton size="default" variant="ghost" aria-label="Attach">
            <PaperclipIcon />
          </IconButton>
        }
        actions={
          <Button size="sm" disabled={!reply.trim()}>
            <MailIcon />
            Send
          </Button>
        }
      />
    </div>
  );
}
