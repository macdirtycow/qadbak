/**
 * App-install orchestrator.
 *
 * Wraps a single template.install() call in a Journal entry so the user
 * sees one record "Installed WordPress on foo.com" containing every
 * underlying step (db-create, file download, wp-config write, chown).
 */

import { beginJournal } from "@/lib/journal";
import {
  consumeLastJournalSteps,
  runWithJournalStore,
} from "@/lib/provisioner/native-exec";
import { getTemplate } from "./registry";
import type { AppInstallContext, AppInstallResult, AppTemplate } from "./types";

export class AppValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "AppValidationError";
  }
}

export class AppNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown app template "${id}".`);
    this.name = "AppNotFoundError";
  }
}

function validate(template: AppTemplate, input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of template.inputs) {
    if (field.type === "boolean") {
      const raw = input[field.name];
      out[field.name] =
        raw === true || raw === "true" || raw === "1" ? "true" : "false";
      continue;
    }

    const raw = input[field.name];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) {
        throw new AppValidationError(`Missing required field "${field.label}".`);
      }
      if ("defaultValue" in field && field.defaultValue) {
        out[field.name] = field.defaultValue;
      }
      continue;
    }
    if (field.type === "domain") {
      if (!/^[a-z0-9.-]{3,253}$/i.test(value) || !value.includes(".")) {
        throw new AppValidationError(`"${field.label}" must look like a domain.`);
      }
    } else if (field.type === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        throw new AppValidationError(`"${field.label}" must be a valid email.`);
      }
    } else if ("pattern" in field && field.pattern) {
      const re = new RegExp(field.pattern);
      if (!re.test(value)) {
        throw new AppValidationError(
          `"${field.label}" does not match the required format (${field.pattern}).`,
        );
      }
    }
    out[field.name] = value;
  }
  return out;
}

export async function runAppInstall(opts: {
  templateId: string;
  rawInput: Record<string, unknown>;
  session: AppInstallContext["session"];
}): Promise<AppInstallResult> {
  return runWithJournalStore(async () => {
    const template = await getTemplate(opts.templateId);
    if (!template) throw new AppNotFoundError(opts.templateId);

    const input = validate(template, opts.rawInput);

    const journal = beginJournal({
      action: `app.install.${template.id}`,
      summary: `Install ${template.label} on ${input.domain ?? "(unknown)"}`,
      session: opts.session,
      target: input.domain ? { domain: input.domain } : undefined,
      metadata: { templateId: template.id, fields: Object.keys(input) },
    });
    consumeLastJournalSteps();
    journal.infoStep(
      `Validated input for ${template.label} — fields: ${Object.keys(input).join(", ")}`,
    );

    try {
      const partial = await template.install({ input, session: opts.session });
      journal.captureFromHelper(consumeLastJournalSteps());
      journal.infoStep(
        `${template.label} installed on ${partial.domain}. Wizard URL: ${partial.primaryUrl}`,
      );
      const finished = await journal.finish(true);
      return {
        ...partial,
        appId: template.id,
        journalId: finished.id,
      };
    } catch (err) {
      journal.captureFromHelper(consumeLastJournalSteps());
      await journal.finish(false, err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
}
