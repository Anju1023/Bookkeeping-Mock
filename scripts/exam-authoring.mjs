// 作問時の表と採点単位を組み立てる。実行時の依存は生成HTMLへ埋め込む。
export const yen = (value) => Number(value).toLocaleString("ja-JP");
export const slot = (id) => `{{${id}}}`;
export const table = (id, caption, headings, rows) => ({
  id,
  caption,
  headings,
  rows,
});
export const journal = (
  topic,
  question,
  debit,
  credit,
  explanation,
  materials = [],
) => ({ topic, question, debit, credit, explanation, materials });
export const amount = (id, label, answer, explanation, unit = "円") => ({
  id,
  label,
  answer,
  explanation,
  type: "amount",
  unit,
});
export const choice = (id, label, answer, options, explanation) => ({
  id,
  label,
  answer,
  options,
  explanation,
  type: "select",
});
export const multiple = (id, label, answer, options, explanation) => ({
  id,
  label,
  answer,
  options,
  explanation,
  type: "multiple",
});
export const blank = (id, label) => ({
  id,
  label,
  answer: null,
  type: "blank",
  explanation: "この欄には記入しない。借方・貸方を両方に記入しない。",
});
export const group = (id, label, points, fields) => ({
  id,
  label,
  points,
  fields,
});
export function trial(rows) {
  return rows.map(([account, balance]) => [
    account,
    Math.max(0, balance),
    Math.max(0, -balance),
  ]);
}
export const books = [
  "現金出納帳",
  "当座預金出納帳",
  "商品有高帳",
  "売掛金元帳",
  "買掛金元帳",
  "仕入帳",
  "売上帳",
  "固定資産台帳",
];
export const ledgerChoices = [
  "現金",
  "普通預金",
  "前払家賃",
  "支払家賃",
  "損益",
  "前期繰越",
  "次期繰越",
];
