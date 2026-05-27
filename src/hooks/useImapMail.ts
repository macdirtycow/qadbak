"use client";

import {
  buildReferencesHeader,
  forwardBody,
  forwardSubject,
  parseAddressList,
  parseEmailAddress,
  quoteReplyBody,
  replySubject,
} from "@/lib/mail-reply";
import type { ImapMailbox } from "@/lib/provisioner";
import { useCallback, useEffect, useState } from "react";

export type ImapMessageRow = {
  id: string;
  subject: string;
  from?: string;
  to?: string;
  date?: string;
  size?: string;
  unread?: boolean;
};

export type ImapMessageDetail = ImapMessageRow & {
  bodyText?: string;
  rawHeaders?: string;
  source?: string;
  messageId?: string;
  replyTo?: string;
  cc?: string;
  references?: string;
};

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

type MailUser = { user: string; email?: string; label?: string };

export function useImapMail({
  domain,
  initialMailboxes,
  initialError,
  initialUser = "",
  autoOpenInbox = false,
}: {
  domain: string;
  initialMailboxes: ImapMailbox[];
  initialError: string;
  initialUser?: string;
  autoOpenInbox?: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [mailboxes, setMailboxes] = useState(initialMailboxes);
  const [error, setError] = useState(initialError);
  const [users, setUsers] = useState<MailUser[]>([]);
  const [user, setUser] = useState(initialUser);
  const [searchQuery, setSearchQuery] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [maildirRoot, setMaildirRoot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [messages, setMessages] = useState<ImapMessageRow[]>([]);
  const [messagesSource, setMessagesSource] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ImapMessageDetail | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);

  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendInReplyTo, setSendInReplyTo] = useState("");
  const [sendReferences, setSendReferences] = useState("");
  const [composeMode, setComposeMode] = useState<ComposeMode>("new");
  const [composeOpen, setComposeOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = user ? `?user=${encodeURIComponent(user)}` : "";
      const res = await fetch(`/api/domains/${enc}/mailboxes${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed.");
      const boxes = (data.mailboxes ?? []) as ImapMailbox[];
      setMailboxes(boxes);
      if (Array.isArray(data.users) && data.users.length) {
        setUsers(data.users);
        if (!user && data.users[0]?.user) setUser(data.users[0].user);
      }
      setSource((data.source as string | undefined) ?? null);
      setAuthUser((data.authUser as string | undefined) ?? null);
      const root = data.maildirRoot as string | undefined;
      if (root) setMaildirRoot(root);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, [enc, user]);

  const loadMessages = useCallback(
    async (folder: string) => {
      if (!user) return;
      setSelectedFolder(folder);
      setMessagesLoading(true);
      setError("");
      setMessages([]);
      setSelectedMessage(null);
      try {
        const q = new URLSearchParams({ user, folder });
        const res = await fetch(`/api/domains/${enc}/mailboxes/messages?${q}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load messages.");
        setMessages(data.messages ?? []);
        setMessagesSource(data.source ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
      } finally {
        setMessagesLoading(false);
      }
    },
    [enc, user],
  );

  const openMessage = useCallback(
    async (messageId: string) => {
      if (!user || !selectedFolder) return;
      setMessageLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({ user, folder: selectedFolder });
        const res = await fetch(
          `/api/domains/${enc}/mailboxes/messages/${encodeURIComponent(messageId)}?${q}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load message.");
        setSelectedMessage(data.message ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
      } finally {
        setMessageLoading(false);
      }
    },
    [enc, user, selectedFolder],
  );

  useEffect(() => {
    if (initialUser) setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    setSelectedFolder(null);
    setMessages([]);
    setSelectedMessage(null);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoOpenInbox || !user || selectedFolder) return;
    const boxes = mailboxes.length > 0 ? mailboxes : initialMailboxes;
    if (boxes.length === 0) return;
    const inbox =
      boxes.find((m) => m.folder?.toUpperCase() === "INBOX") ?? boxes[0];
    if (!inbox?.folder) return;
    void loadMessages(inbox.folder);
  }, [
    autoOpenInbox,
    user,
    mailboxes,
    initialMailboxes,
    loadMessages,
    selectedFolder,
  ]);

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          (m.subject ?? "").toLowerCase().includes(q) ||
          (m.from ?? "").toLowerCase().includes(q)
        );
      })
    : messages;

  const selfEmail = user ? `${user}@${domain}`.toLowerCase() : "";

  function resetCompose() {
    setComposeMode("new");
    setSendTo("");
    setSendCc("");
    setSendSubject("");
    setSendBody("");
    setSendInReplyTo("");
    setSendReferences("");
  }

  function openComposeNew() {
    resetCompose();
    setComposeOpen(true);
    setSendSuccess("");
    setError("");
  }

  function composeTestToSelf() {
    if (!user) return;
    resetCompose();
    setComposeMode("new");
    setSendTo(`${user}@${domain}`);
    setSendSubject("Qadbak webmail test");
    setSendBody(
      `Test message from Qadbak Mail at ${new Date().toLocaleString()}.\n\nIf you see this in INBOX, receiving works.`,
    );
    setComposeOpen(true);
    setSendSuccess("");
    setError("");
  }

  function startReply(mode: ComposeMode, msg: ImapMessageDetail) {
    const replyAddr = parseEmailAddress(msg.replyTo || msg.from || "");
    if (mode === "forward") {
      setComposeMode("forward");
      setSendTo("");
      setSendCc("");
      setSendSubject(forwardSubject(msg.subject || ""));
      setSendBody(
        forwardBody({
          from: msg.from,
          to: msg.to,
          date: msg.date,
          subject: msg.subject,
          bodyText: msg.bodyText,
        }),
      );
      setSendInReplyTo("");
      setSendReferences("");
    } else if (mode === "reply-all") {
      const others = new Set<string>([
        ...parseAddressList(msg.to),
        ...parseAddressList(msg.cc),
        ...parseAddressList(msg.from),
      ]);
      others.delete(selfEmail);
      if (replyAddr) others.delete(replyAddr);
      setComposeMode("reply-all");
      setSendTo(replyAddr);
      setSendCc([...others].join(", "));
      setSendSubject(replySubject(msg.subject || ""));
      setSendBody(
        quoteReplyBody({
          from: msg.from,
          date: msg.date,
          bodyText: msg.bodyText,
        }),
      );
      setSendInReplyTo(msg.messageId || "");
      setSendReferences(
        buildReferencesHeader(msg.references, msg.messageId) || "",
      );
    } else {
      setComposeMode("reply");
      setSendTo(replyAddr);
      setSendCc("");
      setSendSubject(replySubject(msg.subject || ""));
      setSendBody(
        quoteReplyBody({
          from: msg.from,
          date: msg.date,
          bodyText: msg.bodyText,
        }),
      );
      setSendInReplyTo(msg.messageId || "");
      setSendReferences(
        buildReferencesHeader(msg.references, msg.messageId) || "",
      );
    }
    setComposeOpen(true);
    setSendSuccess("");
    setError("");
  }

  async function sendMail(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !sendTo) return;
    setSendLoading(true);
    setError("");
    setSendSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/mailboxes/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user,
          to: sendTo,
          cc: sendCc,
          subject: sendSubject,
          body: sendBody,
          inReplyTo: sendInReplyTo,
          references: sendReferences,
        }),
      });
      const raw = await res.text();
      let data: { error?: string; ok?: boolean; source?: string } = {};
      try {
        data = raw
          ? (JSON.parse(raw) as { error?: string; ok?: boolean; source?: string })
          : {};
      } catch {
        const preview = raw.replace(/\s+/g, " ").slice(0, 120);
        throw new Error(
          res.ok
            ? "Invalid server response."
            : `Send failed (${res.status}): ${preview || res.statusText}`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      const via = (data as { source?: string }).source;
      setSendSuccess(
        via === "smtp-local"
          ? `Message sent to ${sendTo} (delivered on this server).`
          : `Message sent to ${sendTo}.`,
      );
      setComposeOpen(false);
      resetCompose();
      if (selectedFolder) await loadMessages(selectedFolder);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSendLoading(false);
    }
  }

  async function refreshAll() {
    await load();
    if (selectedFolder) await loadMessages(selectedFolder);
    if (selectedMessage?.id && selectedFolder) {
      await openMessage(selectedMessage.id);
    }
  }

  return {
    domain,
    enc,
    user,
    setUser,
    users,
    mailboxes,
    error,
    setError,
    loading,
    searchQuery,
    setSearchQuery,
    source,
    authUser,
    maildirRoot,
    selectedFolder,
    messages,
    messagesSource,
    messagesLoading,
    selectedMessage,
    messageLoading,
    filteredMessages,
    composeMode,
    composeOpen,
    setComposeOpen,
    sendTo,
    setSendTo,
    sendCc,
    setSendCc,
    sendSubject,
    setSendSubject,
    sendBody,
    setSendBody,
    sendLoading,
    sendSuccess,
    load,
    loadMessages,
    openMessage,
    openComposeNew,
    composeTestToSelf,
    startReply,
    sendMail,
    resetCompose,
    refreshAll,
  };
}
