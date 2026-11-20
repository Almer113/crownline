// The fonts the engine knows, by the names theme.fonts uses (model.py SANS, SCRIPT, JAVANESE), as files
// relative to the repository. Shared by the command line (node.ts) and the browser editor (web.ts).
import type { Doc } from "./doc.ts";

export const SANS: Record<string, [string, string]> = {
  gantari: ["assets/fonts/open/Gantari-Regular.ttf", "assets/fonts/open/Gantari-Bold.ttf"],
  altehaas: ["assets/fonts/AlteHaasGroteskRegular.ttf", "assets/fonts/AlteHaasGroteskBold.ttf"],
};
export const SCRIPT: Record<string, [string, number]> = {
  felipa: ["assets/fonts/open/Felipa-Regular.ttf", 1.21],    // (file, size relative to Apple Chancery)
  chancery: ["assets/fonts/Apple Chancery.ttf", 1.0],
};
export const SECOND_SCRIPT: Record<string, string> = {
  noto: "assets/fonts/open/NotoSansJavanese-Regular.ttf",
  javatext: "assets/fonts/javatext.ttf",
  "noto-jp": "assets/fonts/open/NotoSansJP-Regular-subset.ttf",
};

export interface FontChoice {
  regular: string; bold: string;
  script?: string; scriptScale?: number;
  secondScript?: string;
}

/** the font files a document asks for; unknown names, and proprietary fonts in a public build, are refused */
export function fontChoice(doc: Doc, isPublic: boolean): FontChoice {
  const f = doc.theme.fonts as Record<string, string>;
  const sans = SANS[f.sans], second = f.secondScript ?? f.javanese;
  if (!sans) throw new Error(`theme.fonts.sans: no font "${f.sans}" (known: ${Object.keys(SANS).join(", ")})`);
  if (f.script && !SCRIPT[f.script]) throw new Error(`theme.fonts.script: no font "${f.script}" (known: ${Object.keys(SCRIPT).join(", ")})`);
  if (second && !SECOND_SCRIPT[second])
    throw new Error(`theme.fonts.secondScript: no font "${second}" (known: ${Object.keys(SECOND_SCRIPT).join(", ")})`);
  const c: FontChoice = { regular: sans[0], bold: sans[1], script: SCRIPT[f.script]?.[0], scriptScale: SCRIPT[f.script]?.[1],
                          secondScript: second ? SECOND_SCRIPT[second] : undefined };
  if (isPublic)
    for (const p of [c.regular, c.bold, c.script, c.secondScript])
      if (p && !p.startsWith("assets/fonts/open/")) throw new Error(`a public build may only use the open fonts in assets/fonts/open/, not ${p}`);
  return c;
}
