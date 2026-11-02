import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// jsdomを指定して実行する。外部リソースの取得は行わない。
const { JSDOM } = require(process.env.JSDOM_PATH || "jsdom");
// DOM操作の検証に限定し、jsdomが未対応のTailwind CSS構文を除外する。
const html = fs
  .readFileSync(
    new URL("../../../exams/2026/03/index.html", import.meta.url),
    "utf8",
  )
  .replace(/<style>[\s\S]*?<\/style>/g, "");
function create(saved) {
  const dom = new JSDOM(html, {
    url: "https://boki.example/",
    runScripts: "dangerously",
    beforeParse(window) {
      window.localStorage.setItem(
        "boki3-mock-2026-v1",
        JSON.stringify({
          status: "done",
          deadline: 1,
          tab: 3,
          answers: { f0: "999" },
          marks: {},
        }),
      );
      if (saved) window.localStorage.setItem("boki3-mock-2026-03-v1", saved);
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
  assert.equal(evaluate("state.status"), "ready");
  assert.equal(evaluate("state.answers.f0"), undefined);
  assert.equal(evaluate("createAnswerReport()"), null);
  assert.equal(doc.getElementById("exportAnswers"), null);
  doc.getElementById("start").click();
  assert.equal(doc.getElementById("intro").hidden, true);
  assert.equal(doc.querySelectorAll("[data-answer]").length, 204);
  // 解答欄が独立した一覧へ戻らず、勘定・台帳・財務諸表の中に存在することを確認する。
  for (const [tableId, ids] of [
    ["rent-ledger", ["s0", "s1", "s2"]],
    ["deferred-rent-ledger", ["s3"]],
    ["rent-reversal", ["s4"]],
    ["asset-register", ["s5", "s6", "s7", "s8"]],
    ["asset-sale", ["s9"]],
    ["income-statement", ["f0", "f1", "f2", "f3", "f4", "f5", "f6"]],
    ["balance-sheet", ["f7", "f8", "f9", "f10", "f11", "f12", "f13"]],
  ]) {
    for (const id of ids) {
      assert.equal(doc.getElementById(id).closest("table").id, tableId);
      assert.equal(doc.querySelectorAll(`[id="${id}"]`).length, 1);
    }
  }
  assert.match(doc.querySelector("#balance-sheet thead").textContent, /借方.*貸方/);
  assert.match(doc.getElementById("f12").closest("tr").textContent, /未払法人税等/);

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
  const interest = set("s1", "120,000");
  interest.dispatchEvent(new w.FocusEvent("focusout", { bubbles: true }));
  const saved = w.localStorage.getItem("boki3-mock-2026-03-v1");
  const resumed = create(saved);
  assert.equal(resumed.window.document.getElementById("s1").value, "120,000");
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
  evaluate(`state.answers.j0d0v='11,000'`);
  assert.equal(evaluate("scores()[0]"), 42);
  evaluate(
    `state.answers.j0d0v='87,000'; state.answers.j0d1a='仕入'; state.answers.j0d1v='0'`,
  );
  assert.equal(evaluate("gradeJournal(journals[0],0)"), false);
  evaluate(`delete state.answers.j0d1a;delete state.answers.j0d1v`);
  assert.equal(evaluate("gradeJournal(journals[0],0)"), true);
  // 問題データとは独立した決算整理の集計で、利益と貸借一致を検算する。
  const cost = 480000 + 6200000 - 560000;
  const depreciation = 2400000 / 5 + ((360000 / 5) * 6) / 12;
  const receivable = 1280000 - 160000;
  const profit =
    10800000 -
    cost -
    (1920000 + 64000) -
    (960000 - 3600) -
    (192000 * 9) / 12 -
    (48000 + 8000) -
    (receivable * 0.02 - 16000) -
    depreciation -
    260000;
  assert.equal(profit, 757200);
  const assets =
    420000 +
    3600 +
    (2840000 + 160000) +
    receivable * 0.98 +
    560000 +
    (2400000 + 360000 - 600000 - depreciation) +
    48000;
  const liabilitiesEquity =
    1040000 + 1600000 + 64000 + 8000 + 140000 + 3000000 + 164000 + profit;
  assert.equal(assets, 6773200);
  assert.equal(assets, liabilitiesEquity);
  assert.equal(evaluate('finalFields.find(f=>f.id==="f6").answer'), profit);
  assert.equal(
    evaluate('finalFields.find(f=>f.id==="f13").answer'),
    164000 + profit,
  );
  // 固定資産の償却と売却を台帳から独立して計算する。
  const annualA = 600000 / 5;
  const accumulatedA = 240000 + annualA;
  const annualB = ((360000 / 4) * 6) / 12;
  assert.deepEqual(Array.from(evaluate("short.slice(5).map(f=>f.answer)")), [
    annualA,
    accumulatedA,
    annualB,
    360000 - annualB,
    270000 - (600000 - accumulatedA),
  ]);
  assert.deepEqual(Array.from(evaluate("short.slice(1,4).map(f=>f.answer)")), [
    (240000 * 3) / 6,
    (240000 * 3) / 6,
    (240000 * 3) / 6,
  ]);
  assert.equal(
    evaluate(
      "journals.every(q=>q.d.reduce((n,r)=>n+r[1],0)===q.c.reduce((n,r)=>n+r[1],0))",
    ),
    true,
  );
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
  assert.equal(report.exam.id, "boki3-2026-03");
  assert.equal(report.attempt.score, 100);
  assert.equal(report.sections[0].questions.length, 15);
  assert.equal(report.sections[1].parts.length, 2);
  assert.equal(report.sections[2].questions.length, 14);
  assert.equal(report.sections[2].trialBalance.length, 19);
  assert.equal(report.sections[2].adjustments.length, 9);
  assert.match(report.sections[1].parts[0].instructions, /240,000/);
  assert.equal(report.sections[1].parts[1].sourceData[1].cost, 360000);
  assert.equal(
    report.sections[2].questions.find((q) => q.id === "f6").correctAnswer,
    757200,
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
  assert.match(downloadName, /^boki3-2026-03-answers-.*\.json$/);
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
