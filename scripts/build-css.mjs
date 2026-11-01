import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
// 指定されたHTML、または一覧・学習ページ・全模試へTailwind CSSを埋め込む。
const directory = process.argv[2];
if (!directory)
  throw new Error("Tailwind CSSのパッケージディレクトリを指定してね。");
const { compile } = await import(
  pathToFileURL(path.resolve(directory, "dist/lib.mjs"))
);
async function collect(directory) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await collect(target)));
    else if (entry.name === "index.html") results.push(target);
  }
  return results.sort();
}
const targets =
  process.argv.length > 3
    ? process.argv.slice(3).map((target) => path.resolve(root, target))
    : [
        path.join(root, "index.html"),
        ...(await collect(path.join(root, "study"))),
        ...(await collect(path.join(root, "exams"))),
      ];
const theme = await fs.readFile(path.join(directory, "theme.css"), "utf8");
const preflight = await fs.readFile(
  path.join(directory, "preflight.css"),
  "utf8",
);
const source = `@layer theme, base, components, utilities; @layer theme {${theme}} @layer base {${preflight} *,::before,::after {border-color: var(--color-slate-200);}} @layer utilities {@tailwind utilities;}`;
for (const target of targets) {
  const marker = /<!-- TAILWIND_START -->[\s\S]*?<!-- TAILWIND_END -->/;
  const original = await fs.readFile(target, "utf8");
  if (!marker.test(original))
    throw new Error(`CSS埋め込みマーカーが見つからない: ${target}`);
  const html = original.replace(
    marker,
    "<!-- TAILWIND_START -->\n<!-- TAILWIND_END -->",
  );
  const compiler = await compile(source);
  const css = compiler.build([...new Set(html.split(/[\s"'`<>=\{\}]+/))]);
  await fs.writeFile(
    target,
    html.replace(
      marker,
      `<!-- TAILWIND_START -->\n<style>\n${css}\n</style>\n<!-- TAILWIND_END -->`,
    ),
  );
  console.log(`CSS生成: ${path.relative(root, target)} (${css.length} bytes)`);
}
