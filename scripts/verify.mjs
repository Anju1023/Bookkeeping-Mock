import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
// 指定がなければ各回の検証ファイルを集めて実行する。
async function collect(directory) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await collect(target)));
    else if (entry.name.endsWith(".test.mjs")) results.push(target);
  }
  return results.sort();
}
const targets =
  process.argv.length > 2
    ? process.argv.slice(2).map((target) => path.resolve(root, target))
    : await collect(path.join(root, "tests/exams"));
if (!targets.length) throw new Error("検証ファイルが見つからないよ。");
for (const target of targets) {
  console.log(`検証: ${path.relative(root, target)}`);
  const result = spawnSync(process.execPath, [target], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`${targets.length}件の検証が完了したよ。`);
