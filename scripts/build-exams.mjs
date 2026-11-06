import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const template = await fs.readFile(
  new URL("exam-template.html", import.meta.url),
  "utf8",
);
const runtime = await fs.readFile(
  new URL("exam-runtime.js", import.meta.url),
  "utf8",
);
const numbers =
  process.argv.length > 2 ? process.argv.slice(2) : ["01", "02", "03", "04", "05"];
for (const number of numbers) {
  const { default: exam } = await import(`./exams/2026/${number}.mjs`);
  const fields = [
    ...exam.parts.flatMap((part) => part.groups),
    ...exam.final.groups,
  ].flatMap((unit) => unit.fields);
  if (new Set(fields.map((field) => field.id)).size !== fields.length)
    throw new Error(`解答ID重複: ${number}`);
  if (exam.journals.length !== 15) throw new Error(`仕訳数が不正: ${number}`);
  const points = [
    exam.parts
      .flatMap((part) => part.groups)
      .reduce((sum, unit) => sum + unit.points, 0),
    exam.final.groups.reduce((sum, unit) => sum + unit.points, 0),
  ];
  if (points[0] !== 20 || points[1] !== 35)
    throw new Error(`配点が不正: ${number}`);
  // 設定内の文字列を置換文字列として評価せず、そのまま埋め込む。
  const replacements = {
    __EXAM_TITLE__: exam.title,
    __EXAM_EDITION__: exam.revision === 1 ? "第1版" : "改訂第2版",
    __EXAM_CONFIRMED__: exam.confirmed || (number === "04" ? "2026年11月5日" : "2026年11月2日"),
    __EXAM_NOTICE__:
      exam.revision === 1
        ? `第${Number(number)}回は新作のオリジナル模試だよ。保存データはほかの回と分けて管理するよ。`
        : "問題を全面改訂したため、旧版の解答は引き継がず新しく開始するよ。旧版の保存領域は削除しないよ。",
    __EXAM_NUMBER__: number,
    __EXAM_SUMMARY__: exam.summary,
    __SECOND_TITLE__: exam.secondTitle,
    __THIRD_TITLE__: exam.thirdTitle,
    __EXAM_CONFIG__: JSON.stringify(exam, null, 2).replace(/</g, "\\u003c"),
    __EXAM_RUNTIME__: runtime,
  };
  const html = template.replace(
    /__EXAM_[A-Z_]+__|__SECOND_TITLE__|__THIRD_TITLE__/g,
    (marker) => replacements[marker],
  );
  const target = new URL(`exams/2026/${number}/index.html`, root);
  await fs.writeFile(target, html);
  console.log(`模試生成: ${fileURLToPath(target)}`);
}
