import type { ToolDef } from "../types.ts";
import { runJXA, esc } from "../applescript.ts";

const FMT = `
  const lines = [];
  for (let i = 0; i < firstNames.length; i++) {
    const full = ((firstNames[i] || "") + " " + (lastNames[i] || "")).trim();
    const org = orgs[i] || "";
    lines.push(org ? full + " \\u2014 " + org : full);
  }`;

const findContact = (name: string) => `
  const matches = app.people.whose({ name: {_contains: "${name}"} });
  if (matches.length === 0) throw new Error("Contact not found: ${name}");
  if (matches.length > 1) throw new Error("Multiple contacts match: ${name}");`;

const findContactExact = (name: string) => `
  const matches = app.people.whose({ name: "${name}" });
  if (matches.length === 0) throw new Error("Contact not found: ${name}");
  if (matches.length > 1) throw new Error("Multiple contacts match: ${name}");`;

const tools: ToolDef[] = [
  {
    name: "contacts_list",
    desc: "List contacts (name and organization)",
    params: {
      limit: { type: "number", desc: "Max contacts to return (default: all)", int: true, min: 1 },
    },
    handle: async (a) => {
      const lim = a.limit as number | undefined;
      const slice = lim ? `.slice(0, ${lim})` : "";
      return runJXA(`
        const app = Application("Contacts");
        const firstNames = app.people.firstName()${slice};
        const lastNames = app.people.lastName()${slice};
        const orgs = app.people.organization()${slice};
        ${FMT}
        lines.length === 0 ? "No contacts found" : lines.join("\\n");
      `);
    },
  },
  {
    name: "contacts_search",
    desc: "Search contacts by name",
    params: {
      query: { type: "string", desc: "Name to search for", req: true },
    },
    handle: async (a) => {
      const query = esc(a.query as string);
      return runJXA(`
        const app = Application("Contacts");
        const results = app.people.whose({ name: {_contains: "${query}"} });
        const firstNames = results.firstName();
        const lastNames = results.lastName();
        const orgs = results.organization();
        ${FMT}
        lines.length === 0 ? "No contacts matching: ${query}" : lines.join("\\n");
      `);
    },
  },
  {
    name: "contacts_get",
    desc: "Get full details of a contact by name",
    params: {
      name: { type: "string", desc: "Contact name (first, last, or full)", req: true },
    },
    handle: async (a) => {
      const name = esc(a.name as string);
      return runJXA(`
        const app = Application("Contacts");
        ${findContact(name)}
        const p = matches[0];
        const lines = ["Name: " + (p.firstName() || "") + " " + (p.lastName() || "")];
        const org = p.organization();
        if (org) lines.push("Organization: " + org);
        const title = p.jobTitle();
        if (title) lines.push("Title: " + title);
        for (const e of p.emails()) lines.push("Email (" + e.label() + "): " + e.value());
        for (const ph of p.phones()) lines.push("Phone (" + ph.label() + "): " + ph.value());
        for (const addr of p.addresses()) lines.push("Address (" + addr.label() + "): " + addr.formattedAddress());
        lines.join("\\n");
      `);
    },
  },
  {
    name: "contacts_create",
    desc: "Create a new contact in Apple Contacts",
    params: {
      firstName: { type: "string", desc: "First name", req: true },
      lastName: { type: "string", desc: "Last name", req: true },
      email: { type: "string", desc: "Email address" },
      phone: { type: "string", desc: "Phone number" },
      org: { type: "string", desc: "Organization" },
      title: { type: "string", desc: "Job title" },
    },
    handle: async (a) => {
      const first = esc(a.firstName as string);
      const last = esc(a.lastName as string);
      const props = [`firstName: "${first}"`, `lastName: "${last}"`];
      if (a.org) props.push(`organization: "${esc(a.org as string)}"`);
      if (a.title) props.push(`jobTitle: "${esc(a.title as string)}"`);
      const after: string[] = [];
      if (a.email) after.push(`p.emails.push(app.Email({label: "work", value: "${esc(a.email as string)}"}));`);
      if (a.phone) after.push(`p.phones.push(app.Phone({label: "work", value: "${esc(a.phone as string)}"}));`);
      return runJXA(`
        const app = Application("Contacts");
        const p = app.Person({${props.join(", ")}});
        app.people.push(p);
        ${after.join(" ")}
        app.save();
        "Contact created: ${first} ${last}";
      `);
    },
  },
  {
    name: "contacts_update",
    desc: "Update an existing contact by exact full name",
    params: {
      name: { type: "string", desc: "Exact full name of the contact", req: true },
      newFirstName: { type: "string", desc: "New first name" },
      newLastName: { type: "string", desc: "New last name" },
      newEmail: { type: "string", desc: "New primary email address" },
      newPhone: { type: "string", desc: "New primary phone number" },
      newOrg: { type: "string", desc: "New organization" },
      newTitle: { type: "string", desc: "New job title" },
    },
    handle: async (a) => {
      const name = esc(a.name as string);
      const updates: string[] = [];
      if (a.newFirstName) updates.push(`p.firstName = "${esc(a.newFirstName as string)}";`);
      if (a.newLastName) updates.push(`p.lastName = "${esc(a.newLastName as string)}";`);
      if (a.newOrg) updates.push(`p.organization = "${esc(a.newOrg as string)}";`);
      if (a.newTitle) updates.push(`p.jobTitle = "${esc(a.newTitle as string)}";`);
      if (a.newEmail) updates.push(`
        if (p.emails.length > 0) {
          p.emails[0].value = "${esc(a.newEmail as string)}";
        } else {
          p.emails.push(app.Email({label: "work", value: "${esc(a.newEmail as string)}"}));
        }
      `);
      if (a.newPhone) updates.push(`
        if (p.phones.length > 0) {
          p.phones[0].value = "${esc(a.newPhone as string)}";
        } else {
          p.phones.push(app.Phone({label: "work", value: "${esc(a.newPhone as string)}"}));
        }
      `);
      if (!updates.length) throw new Error("No updates specified");
      return runJXA(`
        const app = Application("Contacts");
        ${findContactExact(name)}
        const p = matches[0];
        ${updates.join("\n")}
        app.save();
        "Contact updated: ${name}";
      `);
    },
  },
  {
    name: "contacts_delete",
    desc: "Delete a contact by exact full name",
    params: {
      name: { type: "string", desc: "Contact name (must match exactly)", req: true },
    },
    handle: async (a) => {
      const name = esc(a.name as string);
      return runJXA(`
        const app = Application("Contacts");
        ${findContactExact(name)}
        app.delete(matches[0]);
        app.save();
        "Contact deleted: ${name}";
      `);
    },
  },
];

export default tools;
