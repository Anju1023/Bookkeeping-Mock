import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH || "jsdom");

export async function verifyExam(number, verifyAccounting) {
  const html = fs.readFileSync(
    new URL(`../../exams/2026/${number}/index.html`, import.meta.url),
    "utf8",
  );
  const clean = html.replace(/<style>[\s\S]*?<\/style>/g, "");
  const key = `boki3-mock-2026-${number}-v2`,
    legacyKey =
      number === "01" ? "boki3-mock-2026-v1" : `boki3-mock-2026-${number}-v1`;
  const opened = [];
  function create(saved, blocked = false) {
    const errors = [],
      console = new VirtualConsole();
    console.on("jsdomError", (error) => errors.push(error));
    const dom = new JSDOM(clean, {
      url: `https://boki.example/exams/2026/${number}/index.html`,
      runScripts: "dangerously",
      virtualConsole: console,
      beforeParse(window) {
        window.scrollTo = () => {};
        window.HTMLElement.prototype.scrollIntoView = () => {};
        window.HTMLInputElement.prototype.reportValidity = () => true;
        window.HTMLDialogElement.prototype.showModal = function () {
          this.open = true;
        };
        window.HTMLDialogElement.prototype.close = function () {
          this.open = false;
        };
        window.confirm = () => true;
        window.localStorage.setItem(
          legacyKey,
          JSON.stringify({
            status: "done",
            tab: 3,
            deadline: 1,
            answers: { f0v: "999" },
            marks: {},
          }),
        );
        window.localStorage.setItem("boki3-mock-2026-99-v2", "他の回");
        if (saved) window.localStorage.setItem(key, saved);
        if (blocked) {
          const fail = () => {
            throw new window.DOMException("保存禁止", "SecurityError");
          };
          window.Storage.prototype.getItem = fail;
          window.Storage.prototype.setItem = fail;
        }
      },
    });
    opened.push(dom);
    return { dom, window: dom.window, document: dom.window.document, errors };
  }
  try {
    const { window: w, document: doc, errors } = create();
    const ev = (source) => w.eval(source),
      data = JSON.parse(ev("JSON.stringify(examConfig)"));
    assert.equal(ev("state.status"), "ready");
    assert.equal(ev("createAnswerReport()"), null);
    assert.match(html, /tailwindcss v4\.2\.4/i);
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=/i);
    assert.equal(data.revision, 2);
    assert.equal(data.journals.length, 15);
    assert.equal(new Set(data.journals.map((q) => q.question)).size, 15);
    assert.equal(data.parts.flatMap((part) => part.groups).length, 10);
    assert.equal(data.final.groups.length, 12);
    assert.equal(
      data.final.groups.reduce((sum, unit) => sum + unit.points, 0),
      35,
    );
    assert.equal(
      data.final.trialBalance.reduce((sum, [, d, c]) => sum + d - c, 0),
      0,
    );
    const secondFields = data.parts.flatMap((part) =>
      part.groups.flatMap((unit) => unit.fields),
    );
    const finalFields = data.final.groups.flatMap((unit) => unit.fields);
    const fields = [...secondFields, ...finalFields];
    verifyAccounting(data);
    data.journals.forEach((q) => {
      for (const side of [q.debit, q.credit]) {
        assert.ok(side.length <= 4);
        assert.equal(
          new Set(side.map(([account]) => account)).size,
          side.length,
        );
      }
      assert.equal(
        q.debit.reduce((sum, [, value]) => sum + value, 0),
        q.credit.reduce((sum, [, value]) => sum + value, 0),
      );
    });
    doc.getElementById("start").click();
    const deadline = ev("state.deadline");
    assert.ok(deadline > Date.now() + 3590000);
    assert.deepEqual(Array.from(ev("scores()")), [0, 0, 0]);
    const ids = [...doc.querySelectorAll("[id]")].map((element) => element.id);
    assert.equal(new Set(ids).size, ids.length);
    fields.forEach((field) => {
      assert.ok(doc.getElementById(field.id), field.id);
      assert.ok(doc.getElementById(field.id).closest("table"), field.id);
    });
    data.journals.forEach((question, index) =>
      assert.doesNotMatch(
        doc.querySelector(`#journal-${index} h2`).textContent,
        new RegExp(question.topic),
      ),
    );
    assert.equal(doc.querySelectorAll('[data-answer^="j"]').length, 240);
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
    const el = set("j0d0v", "１２３４５６７");
    el.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.equal(el.value, "1,234,567");
    set("j0d0v", "０").dispatchEvent(
      new w.FocusEvent("focusout", { bubbles: true }),
    );
    assert.equal(el.value, "0");
    for (const invalid of [
      "-1",
      "1.5",
      "abc",
      "1,2",
      "9,007,199,254,740,992",
    ]) {
      set("j0d0v", invalid).dispatchEvent(
        new w.FocusEvent("focusout", { bubbles: true }),
      );
      assert.equal(el.getAttribute("aria-invalid"), "true");
    }
    set("j0d0v", "").dispatchEvent(
      new w.FocusEvent("focusout", { bubbles: true }),
    );
    assert.equal(el.value, "");
    assert.equal(el.hasAttribute("aria-invalid"), false);
    assert.equal(ev('parseAmount("")'), null);
    assert.equal(ev('parseAmount("０")'), 0);
    doc.querySelector('[data-tab="2"]').click();
    assert.equal(doc.getElementById("panel2").hidden, false);
    assert.equal(doc.getElementById("panel1").hidden, true);
    const firstAmount = secondFields.find((field) => field.type === "amount");
    set(firstAmount.id, "１２３４");
    doc.querySelector('[data-mark="0"]').checked = true;
    doc
      .querySelector('[data-mark="0"]')
      .dispatchEvent(new w.Event("change", { bubbles: true }));
    const saved = w.localStorage.getItem(key),
      resumed = create(saved);
    assert.equal(resumed.window.eval("state.deadline"), deadline);
    assert.equal(resumed.window.eval("state.tab"), 2);
    assert.equal(
      resumed.document.getElementById(firstAmount.id).value,
      "１２３４",
    );
    assert.equal(resumed.window.eval("state.marks[0]"), true);
    // 行を逆順で入力し、4科目の仕訳もDOMの4行目を使って採点する。
    ev("state.answers={}");
    data.journals.forEach((q, index) =>
      [
        ["d", q.debit],
        ["c", q.credit],
      ].forEach(([side, rows]) =>
        [...rows].reverse().forEach(([account, value], row) => {
          set(`j${index}${side}${row}a`, account);
          set(`j${index}${side}${row}v`, String(value));
        }),
      ),
    );
    for (const field of fields) {
      if (field.type === "multiple")
        for (const input of doc.querySelectorAll(
          `[data-answer="${field.id}"]`,
        )) {
          input.checked = field.answer.includes(input.value);
          input.dispatchEvent(new w.Event("change", { bubbles: true }));
        }
      else set(field.id, field.answer === null ? "" : String(field.answer));
    }
    assert.deepEqual(Array.from(ev("scores()")), [45, 20, 35]);
    const correctAnswers = JSON.parse(ev("JSON.stringify(state.answers)"));
    for (let index = 0; index < data.journals.length; index++) {
      const raw = correctAnswers[`j${index}d0v`];
      set(`j${index}d0v`, String(Number(raw) + 1));
      assert.equal(ev(`gradeJournal(journals[${index}],${index})`), false);
      set(`j${index}d0v`, raw);
    }
    // 同一側の重複、未使用行の金額、不正値を受け入れない。
    const one = data.journals.findIndex((q) => q.debit.length === 1);
    set(`j${one}d1a`, data.journals[one].debit[0][0]);
    set(`j${one}d1v`, "0");
    assert.equal(ev(`gradeJournal(journals[${one}],${one})`), false);
    set(`j${one}d1a`, "");
    set(`j${one}d1v`, "");
    for (const bad of ["", "0", "abc"]) {
      set(`j${one}d0v`, bad);
      assert.equal(ev(`gradeJournal(journals[${one}],${one})`), false);
    }
    set(`j${one}d0v`, correctAnswers[`j${one}d0v`]);
    const composite = data.final.groups.find(
        (unit) =>
          unit.fields.filter((field) => field.type !== "blank").length > 1,
      ),
      field = composite.fields.find((f) => f.type === "amount");
    set(field.id, String(field.answer + 1));
    assert.equal(ev("scores()[2]"), 35 - composite.points);
    set(field.id, String(field.answer));
    const zero = fields.find(
      (field) => field.type === "amount" && field.answer === 0,
    );
    if (zero) {
      set(zero.id, "");
      assert.equal(ev(`isCorrect(fieldsById.get('${zero.id}'))`), false);
      set(zero.id, "0");
      assert.equal(ev(`isCorrect(fieldsById.get('${zero.id}'))`), true);
    }
    const unused = fields.find((field) => field.type === "blank");
    if (unused) {
      set(unused.id, "0");
      assert.equal(ev(`isCorrect(fieldsById.get('${unused.id}'))`), false);
      set(unused.id, "");
    }
    const multi = fields.find((field) => field.type === "multiple");
    if (multi) {
      const wrong = [
        ...doc.querySelectorAll(`[data-answer="${multi.id}"]`),
      ].find((input) => !multi.answer.includes(input.value));
      wrong.checked = true;
      wrong.dispatchEvent(new w.Event("change", { bubbles: true }));
      assert.equal(ev(`isCorrect(fieldsById.get('${multi.id}'))`), false);
      wrong.checked = false;
      wrong.dispatchEvent(new w.Event("change", { bubbles: true }));
    }
    assert.deepEqual(Array.from(ev("scores()")), [45, 20, 35]);
    doc.getElementById("finish").click();
    assert.equal(doc.getElementById("confirm").open, true);
    doc.getElementById("cancelFinish").click();
    assert.equal(ev("state.status"), "running");
    doc.getElementById("finish").click();
    doc.getElementById("confirmFinish").click();
    assert.equal(ev("state.status"), "done");
    assert.equal(
      doc.querySelectorAll("[data-answer]:not(:disabled)").length,
      0,
    );
    assert.equal(doc.querySelectorAll("[data-mark]:not(:disabled)").length, 0);
    assert.equal(
      doc.getElementById("backToTop").getAttribute("href"),
      "../../../index.html",
    );
    const report = JSON.parse(ev("JSON.stringify(createAnswerReport())"));
    assert.equal(report.schemaVersion, 2);
    assert.equal(report.exam.revision, 2);
    assert.equal(report.exam.id, `boki3-2026-${number}`);
    assert.equal(report.attempt.score, 100);
    assert.equal(report.sections[0].questions.length, 15);
    assert.equal(report.sections[1].parts.length, 2);
    assert.equal(report.sections[2].questions.length, 12);
    assert.deepEqual(report.sections[2].adjustments, data.final.adjustments);
    for (const section of report.sections) {
      const questions =
        section.questions || section.parts.flatMap((part) => part.questions);
      assert.equal(
        questions.reduce((sum, q) => sum + q.score, 0),
        section.score,
      );
    }
    assert.ok(report.sections[0].questions.some((q) => q.sourceData.length));
    assert.deepEqual(
      report.sections[1].parts[0].sourceData,
      data.parts[0].tables,
    );
    const restored = create(w.localStorage.getItem(key));
    assert.equal(
      restored.window.eval("createAnswerReport().attempt.score"),
      100,
    );
    assert.ok(restored.document.getElementById("exportAnswers"));
    const before = ev(`state.answers['${firstAmount.id}']`);
    set(firstAmount.id, "999");
    assert.equal(ev(`state.answers['${firstAmount.id}']`), before);
    const amountFields = finalFields.filter((field) => field.type === "amount");
    ev(
      `state.answers[${JSON.stringify(amountFields[0].id)}]='１２３';state.answers[${JSON.stringify(amountFields[1].id)}]='';state.answers[${JSON.stringify(amountFields[2].id)}]='不正'`,
    );
    const changed = JSON.parse(ev("JSON.stringify(createAnswerReport())")),
      exportFields = changed.sections[2].questions.flatMap((q) => q.fields);
    assert.deepEqual(
      exportFields.find((f) => f.id === amountFields[0].id).userAnswer,
      { raw: "１２３", value: 123 },
    );
    assert.equal(
      exportFields.find((f) => f.id === amountFields[1].id).userAnswer.value,
      null,
    );
    assert.equal(
      exportFields.find((f) => f.id === amountFields[2].id).userAnswer.value,
      null,
    );
    let blob,
      name,
      clicked = false;
    w.URL.createObjectURL = (value) => {
      blob = value;
      return "blob:test";
    };
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () {
      clicked = true;
      name = this.download;
    };
    doc.getElementById("exportAnswers").click();
    assert.equal(clicked, true);
    assert.match(
      name,
      new RegExp(`^boki3-2026-${number}-v2-answers-.*\\.json$`),
    );
    const downloaded = await new Promise((resolve, reject) => {
      const reader = new w.FileReader();
      reader.onload = () => resolve(JSON.parse(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    assert.equal(downloaded.attempt.score, changed.attempt.score);
    const expired = JSON.parse(saved);
    expired.deadline = Date.now() - 1500;
    expired.answers = correctAnswers;
    const timeout = create(JSON.stringify(expired));
    assert.equal(timeout.window.eval("state.status"), "done");
    assert.equal(
      timeout.window.eval("createAnswerReport().attempt.elapsedSeconds"),
      3600,
    );
    assert.equal(
      timeout.window.eval("state.finishedAt===state.deadline"),
      true,
    );
    assert.equal(
      timeout.window.eval("createAnswerReport().attempt.submittedByTimeout"),
      true,
    );
    assert.equal(
      timeout.window.eval("createAnswerReport().attempt.score"),
      100,
    );
    assert.ok(timeout.document.getElementById("exportAnswers"));
    // 期限直後の入力は保存せず、入力イベントからも自動提出する。
    const late = create(saved);
    late.window.eval("state.deadline=Date.now()-1");
    const lateInput = late.document.getElementById(firstAmount.id);
    lateInput.value = "999";
    lateInput.dispatchEvent(new late.window.Event("input", { bubbles: true }));
    assert.equal(late.window.eval("state.status"), "done");
    assert.equal(late.window.eval("state.expired"), true);
    assert.equal(late.window.eval(`state.answers['${firstAmount.id}']`), "１２３４");
    const unavailable = create(null, true);
    unavailable.document.getElementById("start").click();
    assert.equal(unavailable.window.eval("state.status"), "running");
    unavailable.window.eval("finish(false)");
    assert.equal(unavailable.window.eval("state.status"), "done");
    assert.equal(
      unavailable.document.getElementById("saveWarning").hidden,
      false,
    );
    assert.ok(w.localStorage.getItem(legacyKey));
    assert.equal(w.localStorage.getItem("boki3-mock-2026-99-v2"), "他の回");
    assert.equal(
      errors.length,
      0,
      errors.map((error) => error.message).join("\n"),
    );
    console.log(
      `PASS 第${Number(number)}回: 独立検算・全問採点・表内入力・保存分離/復元・全角/不正値・複合採点・入力ロック・時間切れ・JSON`,
    );
  } finally {
    opened.forEach((dom) => dom.window.close());
  }
}
