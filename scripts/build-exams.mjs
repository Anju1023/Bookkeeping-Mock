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
for (const number of ["01", "02", "03"]) {
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
