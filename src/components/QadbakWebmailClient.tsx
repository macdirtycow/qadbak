"use client";

import { useImapMail } from "@/hooks/useImapMail";
import {
  folderIcon,
  folderLabel,
  formatFromDisplay,
  formatMailDate,
  senderInitials,
} from "@/lib/mail-format";
import type { ImapMailbox } from "@/lib/provisioner";
import Link from "next/link";
import { useEffect } from "react";
import { Alert, Button, Input, Label, Textarea } from "./ui";

export function QadbakWebmailClient({
  domain,
  initialMailboxes,
  initialError,
  initialUser,
}: {
  domain: string;
  initialMailboxes: ImapMailbox[];
  initialError: string;
  initialUser: string;
}) {
  const m = useImapMail({
    domain,
    initialMailboxes,
    initialError,
    initialUser,
    autoOpenInbox: true,
  });

  const enc = encodeURIComponent(domain);
  const accountEmail = m.user ? `${m.user}@${domain}` : "";
  const showImapHint =
    Boolean(initialError) ||
    (m.mailboxes.length === 0 && !m.loading && Boolean(m.user));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && m.composeOpen) {
        m.setComposeOpen(false);
      }
      if (
        e.key === "c" &&
        !m.composeOpen &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        m.openComposeNew();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [m.composeOpen, m.openComposeNew, m.setComposeOpen]);

  const composeTitle =
    m.composeMode === "reply"
      ? "Reply"
      : m.composeMode === "reply-all"
        ? "Reply all"
        : m.composeMode === "forward"
          ? "Forward"
          : "New message";

  return (
    <div className="relative flex h-[calc(100dvh-11rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-panel-border bg-[#0a0e14] shadow-2xl">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-panel-border/80 bg-panel-card/90 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-accent/20 text-lg"
            aria-hidden
          >
            ✉
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-white">
              Qmail
            </h1>
            <p className="truncate text-xs text-panel-muted">{accountEmail}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            className="shrink-0"
            onClick={m.openComposeNew}
          >
            Compose
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={m.loading || m.messagesLoading}
            onClick={() => void m.refreshAll()}
          >
            {m.loading || m.messagesLoading ? "…" : "Refresh"}
          </Button>
          <Link
            href={`/domains/${enc}/mail`}
            className="rounded-lg px-3 py-2 text-sm text-panel-muted hover:bg-panel-border/30 hover:text-white"
          >
            Mailboxes
          </Link>
          <Link
            href={`/domains/${enc}`}
            className="rounded-lg px-3 py-2 text-sm text-panel-muted hover:bg-panel-border/30 hover:text-white"
          >
            ← {domain}
          </Link>
        </div>
      </header>

      {(m.error || m.sendSuccess || showImapHint) && (
        <div className="shrink-0 space-y-2 px-4 pt-2">
          {initialError && <Alert>{initialError}</Alert>}
          {showImapHint && !initialError && (
            <Alert>
              No mail folders found for {accountEmail}. Ensure Dovecot is running,
              imap is in QADBAK_NATIVE_FEATURES, and mail exists for this user.
              Run: sudo bash scripts/repair-panel-webmail.sh {domain} {m.user}
            </Alert>
          )}
          {m.error && <Alert>{m.error}</Alert>}
          {m.sendSuccess && (
            <Alert variant="success">{m.sendSuccess}</Alert>
          )}
        </div>
      )}

      {(m.authUser || m.maildirRoot || m.messagesSource) && (
        <p className="shrink-0 border-b border-panel-border/40 px-4 py-1 text-[10px] text-panel-muted">
          {m.messagesSource ? `Source: ${m.messagesSource}` : null}
          {m.authUser ? ` · Dovecot: ${m.authUser}` : null}
          {m.maildirRoot ? ` · Maildir: ${m.maildirRoot}` : null}
        </p>
      )}

      {/* Three-pane */}
      <div className="flex min-h-0 flex-1 divide-x divide-panel-border/80">
        {/* Folders */}
        <aside className="flex w-44 shrink-0 flex-col overflow-y-auto bg-[#0d1118] sm:w-52">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-panel-muted">
              Folders
            </p>
            <button
              type="button"
              onClick={m.openComposeNew}
              className="rounded-md bg-panel-accent/20 px-2 py-1 text-[11px] font-medium text-panel-link hover:bg-panel-accent/30"
              title="New message (C)"
            >
              + New
            </button>
          </div>
          {m.mailboxes.length === 0 && !m.loading && (
            <p className="px-3 py-4 text-xs text-panel-muted">
              No folders. Check Dovecot and mail for this user.
            </p>
          )}
          <ul className="flex-1 pb-2">
            {m.mailboxes.map((box, i) => {
              const active = m.selectedFolder === box.folder;
              const count = box.messages ? String(box.messages) : "";
              return (
                <li key={`${box.folder}-${i}`}>
                  <button
                    type="button"
                    onClick={() => void m.loadMessages(box.folder)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-panel-accent/15 text-white"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-base opacity-80" aria-hidden>
                      {folderIcon(box.folder)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {folderLabel(box.folder)}
                    </span>
                    {count ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                          active
                            ? "bg-panel-accent/30 text-white"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Message list */}
        <section className="flex w-full min-w-0 max-w-md flex-col border-panel-border/80 bg-[#0f1419] md:max-w-sm lg:max-w-md">
          <div className="border-b border-panel-border/60 px-3 py-2">
            <Input
              placeholder="Search mail…"
              value={m.searchQuery}
              onChange={(e) => m.setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex items-center justify-between border-b border-panel-border/40 px-3 py-1.5 text-xs text-panel-muted">
            <span className="truncate font-medium text-slate-400">
              {m.selectedFolder ?? "Select a folder"}
            </span>
            {m.messagesLoading && <span>Loading…</span>}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {!m.selectedFolder && (
              <li className="px-4 py-8 text-center text-sm text-panel-muted">
                Choose a folder on the left.
              </li>
            )}
            {m.selectedFolder &&
              !m.messagesLoading &&
              m.filteredMessages.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-panel-muted">
                  No messages in this folder.
                </li>
              )}
            {m.filteredMessages.map((msg) => {
              const active = m.selectedMessage?.id === msg.id;
              const unread = msg.unread === true;
              return (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => void m.openMessage(msg.id)}
                    className={`flex w-full gap-3 border-b border-panel-border/30 px-3 py-3 text-left transition hover:bg-white/[0.04] ${
                      active ? "bg-panel-accent/10" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        unread
                          ? "bg-panel-accent text-white"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {senderInitials(msg.from)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            unread ? "font-semibold text-white" : "text-slate-200"
                          }`}
                        >
                          {formatFromDisplay(msg.from)}
                        </span>
                        <span className="shrink-0 text-[11px] text-panel-muted">
                          {formatMailDate(msg.date)}
                        </span>
                      </div>
                      <p
                        className={`truncate text-sm ${
                          unread ? "font-medium text-slate-100" : "text-slate-400"
                        }`}
                      >
                        {msg.subject || "(no subject)"}
                      </p>
                      {msg.size ? (
                        <p className="mt-0.5 text-[10px] text-panel-muted">
                          {msg.size}
                        </p>
                      ) : null}
                    </div>
                    {unread ? (
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-panel-accent"
                        aria-label="Unread"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Reading pane */}
        <section className="hidden min-w-0 flex-1 flex-col bg-[#0a0e14] md:flex">
          {!m.selectedMessage && !m.messageLoading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-panel-muted">
              <span className="text-4xl opacity-40" aria-hidden>
                ✉
              </span>
              <p className="text-sm">Select a message to read</p>
              <p className="text-xs">Compose or + New to write mail</p>
            </div>
          )}
          {m.messageLoading && (
            <div className="flex flex-1 items-center justify-center text-sm text-panel-muted">
              Loading message…
            </div>
          )}
          {m.selectedMessage && !m.messageLoading && (
            <>
              <div className="shrink-0 border-b border-panel-border/60 px-5 py-4">
                <h2 className="text-lg font-semibold leading-snug text-white">
                  {m.selectedMessage.subject || "(no subject)"}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.selectedFolder === "Drafts" && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => m.openDraftForEdit(m.selectedMessage!)}
                    >
                      Edit draft
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => m.startReply("reply", m.selectedMessage!)}
                  >
                    Reply
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      m.startReply("reply-all", m.selectedMessage!)
                    }
                  >
                    Reply all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      m.startReply("forward", m.selectedMessage!)
                    }
                  >
                    Forward
                  </Button>
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  {m.selectedMessage.from && (
                    <div className="flex gap-2">
                      <dt className="w-12 shrink-0 text-panel-muted">From</dt>
                      <dd className="min-w-0 text-white">
                        {m.selectedMessage.from}
                      </dd>
                    </div>
                  )}
                  {m.selectedMessage.to && (
                    <div className="flex gap-2">
                      <dt className="w-12 shrink-0 text-panel-muted">To</dt>
                      <dd className="min-w-0 break-all text-slate-300">
                        {m.selectedMessage.to}
                      </dd>
                    </div>
                  )}
                  {m.selectedMessage.date && (
                    <div className="flex gap-2">
                      <dt className="w-12 shrink-0 text-panel-muted">Date</dt>
                      <dd className="text-slate-300">
                        {m.selectedMessage.date}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <article className="flex-1 overflow-y-auto px-5 py-4">
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {m.selectedMessage.bodyText?.trim() ||
                    "(No plain-text body.)"}
                </div>
                {m.selectedMessage.rawHeaders && (
                  <details className="mt-6 text-xs">
                    <summary className="cursor-pointer text-panel-link">
                      Headers
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-panel-border bg-panel-bg p-3 text-panel-muted">
                      {m.selectedMessage.rawHeaders}
                    </pre>
                  </details>
                )}
              </article>
            </>
          )}
        </section>
      </div>

      {/* Mobile reading: show below list when message selected */}
      {m.selectedMessage && (
        <div className="max-h-[40vh] overflow-y-auto border-t border-panel-border/80 bg-[#0a0e14] p-4 md:hidden">
          <h2 className="font-semibold text-white">
            {m.selectedMessage.subject || "(no subject)"}
          </h2>
          <p className="mt-1 text-xs text-panel-muted">
            {m.selectedMessage.from}
          </p>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
            {m.selectedMessage.bodyText?.trim() || "(No body)"}
          </pre>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => m.startReply("reply", m.selectedMessage!)}
            >
              Reply
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => m.startReply("forward", m.selectedMessage!)}
            >
              Forward
            </Button>
          </div>
        </div>
      )}

      {/* Compose overlay */}
      {m.composeOpen && (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="compose-title"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-card shadow-2xl">
            <header className="flex items-center justify-between border-b border-panel-border px-5 py-4">
              <h2 id="compose-title" className="text-lg font-semibold text-white">
                {composeTitle}
              </h2>
              <button
                type="button"
                onClick={() => m.setComposeOpen(false)}
                className="rounded-lg px-2 py-1 text-panel-muted hover:bg-panel-border/40 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <form
              onSubmit={m.sendMail}
              className="flex flex-1 flex-col overflow-y-auto px-5 py-4"
            >
              <p className="mb-3 text-xs text-panel-muted">
                Sending as {accountEmail} via Postfix
              </p>
              <div className="grid gap-3">
                <div>
                  <Label>To</Label>
                  <Input
                    className="mt-1"
                    value={m.sendTo}
                    onChange={(e) => m.setSendTo(e.target.value)}
                    placeholder="recipient@example.com"
                  />
                </div>
                <div>
                  <Label>Cc</Label>
                  <Input
                    className="mt-1"
                    value={m.sendCc}
                    onChange={(e) => m.setSendCc(e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    className="mt-1"
                    value={m.sendSubject}
                    onChange={(e) => m.setSendSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    className="mt-1 min-h-[12rem] font-mono text-sm"
                    value={m.sendBody}
                    onChange={(e) => m.setSendBody(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-panel-border pt-4">
                <Button type="submit" disabled={m.sendLoading || !m.sendTo}>
                  {m.sendLoading ? "Sending…" : "Send"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={m.draftLoading || !m.user}
                  onClick={() => void m.saveDraft()}
                >
                  {m.draftLoading ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    m.setComposeOpen(false);
                    m.resetCompose();
                  }}
                >
                  Discard
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
