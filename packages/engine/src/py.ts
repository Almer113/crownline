// Python's ways of writing numbers and text, so the output is the same to the character.

/** f"{x:.{d}f}": the exact value, correctly rounded, an exact half going to the even digit (JavaScript's
 *  toFixed takes the larger one) */
export function pyFixed(x: number, d: number): string {
  const s = Math.abs(x) * 10 ** d, frac = s - Math.floor(s);
  if (Math.abs(frac - 0.5) > 1e-6 && s < 1e9) return x.toFixed(d);   // nowhere near a half (fast)
  const exact = Math.abs(x).toFixed(Math.min(100, d + 60));        // every digit of the double (exact)
  const tail = exact.slice(exact.indexOf(".") + 1 + d);
  if (!/^50*$/.test(tail)) return x.toFixed(d);                    // not a half: one nearest answer
  const n = Math.floor(Math.abs(x) * 10 ** d), even = n % 2 === 0 ? n : n + 1;
  return (x < 0 ? "-" : "") + (even / 10 ** d).toFixed(d);
}

/** html.escape(s): & < > " ' */
export const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** len(s): code points */
export const pyLen = (s: string) => [...s].length;
