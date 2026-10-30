import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// jsdomを指定して実行する。外部リソースの取得は行わない。
const { JSDOM } = require(process.env.JSDOM_PATH || "jsdom");
// DOM操作の検証に限定し、jsdomが未対応のTailwind CSS構文を除外する。
const html = fs
  .readFileSync(
    new URL("../../../exams/2026/01/index.html", import.meta.url),
    "utf8",
  )
  .replace(/<style>[\s\S]*?<\/style>/g, "");
function create(saved) {
  const dom = new JSDOM(html, {
    url: "https://boki.example/",
    runScripts: "dangerously",
    beforeParse(window) {
      if (saved) window.localStorage.setItem("boki3-mock-2026-v1", saved);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.scrollTo = () => {};
      window.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function () {
        this.open = false;
      };
      window.HTMLInputElement.prototype.reportValidity = () => true;
    },
  });
  return dom;
}
const dom = create();
const w = dom.window,
  doc = w.document;
const evaluate = (source) => w.eval(source);
function set(id, value) {
  const el = doc.getElementById(id);
  assert.ok(el, id);
  el.value = value;
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  return el;
}
try {
  assert.equal(evaluate("createAnswerReport()"), null);
  assert.equal(doc.getElementById("exportAnswers"), null);
  doc.getElementById("start").click();
  assert.equal(doc.getElementById("intro").hidden, true);
  assert.equal(doc.querySelectorAll("[data-answer]").length, 204);
  const amount = set("j0d0v", "１２３４５６７");
  amount.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(amount.value, "1,234,567");
  set("j0d0v", "0");
  amount.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(amount.value, "0");
  set("j0d0v", "1.5");
  amount.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(amount.getAttribute("aria-invalid"), "true");
  set("j0d0v", "");
  amount.dispatchEvent(new w.FocusEvent("focusout", { bubbles: true }));
  assert.equal(amount.value, "");
  doc.querySelector('[data-tab="2"]').click();
  assert.equal(doc.getElementById("panel2").hidden, false);
  assert.equal(doc.getElementById("panel1").hidden, true);
  const interest = set("s1", "4,000");
  interest.dispatchEvent(new w.FocusEvent("focusout", { bubbles: true }));
  const saved = w.localStorage.getItem("boki3-mock-2026-v1");
  const resumed = create(saved);
  assert.equal(resumed.window.document.getElementById("s1").value, "4,000");
  assert.equal(resumed.window.eval("state.tab"), 2);
  assert.equal(
    resumed.window.eval("state.deadline"),
    evaluate("state.deadline"),
  );
  resumed.window.close();
  // 借方・貸方の順を入れ替えた完全解答で、採点を通して確認する。
  evaluate(
    `state.answers={}; journals.forEach((q,i)=>['d','c'].forEach(s=>[...q[s]].reverse().forEach(([a,v],r)=>{state.answers['j'+i+s+r+'a']=a;state.answers['j'+i+s+r+'v']=money(v);}))); [...short,...finalFields].forEach(f=>state.answers[f.id]=String(f.answer));`,
  );
  assert.deepEqual(Array.from(evaluate("scores()")), [45, 20, 35]);
  evaluate(`state.answers.j0d0v='120,000'`);
  assert.equal(evaluate("scores()[0]"), 42);
  evaluate(
    `state.answers.j0d0v='123,000'; state.answers.j0d1a='仕入'; state.answers.j0d1v='0'`,
  );
  assert.equal(evaluate("gradeJournal(journals[0],0)"), false);
  evaluate(`delete state.answers.j0d1a;delete state.answers.j0d1v`);
  assert.equal(evaluate("gradeJournal(journals[0],0)"), true);
  // 問題データとは独立した決算整理の集計で、利益と貸借一致を検算する。
  const cost = 180000 + 2400000 - 220000;
  const profit =
    4200000 -
    cost -
    (720000 + 25000) -
    360000 -
    (120000 - 60000) -
    (18000 + 3000) -
    (480000 * 0.02 - 6000) -
    900000 / 5 -
    2000 -
    90000;
  assert.equal(profit, 378400);
  const assets =
    148000 +
    1800000 +
    (480000 - 9600) +
    220000 +
    (900000 - 180000 - 180000) +
    60000;
  const liabilitiesEquity =
    350000 + 600000 + 25000 + 3000 + 50000 + 1500000 + 332000 + profit;
  assert.equal(assets, 3238400);
  assert.equal(assets, liabilitiesEquity);
  assert.equal(evaluate("trial.reduce((n,r)=>n+r[1]-r[2],0)"), 0);
  assert.equal(evaluate("finalFields.reduce((n,f)=>n+f.points,0)"), 35);
  doc.getElementById("finish").click();
  assert.equal(doc.getElementById("confirm").open, true);
  doc.getElementById("confirmFinish").click();
  assert.equal(evaluate("state.status"), "done");
  assert.match(doc.getElementById("result").textContent, /100.*100点/s);
  assert.equal(doc.querySelectorAll("[data-answer]:not(:disabled)").length, 0);
  // 出力は問題資料・生の入力・数値・採点を含み、JSON単体で復習できる。
  const report = JSON.parse(evaluate("JSON.stringify(createAnswerReport())"));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.exam.id, "boki3-2026-01");
  assert.equal(report.attempt.score, 100);
  assert.equal(report.sections[0].questions.length, 15);
  assert.equal(report.sections[1].parts.length, 2);
  assert.equal(report.sections[2].questions.length, 14);
  assert.equal(report.sections[2].trialBalance.length, 18);
  assert.equal(report.sections[2].adjustments.length, 7);
  assert.match(report.sections[1].parts[0].instructions, /1,200,000/);
  assert.equal(report.sections[1].parts[1].sourceData[1].cost, 480000);
  assert.equal(
    report.sections[2].questions.find((q) => q.id === "f6").correctAnswer,
    378400,
  );
  evaluate(
    "state.answers.f0='１２３';state.answers.f1='';state.answers.f2='abc';state.marks[0]=true",
  );
  const mistakes = JSON.parse(evaluate("JSON.stringify(createAnswerReport())"));
  assert.equal(mistakes.sections[2].questions[0].userAnswer.raw, "１２３");
  assert.equal(mistakes.sections[2].questions[0].userAnswer.value, 123);
  assert.equal(mistakes.sections[2].questions[0].correct, false);
  assert.equal(mistakes.sections[2].questions[1].userAnswer.value, null);
  assert.equal(mistakes.sections[2].questions[2].userAnswer.raw, "abc");
  assert.equal(mistakes.sections[2].questions[2].userAnswer.value, null);
  assert.equal(mistakes.sections[0].questions[0].markedForReview, true);
  let downloadedBlob,
    downloadName,
    clicked = false;
  w.URL.createObjectURL = (blob) => {
    downloadedBlob = blob;
    return "blob:test";
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    clicked = true;
    downloadName = this.download;
  };
  doc.getElementById("exportAnswers").click();
  assert.equal(clicked, true);
  assert.match(downloadName, /^boki3-2026-01-answers-.*\.json$/);
  assert.equal(downloadedBlob.type, "application/json;charset=utf-8");
  const downloadedText = await new Promise((resolve, reject) => {
    const reader = new w.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(downloadedBlob);
  });
  assert.equal(
    JSON.parse(downloadedText).attempt.score,
    mistakes.attempt.score,
  );
  // 採点結果を再表示した場合にも保存ボタンが有効になる。
  evaluate("showResult()");
  clicked = false;
  doc.getElementById("exportAnswers").click();
  assert.equal(clicked, true);
  const expired = JSON.parse(saved);
  expired.deadline = Date.now() - 1000;
  const timed = create(JSON.stringify(expired));
  assert.equal(timed.window.eval("state.status"), "done");
  assert.equal(timed.window.eval("state.expired"), true);
  assert.match(
    timed.window.document.getElementById("result").textContent,
    /自動提出/,
  );
  assert.ok(timed.window.document.getElementById("exportAnswers"));
  assert.equal(
    timed.window.eval("createAnswerReport().attempt.submittedByTimeout"),
    true,
  );
  timed.window.close();
  console.log(
    "PASS: 金額整形・全角入力・空欄/ゼロ/不正値・大問移動・復元・100点採点・誤答/重複排除・決算検算・提出/解答ロック・時間切れ・JSONの内容/ダウンロード",
  );
} finally {
  w.close();
}
