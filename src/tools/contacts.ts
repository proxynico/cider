import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolModule } from "../types.ts";
import { runJXA, escJS } from "../applescript.ts";
import {
  assertNoUnknownFields,
  assertRecord,
  optionalString,
  requireString,
} from "./validation.ts";

const tools: Tool[] = [
  {
    name: "contacts_list",
    description: "List all contacts (name and organization)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "contacts_search",
    description: "Search contacts by name",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "contacts_get",
    description: "Get full details of a contact by name",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Contact name (first, last, or full)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "contacts_create",
    description: "Create a new contact in Apple Contacts",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        email: { type: "string", description: "Email address (optional)" },
        phone: { type: "string", description: "Phone number (optional)" },
        org: { type: "string", description: "Organization (optional)" },
        title: { type: "string", description: "Job title (optional)" },
      },
      required: ["firstName", "lastName"],
    },
  },
  {
    name: "contacts_delete",
    description: "Delete a contact by name",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Contact name to delete (must match exactly)",
        },
      },
      required: ["name"],
    },
  },
];

// Shared JXA snippet for formatting contact list lines
const FMT_CONTACT_LINES = `
  const lines = [];
  for (let i = 0; i < firstNames.length; i++) {
    const full = ((firstNames[i] || "") + " " + (lastNames[i] || "")).trim();
    const org = orgs[i] || "";
    lines.push(org ? full + " — " + org : full);
  }`;

async function handleCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "contacts_list": {
      return runJXA(`
        const app = Application("Contacts");
        const firstNames = app.people.firstName();
        const lastNames = app.people.lastName();
        const orgs = app.people.organization();
        ${FMT_CONTACT_LINES}
        lines.length === 0 ? "No contacts found" : lines.join("\\n");
      `);
    }

    case "contacts_search": {
      const query = escJS(args.query as string);

      return runJXA(`
        const app = Application("Contacts");
        const results = app.people.whose({ name: {_contains: "${query}"} });
        const firstNames = results.firstName();
        const lastNames = results.lastName();
        const orgs = results.organization();
        ${FMT_CONTACT_LINES}
        lines.length === 0 ? "No contacts matching: ${query}" : lines.join("\\n");
      `);
    }

    case "contacts_get": {
      const contactName = escJS(args.name as string);

      return runJXA(`
        const app = Application("Contacts");
        const results = app.people.whose({ name: {_contains: "${contactName}"} });
        if (results.length === 0) {
          throw new Error("Contact not found: ${contactName}");
        }
        if (results.length > 1) {
          throw new Error("Multiple contacts matching: ${contactName}");
        }
        const p = results[0];
        const lines = ["Name: " + (p.firstName() || "") + " " + (p.lastName() || "")];
          const org = p.organization();
          if (org) lines.push("Organization: " + org);
          const title = p.jobTitle();
          if (title) lines.push("Title: " + title);
          for (const e of p.emails()) lines.push("Email (" + e.label() + "): " + e.value());
          for (const ph of p.phones()) lines.push("Phone (" + ph.label() + "): " + ph.value());
          for (const a of p.addresses()) lines.push("Address (" + a.label() + "): " + a.formattedAddress());
          lines.join("\\n");
      `);
    }

    case "contacts_create": {
      const firstName = escJS(args.firstName as string);
      const lastName = escJS(args.lastName as string);

      const props = [`firstName: "${firstName}"`, `lastName: "${lastName}"`];
      if (args.org) props.push(`organization: "${escJS(args.org as string)}"`);
      if (args.title) props.push(`jobTitle: "${escJS(args.title as string)}"`);

      const after: string[] = [];
      if (args.email)
        after.push(`p.emails.push(app.Email({label: "work", value: "${escJS(args.email as string)}"}));`);
      if (args.phone)
        after.push(`p.phones.push(app.Phone({label: "work", value: "${escJS(args.phone as string)}"}));`);

      return runJXA(`
        const app = Application("Contacts");
        const p = app.Person({${props.join(", ")}});
        app.people.push(p);
        ${after.join(" ")}
        app.save();
        "Contact created: ${firstName} ${lastName}";
      `);
    }

    case "contacts_delete": {
      const contactName = escJS(args.name as string);

      return runJXA(`
        const app = Application("Contacts");
        const matches = app.people.whose({ name: {_contains: "${contactName}"} });
        if (matches.length === 0) {
          throw new Error("Contact not found: ${contactName}");
        }
        if (matches.length > 1) {
          throw new Error("Multiple contacts matching: ${contactName}");
        }
        app.delete(matches[0]);
        app.save();
        "Contact deleted: ${contactName}";
      `);
    }

    default:
      throw new Error(`Unknown contacts tool: ${name}`);
  }
}

function parseArgs(name: string, rawArgs: Record<string, unknown>): Record<string, unknown> {
  const args = assertRecord(rawArgs, `contacts.${name}`);
  switch (name) {
    case "contacts_list":
      assertNoUnknownFields(args, [], "contacts_list");
      return {};

    case "contacts_search": {
      assertNoUnknownFields(args, ["query"], "contacts_search");
      return {
        query: requireString(args, "query", "contacts_search"),
      };
    }

    case "contacts_get": {
      assertNoUnknownFields(args, ["name"], "contacts_get");
      return {
        name: requireString(args, "name", "contacts_get"),
      };
    }

    case "contacts_create": {
      assertNoUnknownFields(
        args,
        ["firstName", "lastName", "email", "phone", "org", "title"],
        "contacts_create"
      );
      return {
        firstName: requireString(args, "firstName", "contacts_create"),
        lastName: requireString(args, "lastName", "contacts_create"),
        email: optionalString(args, "email", "contacts_create"),
        phone: optionalString(args, "phone", "contacts_create"),
        org: optionalString(args, "org", "contacts_create"),
        title: optionalString(args, "title", "contacts_create"),
      };
    }

    case "contacts_delete": {
      assertNoUnknownFields(args, ["name"], "contacts_delete");
      return {
        name: requireString(args, "name", "contacts_delete"),
      };
    }

    default:
      throw new Error(`Unknown contacts tool: ${name}`);
  }
}

export default { tools, parseArgs, handleCall } satisfies ToolModule;
