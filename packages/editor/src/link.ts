// Connecting two people already on the chart (Alt-drag from one card to another, or "Connect to…" and a
// click): the editor asks how they are related and makes the line or the marriage.
import { addDescent, addUnion, type Op } from "@crownline/ops";
import { choose } from "./dialog.ts";
import { textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

export async function link(ed: Editor, a: string, b: string): Promise<void> {
  const doc = ed.doc, name = (id: string) => textOf(doc.people[id]?.name, ed.lang) || id;
  const unions = Object.entries(doc.unions ?? {});
  const married = unions.find(([, u]) => u.partners.includes(a) && u.partners.includes(b));
  const hasParents = (id: string) => Object.values(doc.descents ?? {}).some(d => d.child === id);
  const options: [string, string][] = [];
  const asChild = (parent: string, child: string) => {
    for (const [k, u] of unions.filter(([, u]) => u.partners.includes(parent) && !u.partners.includes(child)))
      options.push([`union:${k}:${child}`, `${name(child)} is the child of ${name(parent)} and ${name(u.partners.find(x => x !== parent)!)}`]);
    options.push([`parent:${parent}:${child}`, `${name(child)} is the child of ${name(parent)}`]);
  };
  // a married couple are not each other's parent and child
  if (!married && !hasParents(b)) asChild(a, b);
  if (!married && !hasParents(a)) asChild(b, a);
  if (!married) {
    options.push([`spouse:${a}:${b}`, `${name(b)} married ${name(a)} (drawn on the right)`]);
    options.push([`spouse:${b}:${a}`, `${name(b)} married ${name(a)} (drawn on the left)`]);
  }
  if (!options.length) {
    await choose("Already connected", `${name(a)} and ${name(b)} are already married.`, [["ok", "OK"]]);
    return;
  }
  const v = await choose(`Connect ${name(a)} and ${name(b)}`, "How are they related?", options);
  if (!v) return;
  const [kind, x, y] = v.split(":");
  let op: Op;
  if (kind === "union") op = addDescent(doc, { union: x, child: y });
  else if (kind === "parent") op = addDescent(doc, { parent: x, child: y });
  else op = addUnion(doc, x, y);
  ed.run(op);
}
