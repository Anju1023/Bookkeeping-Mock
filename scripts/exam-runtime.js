// このファイルはビルド時に各HTMLへ埋め込み、ブラウザーから読み込まない。
const key = `boki3-mock-2026-${examConfig.number}-v${examConfig.revision}`;
const money = (value) => Number(value).toLocaleString("ja-JP");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const journals = examConfig.journals;
const secondGroups = examConfig.parts.flatMap((part) => part.groups);
const finalGroups = examConfig.final.groups;
const allFields = [...secondGroups, ...finalGroups].flatMap(
  (unit) => unit.fields,
);
const fieldsById = new Map(allFields.map((field) => [field.id, field]));
const accounts = [
  ...new Set(
    journals
      .flatMap((q) => [...q.debit, ...q.credit].map(([account]) => account))
      .concat([
        "現金過不足",
        "受取手形",
        "支払手形",
        "前払金",
        "前受金",
        "未払金",
        "未収入金",
        "買掛金",
        "売掛金",
        "仮払金",
        "仮受金",
        "租税公課",
        "支払手数料",
        "貸倒引当金繰入",
        "貸倒引当金戻入",
        "当座預金",
        "普通預金",
      ]),
  ),
].sort((a, b) => a.localeCompare(b, "ja"));
const freshState = () => ({
  status: "ready",
  deadline: null,
  finishedAt: null,
  tab: 1,
  answers: {},
  marks: {},
  expired: false,
});
let state = freshState();
let storageAvailable = true;
function parseAmount(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).normalize("NFKC").trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const number = Number(text.replace(/,/g, ""));
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (
    saved &&
    ["ready", "running", "done"].includes(saved.status) &&
    saved.answers &&
    typeof saved.answers === "object" &&
    !Array.isArray(saved.answers) &&
    saved.marks &&
    typeof saved.marks === "object" &&
    [1, 2, 3].includes(saved.tab) &&
    (saved.status === "ready" || Number.isFinite(saved.deadline))
  )
    state = { ...freshState(), ...saved };
} catch {
  storageAvailable = false;
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    storageAvailable = false;
  }
  document.getElementById("saveWarning").hidden = storageAvailable;
}
const inputClass =
  "w-full min-w-[100px] rounded-lg border border-slate-400 bg-white px-3 py-2 text-right font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100";
function amountInput(id, label) {
  return `<input type="text" id="${id}" data-answer="${id}" data-money="true" inputmode="numeric" autocomplete="off" maxlength="21" aria-label="${escapeHtml(label)}" class="${inputClass}" value="${escapeHtml(state.answers[id] ?? "")}" ${state.status === "done" ? "disabled" : ""}>`;
}
function selectInput(id, options, label) {
  return `<select id="${id}" data-answer="${id}" aria-label="${escapeHtml(label)}" class="w-full min-w-[130px] rounded-lg border border-slate-400 bg-white px-2 py-2 text-sm focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100" ${state.status === "done" ? "disabled" : ""}><option value="">選択してください</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${state.answers[id] === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`;
}
function fieldInput(field) {
  if (field.type === "select")
    return selectInput(field.id, field.options, field.label);
  if (field.type === "multiple") {
    const values = Array.isArray(state.answers[field.id])
      ? state.answers[field.id]
      : [];
    return `<fieldset id="${field.id}" class="grid gap-2 md:grid-cols-2"><legend class="sr-only">${escapeHtml(field.label)}</legend>${field.options.map((option, index) => `<label class="flex items-center gap-2 rounded border border-slate-200 p-2 text-left text-sm"><input type="checkbox" id="${field.id}-${index}" data-answer="${field.id}" data-multiple="true" value="${escapeHtml(option)}" ${values.includes(option) ? "checked" : ""} ${state.status === "done" ? "disabled" : ""}>${escapeHtml(option)}</label>`).join("")}</fieldset>`;
  }
  return amountInput(field.id, field.label);
}
function tableCell(value, table, rowIndex, columnIndex) {
  if (value === "？") {
    const id = `work-${table.id}-${rowIndex}-${columnIndex}`;
    const label = `${table.caption} ${rowIndex + 1}行目 ${table.headings[columnIndex]}（計算用・採点対象外）`;
    // 摘要は金額と分けて文字列のまま保存する。
    if (table.headings[columnIndex] === "摘要")
      return `<input type="text" id="${id}" data-answer="${id}" autocomplete="off" aria-label="${escapeHtml(label)}" class="w-full min-w-[130px] rounded-lg border border-slate-400 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100" value="${escapeHtml(state.answers[id] ?? "")}" ${state.status === "done" ? "disabled" : ""}>`;
    return amountInput(id, label);
  }
  return escapeHtml(value).replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (_, id) => {
    const field = fieldsById.get(id);
    if (!field) throw new Error(`解答欄が見つからない: ${id}`);
    return fieldInput(field);
  });
}
function renderTable(table) {
  const wide = table.headings.length >= 8;
  return `<div class="mt-5 min-w-0 max-w-full overflow-x-auto rounded-xl border ${wide ? "max-h-[70vh] overflow-auto" : ""}"><table id="${escapeHtml(table.id)}" class="w-full ${wide ? "min-w-[1500px]" : table.id === "source-trial" ? "min-w-[420px]" : "min-w-[650px]"} border-collapse text-sm"><caption class="bg-white p-4 text-left text-base font-bold">${escapeHtml(table.caption)}</caption><thead><tr class="bg-slate-100">${table.headings.map((heading, index) => `<th scope="col" class="border p-3 whitespace-nowrap ${wide ? "sticky top-0 z-10 bg-slate-100" : ""} ${wide && index === 0 ? "sticky left-0 z-10 bg-slate-100" : ""}">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row, rowIndex) => `<tr>${row.map((cell, index) => `<td class="border p-3 align-middle leading-7 ${wide && index === 0 ? "sticky left-0 z-10 bg-white" : ""} ${/^[\d,]+$/.test(String(cell)) ? "text-right font-mono tabular-nums" : ""}">${tableCell(cell, table, rowIndex, index)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function gradeJournal(question, index) {
  return [
    ["d", question.debit],
    ["c", question.credit],
  ].every(([side, expected]) => {
    const actual = [];
    for (let row = 0; row < 4; row++) {
      const account = state.answers[`j${index}${side}${row}a`] ?? "";
      const raw = state.answers[`j${index}${side}${row}v`] ?? "";
      if (account === "" && String(raw).trim() === "") continue;
      const amount = parseAmount(raw);
      if (
        typeof account !== "string" ||
        !account ||
        amount === null ||
        amount === 0
      )
        return false;
      actual.push([account, amount]);
    }
    return (
      actual.length === expected.length &&
      new Set(actual.map(([account]) => account)).size === actual.length &&
      expected.every(([account, amount]) =>
        actual.some(([name, value]) => name === account && value === amount),
      )
    );
  });
}
function isCorrect(field) {
  const value = state.answers[field.id];
  if (field.type === "select") return value === field.answer;
  if (field.type === "multiple")
    return (
      Array.isArray(value) &&
      value.length === field.answer.length &&
      new Set(value).size === value.length &&
      field.answer.every((item) => value.includes(item))
    );
  if (field.type === "blank")
    return (
      value === undefined || (typeof value === "string" && value.trim() === "")
    );
  return parseAmount(value ?? "") === field.answer;
}
const gradeGroup = (unit) => unit.fields.every(isCorrect);
function scores() {
  return [
    journals.reduce(
      (sum, question, index) => sum + (gradeJournal(question, index) ? 3 : 0),
      0,
    ),
    secondGroups.reduce(
      (sum, unit) => sum + (gradeGroup(unit) ? unit.points : 0),
      0,
    ),
    finalGroups.reduce(
      (sum, unit) => sum + (gradeGroup(unit) ? unit.points : 0),
      0,
    ),
  ];
}
function answerText(field) {
  if (field.type === "blank") return "空欄";
  if (field.type === "multiple") return field.answer.join("・");
  return field.type === "amount"
    ? `${money(field.answer)}${field.unit || "円"}`
    : field.answer;
}
function explanations(groups) {
  if (state.status !== "done") return "";
  return `<div class="mt-6 space-y-4">${groups.map((unit) => `<article class="rounded-xl border p-4"><h3 class="font-bold ${gradeGroup(unit) ? "text-teal-800" : "text-rose-700"}">${gradeGroup(unit) ? "○" : "×"} ${escapeHtml(unit.label)} · ${gradeGroup(unit) ? unit.points : 0} / ${unit.points}点</h3>${unit.fields.map((field) => `<div class="mt-3 text-sm leading-7"><p>${isCorrect(field) ? "○" : "×"} ${escapeHtml(field.label)}：<strong>${escapeHtml(answerText(field))}</strong></p><p class="text-slate-600">${escapeHtml(field.explanation)}</p></div>`).join("")}</article>`).join("")}</div>`;
}
const paragraphs = (lines) =>
  lines
    .map((line) => `<p class="mt-3 text-sm leading-8">${escapeHtml(line)}</p>`)
    .join("");
function render() {
  document.getElementById("panel1").innerHTML =
    `<p class="rounded-xl bg-teal-50 p-4 text-sm leading-7">各取引を仕訳しなさい。商品売買は三分法。特に指定がなければ消費税を考慮しない。勘定科目は共通の選択肢から選ぶ。同一側の同じ科目は1行にまとめ、未使用行は科目・金額とも空欄にする。各問3点。</p>` +
    journals
      .map(
        (question, index) =>
          `<article id="journal-${index}" class="min-w-0 rounded-2xl border bg-white p-5 md:p-6"><div class="flex items-center justify-between gap-3"><h2 class="font-bold text-teal-800">問${index + 1}</h2><label class="text-xs text-slate-500"><input type="checkbox" data-mark="${index}" ${state.marks[index] ? "checked" : ""} ${state.status === "done" ? "disabled" : ""}> あとで見直す</label></div><p class="mt-4 text-sm leading-8">${escapeHtml(question.question)}</p>${question.materials.map(renderTable).join("")}<div class="mt-4 overflow-x-auto"><table class="w-full min-w-[680px] border-separate border-spacing-2 text-sm"><thead><tr><th>借方科目</th><th>金額（円）</th><th>貸方科目</th><th>金額（円）</th></tr></thead><tbody>${Array.from({ length: 4 }, (_, row) => `<tr>${["d", "c"].map((side) => `<td>${selectInput(`j${index}${side}${row}a`, accounts, `問${index + 1} ${side === "d" ? "借方" : "貸方"}${row + 1}行目科目`)}</td><td>${amountInput(`j${index}${side}${row}v`, `問${index + 1} ${side === "d" ? "借方" : "貸方"}${row + 1}行目金額`)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${state.status === "done" ? `<div class="mt-5 border-t pt-4 text-sm leading-7"><p class="font-bold ${gradeJournal(question, index) ? "text-teal-800" : "text-rose-700"}">${gradeJournal(question, index) ? "○ 正解 3" : "× 不正解 0"} / 3点 · ${escapeHtml(question.topic)}</p><p>借方：${question.debit.map(([account, value]) => `${escapeHtml(account)} ${money(value)}`).join(" / ")}</p><p>貸方：${question.credit.map(([account, value]) => `${escapeHtml(account)} ${money(value)}`).join(" / ")}</p><p class="mt-2 text-slate-600">${escapeHtml(question.explanation)}</p></div>` : ""}</article>`,
      )
      .join("");
  document.getElementById("panel2").innerHTML = examConfig.parts
    .map(
      (part) =>
        `<article class="min-w-0 rounded-2xl border bg-white p-5 md:p-6"><h2 class="text-lg font-bold">${escapeHtml(part.title)} <span class="text-sm font-normal text-slate-500">${part.groups.reduce((sum, unit) => sum + unit.points, 0)}点</span></h2>${paragraphs(part.instructions)}${part.tables.map(renderTable).join("")}${explanations(part.groups)}</article>`,
    )
    .join("");
  const trial = examConfig.final.trialBalance;
  const total = trial.reduce((sum, row) => sum + row[1], 0);
  const sourceTable = {
    id: "source-trial",
    caption: "資料1・決算整理前残高試算表（円）",
    headings: ["借方", "勘定科目", "貸方"],
    rows: [
      ...trial.map(([account, debit, credit]) => [
        debit ? money(debit) : "—",
        account,
        credit ? money(credit) : "—",
      ]),
      [money(total), "合計", money(total)],
    ],
  };
  document.getElementById("panel3").innerHTML =
    `<div class="rounded-xl bg-teal-50 p-5">${paragraphs(examConfig.final.instructions)}</div><div class="grid items-start gap-5 xl:grid-cols-2"><article class="min-w-0 rounded-2xl border bg-white p-4">${renderTable(sourceTable)}${examConfig.final.materials.map(renderTable).join("")}</article><article class="min-w-0 rounded-2xl border bg-white p-5"><h2 class="text-lg font-bold">決算整理事項等</h2><ol class="mt-4 list-decimal space-y-4 pl-6 text-sm leading-8">${examConfig.final.adjustments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></article></div><article class="min-w-0 rounded-2xl border bg-white p-4 md:p-6"><h2 class="text-lg font-bold">答案</h2>${examConfig.final.tables.map(renderTable).join("")}${explanations(finalGroups)}</article>`;
  switchTab(state.tab, false);
}
function switchTab(tab, scroll = true) {
  state.tab = Number(tab);
  for (let index = 1; index <= 3; index++)
    document.getElementById(`panel${index}`).hidden = state.tab !== index;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = Number(button.dataset.tab) === state.tab;
    button.className = `rounded-xl px-4 py-3 font-bold ${active ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.getElementById("sectionEyebrow").textContent =
    `QUESTION 0${state.tab} / ${[45, 20, 35][state.tab - 1]}点`;
  document.getElementById("sectionTitle").textContent = [
    "第1問 仕訳",
    `第2問 ${examConfig.secondTitle}`,
    `第3問 ${examConfig.thirdTitle}`,
  ][state.tab - 1];
  updateProgress();
  save();
  if (scroll)
    document
      .getElementById("exam")
      .scrollIntoView({ behavior: "smooth", block: "start" });
}
function hasInput(field) {
  if (field.type === "blank") return true;
  const value = state.answers[field.id];
  return field.type === "multiple"
    ? Array.isArray(value) && value.length > 0
    : typeof value === "string" && value.trim() !== "";
}
function counts() {
  const answeredJournals = journals.filter((_, index) =>
    ["d", "c"].every((side) =>
      [0, 1, 2, 3].some(
        (row) =>
          Boolean(state.answers[`j${index}${side}${row}a`]) &&
          String(state.answers[`j${index}${side}${row}v`] ?? "").trim() !== "",
      ),
    ),
  ).length;
  return [
    answeredJournals,
    ...[secondGroups, finalGroups].map(
      (groups) => groups.filter((unit) => unit.fields.every(hasInput)).length,
    ),
  ];
}
function updateProgress() {
  const values = counts();
  document.getElementById("progress").textContent =
    `入力済み ${values[state.tab - 1]} / ${[15, secondGroups.length, finalGroups.length][state.tab - 1]} ${state.tab === 1 ? "問" : "採点単位"} · 見直し ${Object.values(state.marks).filter(Boolean).length}件`;
}
function editable() {
  if (state.status !== "running") return false;
  if (Date.now() >= state.deadline) {
    finish(true);
    return false;
  }
  return true;
}
function formatInput(element) {
  if (!editable()) return;
  const raw = element.value;
  element.setCustomValidity("");
  element.removeAttribute("aria-invalid");
  if (raw.trim() !== "") {
    const value = parseAmount(raw);
    if (value === null) {
      element.setCustomValidity("0以上の整数を入力してね。");
      element.setAttribute("aria-invalid", "true");
      element.reportValidity();
    } else element.value = money(value);
  }
  state.answers[element.dataset.answer] = element.value;
  save();
  updateProgress();
}
document.addEventListener("input", (event) => {
  const element = event.target;
  if (!element.dataset.answer || element.dataset.multiple || !editable())
    return;
  element.setCustomValidity("");
  element.removeAttribute("aria-invalid");
  state.answers[element.dataset.answer] = element.value;
  save();
  updateProgress();
});
document.addEventListener("change", (event) => {
  const element = event.target;
  if (
    (!element.dataset.answer && element.dataset.mark === undefined) ||
    !editable()
  )
    return;
  if (element.dataset.mark !== undefined)
    state.marks[element.dataset.mark] = element.checked;
  else if (element.dataset.multiple)
    state.answers[element.dataset.answer] = [
      ...document.querySelectorAll(
        `[data-answer="${element.dataset.answer}"]:checked`,
      ),
    ].map((input) => input.value);
  else state.answers[element.dataset.answer] = element.value;
  save();
  updateProgress();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.isComposing &&
    event.target.dataset.money
  ) {
    event.preventDefault();
    formatInput(event.target);
  }
});
document.addEventListener("focusout", (event) => {
  if (event.target.dataset.money) formatInput(event.target);
});
document
  .querySelectorAll("[data-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => switchTab(button.dataset.tab)),
  );
function showExam() {
  document.getElementById("intro").hidden = true;
  document.getElementById("exam").hidden = false;
  document.getElementById("nav").hidden = false;
  render();
}
function tick() {
  if (state.status !== "running") return;
  const remaining = Math.max(
    0,
    Math.ceil((state.deadline - Date.now()) / 1000),
  );
  document.getElementById("timer").textContent =
    `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  document
    .getElementById("timer")
    .classList.toggle("text-rose-600", remaining <= 300);
  if (!remaining) finish(true);
}
document.getElementById("start").addEventListener("click", () => {
  if (state.status !== "ready") return;
  state.status = "running";
  state.deadline = Date.now() + 3600000;
  save();
  showExam();
  tick();
});
document.getElementById("finish").addEventListener("click", () => {
  if (state.status === "done") {
    if (
      window.confirm(
        "得点履歴を残して解答をリセットし、同じ問題をもう一度解く？",
      )
    ) {
      state = freshState();
      save();
      renderHistory();
      document.getElementById("result").hidden = true;
      document.getElementById("exam").hidden = true;
      document.getElementById("nav").hidden = true;
      document.getElementById("intro").hidden = false;
      document.getElementById("finish").textContent = "解答を提出する";
      document.getElementById("timer").textContent = "60:00";
      window.scrollTo({ top: 0 });
    }
    return;
  }
  if (!editable()) return;
  const values = counts();
  document.getElementById("confirmText").textContent =
    `入力済みは第1問${values[0]}/15問、第2問${values[1]}/${secondGroups.length}採点単位、第3問${values[2]}/${finalGroups.length}採点単位。未解答は不正解となり、提出後は変更できないよ。`;
  document.getElementById("confirm").showModal();
});
document
  .getElementById("cancelFinish")
  .addEventListener("click", () => document.getElementById("confirm").close());
document
  .getElementById("confirmFinish")
  .addEventListener("click", () => finish(Date.now() >= state.deadline));
function finish(expired) {
  if (state.status !== "running") return;
  state.status = "done";
  state.expired = Boolean(expired);
  state.finishedAt = expired ? state.deadline : Date.now();
  save();
  document.getElementById("confirm").close();
  render();
  showResult();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function userAnswer(field) {
  const raw = state.answers[field.id] ?? (field.type === "multiple" ? [] : "");
  return {
    raw,
    value:
      field.type === "select"
        ? raw || null
        : field.type === "multiple"
          ? Array.isArray(raw)
            ? [...raw]
            : []
          : parseAmount(raw),
  };
}
function fieldReport(field) {
  return {
    id: field.id,
    question: field.label,
    answerType: field.type,
    unit: field.unit ?? null,
    choices: field.options ?? null,
    userAnswer: userAnswer(field),
    correctAnswer: field.answer,
    correct: isCorrect(field),
    explanation: field.explanation,
  };
}
function groupReport(unit) {
  return {
    id: unit.id,
    question: unit.label,
    score: gradeGroup(unit) ? unit.points : 0,
    maxScore: unit.points,
    correct: gradeGroup(unit),
    gradingRule: "この採点単位内の全欄が正解の場合に加点",
    fields: unit.fields.map(fieldReport),
  };
}
function createAnswerReport() {
  if (state.status !== "done") return null;
  const sectionScores = scores();
  return {
    schemaVersion: 2,
    reportType: "boki3-answer-review",
    calculationNotes: Object.entries(state.answers)
      .filter(([id]) => id.startsWith("work-"))
      .map(([id, raw]) => ({
        id,
        raw,
        value: parseAmount(raw),
        graded: false,
      })),
    exportedAt: new Date().toISOString(),
    exam: {
      id: `boki3-2026-${examConfig.number}`,
      revision: examConfig.revision,
      title: `日商簿記3級 ${examConfig.title}`,
      fiscalYear: 2026,
      applicableUntil: "2027-03-31",
      durationSeconds: 3600,
      currency: "JPY",
      official: false,
    },
    attempt: {
      status: "submitted",
      startedAt: new Date(state.deadline - 3600000).toISOString(),
      finishedAt: new Date(state.finishedAt ?? state.deadline).toISOString(),
      elapsedSeconds: Math.max(
        0,
        Math.min(
          3600,
          Math.round(
            ((state.finishedAt ?? state.deadline) - state.deadline + 3600000) /
              1000,
          ),
        ),
      ),
      submittedByTimeout: Boolean(state.expired),
      score: sectionScores.reduce((sum, score) => sum + score, 0),
      maxScore: 100,
      passingScore: 70,
    },
    reviewGuide:
      "あんじゅの解答と正解を比較して日本語で復習を手伝ってね。誤答理由は入力だけから断定しないこと。表の{{id}}は同じidを持つ解答欄を表す。金額のrawは入力文字列、valueは数値で空欄・不正値はnull。blank型の正解nullは空欄指定。multiple型は全選択肢の組合せで判定する。採点はこの非公式模試独自。",
    sections: [
      {
        number: 1,
        title: "仕訳",
        score: sectionScores[0],
        maxScore: 45,
        instructions:
          "三分法。指定がなければ消費税を考慮しない。各問完全正解3点、行順自由・同一側同一科目重複不可。",
        choices: accounts,
        questions: journals.map((question, index) => ({
          id: `j${index}`,
          number: index + 1,
          topic: question.topic,
          question: question.question,
          sourceData: question.materials,
          markedForReview: Boolean(state.marks[index]),
          userAnswer: Object.fromEntries(
            [
              ["debit", "d"],
              ["credit", "c"],
            ].map(([name, side]) => [
              name,
              Array.from({ length: 4 }, (_, row) => ({
                account: state.answers[`j${index}${side}${row}a`] || null,
                amountRaw: state.answers[`j${index}${side}${row}v`] ?? "",
                amount: parseAmount(
                  state.answers[`j${index}${side}${row}v`] ?? "",
                ),
              })),
            ]),
          ),
          correctAnswer: {
            debit: question.debit.map(([account, amount]) => ({
              account,
              amount,
            })),
            credit: question.credit.map(([account, amount]) => ({
              account,
              amount,
            })),
          },
          correct: gradeJournal(question, index),
          score: gradeJournal(question, index) ? 3 : 0,
          maxScore: 3,
          explanation: question.explanation,
        })),
      },
      {
        number: 2,
        title: examConfig.secondTitle,
        score: sectionScores[1],
        maxScore: 20,
        parts: examConfig.parts.map((part) => ({
          title: part.title,
          instructions: part.instructions,
          sourceData: part.tables,
          questions: part.groups.map(groupReport),
        })),
      },
      {
        number: 3,
        title: examConfig.thirdTitle,
        score: sectionScores[2],
        maxScore: 35,
        instructions: examConfig.final.instructions,
        trialBalance: examConfig.final.trialBalance.map(
          ([account, debit, credit]) => ({ account, debit, credit }),
        ),
        materials: examConfig.final.materials,
        adjustments: examConfig.final.adjustments,
        answerTables: examConfig.final.tables,
        questions: finalGroups.map(groupReport),
      },
    ],
  };
}
function downloadAnswerReport() {
  const report = createAnswerReport();
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `${report.exam.id}-v${report.exam.revision}-answers-${report.attempt.finishedAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
// 履歴は解答の保存とは分け、再受験で上書きしない。
const historyKey = `${key}-history-v1`;
let historySaved = true;
function readHistory() {
  try {
    const records = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (!Array.isArray(records)) return [];
    return records.filter(
      (record) =>
        record &&
        typeof record.id === "string" &&
        Number.isFinite(record.finishedAt) &&
        Number.isFinite(record.score) &&
        record.score >= 0 &&
        record.score <= 100 &&
        Array.isArray(record.sections) &&
        record.sections.length === 3 &&
        record.sections.every(
          (score, index) =>
            Number.isFinite(score) &&
            score >= 0 &&
            score <= [45, 20, 35][index],
        ) &&
        record.sections.reduce((sum, score) => sum + score, 0) === record.score,
    );
  } catch {
    return [];
  }
}
function recordResult() {
  const sections = scores();
  const record = {
    id: `${state.deadline}`,
    finishedAt: state.finishedAt ?? state.deadline,
    score: sections.reduce((sum, score) => sum + score, 0),
    sections,
  };
  const records = readHistory().filter((item) => item.id !== record.id);
  records.push(record);
  records.sort((a, b) => b.finishedAt - a.finishedAt);
  try {
    localStorage.setItem(historyKey, JSON.stringify(records));
    historySaved = true;
  } catch {
    historySaved = false;
  }
  renderHistory(records);
}
function renderHistory(records = readHistory()) {
  const previous =
    state.status === "done"
      ? records.filter((record) => record.id !== `${state.deadline}`)[0]
      : null;
  const difference = previous
    ? scores().reduce((sum, score) => sum + score, 0) - previous.score
    : null;
  document.getElementById("history").innerHTML =
    `<h2 class="text-xl font-bold">この模試の受験履歴</h2>
    <p class="mt-3 text-sm leading-7 text-slate-500">同じブラウザに点数と受験日時を自動保存するよ。再受験しても履歴は残るよ。ブラウザのデータ削除で消えるので、大切な解答はJSONでも保存してね。別の端末・ブラウザには引き継がれないよ。</p>
    ${historySaved ? "" : '<p role="alert" class="mt-3 font-bold text-amber-700">今回の履歴を保存できなかったよ。解答をJSONで保存してね。</p>'}
    ${previous ? `<p class="mt-3 font-bold text-teal-700">前回 ${previous.score}点 → 今回 ${previous.score + difference}点（${difference > 0 ? "+" : ""}${difference}点）</p>` : ""}
    ${records.length ? `<div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><caption class="sr-only">${escapeHtml(examConfig.title)}の得点履歴</caption><thead><tr>${["受験日時", "合計", "第1問", "第2問", "第3問"].map((label) => `<th scope="col" class="whitespace-nowrap border-b p-3">${label}</th>`).join("")}</tr></thead><tbody>${records.map((record) => `<tr><th scope="row" class="whitespace-nowrap border-b p-3 font-normal">${escapeHtml(new Date(record.finishedAt).toLocaleString("ja-JP"))}</th>${[record.score, ...record.sections].map((score) => `<td class="border-b p-3">${score}点</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="mt-4 text-sm">まだ受験履歴はないよ。採点するとここに記録されるよ。</p>'}`;
}
function weaknessSummary() {
  const topics = new Map();
  function add(topic, earned, possible, target) {
    const item = topics.get(topic) || { topic, earned: 0, possible: 0, target };
    item.earned += earned;
    item.possible += possible;
    topics.set(topic, item);
  }
  journals.forEach((question, index) =>
    add(`仕訳：${question.topic}`, gradeJournal(question, index) ? 3 : 0, 3, 1),
  );
  examConfig.parts.forEach((part) =>
    part.groups.forEach((unit) =>
      add(part.title, gradeGroup(unit) ? unit.points : 0, unit.points, 2),
    ),
  );
  finalGroups.forEach((unit) =>
    add(
      `決算：${unit.label}`,
      gradeGroup(unit) ? unit.points : 0,
      unit.points,
      3,
    ),
  );
  return [...topics.values()].sort(
    (a, b) =>
      a.earned / a.possible - b.earned / b.possible ||
      b.possible - b.earned - (a.possible - a.earned),
  );
}
function renderWeakness() {
  const topics = weaknessSummary();
  const missed = topics.filter((topic) => topic.earned < topic.possible);
  return `<section class="mt-6 rounded-xl bg-slate-50 p-5" aria-label="苦手分野の振り返り"><h3 class="text-xl font-bold">苦手分野の振り返り</h3><p class="mt-3 text-sm leading-7">今回の得点率が低い分野から並べているよ。未解答も失点に含むため、苦手と断定せず復習の目安にしてね。複数欄の問題は採点単位ごとの判定だよ。</p>${missed.length ? `<ul class="mt-4 space-y-3">${missed.map((item) => `<li class="rounded-lg border bg-white p-3"><button type="button" data-review-section="${item.target}" class="text-left font-bold text-teal-800 underline">${escapeHtml(item.topic)}</button><p class="mt-2 text-sm">${item.earned} / ${item.possible}点・得点率 ${Math.round((item.earned / item.possible) * 100)}%</p><p class="mt-2 text-sm text-slate-500">第${item.target}問の解答と解説を見比べよう。</p></li>`).join("")}</ul>` : '<p class="mt-4 font-bold text-teal-700">今回は全分野で満点！ 日をあけてもう一度解いてみよう。</p>'}<a href="../../../study/index.html" class="mt-4 inline-block font-bold text-teal-800 underline">勘定科目と仕訳のルール帳で復習する</a></section>`;
}
function showResult() {
  const values = scores(),
    total = values.reduce((sum, score) => sum + score, 0),
    elapsed = Math.max(
      0,
      Math.min(
        3600,
        Math.round(
          ((state.finishedAt ?? state.deadline) - state.deadline + 3600000) /
            1000,
        ),
      ),
    );
  const result = document.getElementById("result");
  result.hidden = false;
  result.innerHTML = `<p class="text-sm font-bold text-teal-700">YOUR RESULT ${state.expired ? "· 時間終了・自動提出" : ""}</p><div class="mt-4 flex flex-wrap items-center justify-between gap-5"><div><h2 class="text-4xl font-bold">${total}<span class="text-lg font-normal text-slate-500"> / 100点</span></h2><p class="mt-3 font-bold ${total >= 70 ? "text-teal-700" : "text-amber-700"}">${total >= 70 ? "合格ラインに到達！" : `合格ラインまであと${70 - total}点`}</p></div><p class="text-sm text-slate-500">解答時間 ${Math.floor(elapsed / 60)}分${elapsed % 60}秒<br>この判定は本模試の目安だよ。</p></div><div class="mt-6 grid gap-3 md:grid-cols-3">${values.map((value, index) => `<div class="rounded-xl bg-slate-50 p-4"><p class="text-sm text-slate-500">第${index + 1}問</p><p class="mt-1 text-xl font-bold">${value} / ${[45, 20, 35][index]}点</p><progress class="mt-2 w-full accent-teal-700" value="${value}" max="${[45, 20, 35][index]}" aria-label="第${index + 1}問の得点"></progress></div>`).join("")}</div><p class="mt-5 text-sm leading-7">大問を切り替えると、解答と正解・全問解説を見比べられるよ。複数欄の採点単位は、その全欄が合っていれば加点するよ。</p><div class="mt-6 flex flex-wrap gap-3 border-t pt-5"><button id="exportAnswers" class="rounded-xl bg-teal-800 px-5 py-3 font-bold text-white hover:bg-teal-700">解答をJSONで保存</button><a id="backToTop" href="../../../index.html" class="rounded-xl border border-teal-800 px-5 py-3 font-bold text-teal-800">模試一覧へ戻る</a></div><p class="mt-3 text-sm leading-7 text-slate-500">JSONには問題・資料・解答・正解・採点結果が入るよ。自分の端末へ保存して復習に使ってね。</p>`;
  result.insertAdjacentHTML("beforeend", renderWeakness());
  result.querySelectorAll("[data-review-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = Number(button.dataset.reviewSection);
      save();
      render();
      document.getElementById("exam").scrollIntoView({ behavior: "smooth" });
    });
  });
  recordResult();
  document
    .getElementById("exportAnswers")
    .addEventListener("click", downloadAnswerReport);
  document.getElementById("finish").textContent = "同じ問題でもう一度";
  document.getElementById("timer").textContent = "終了";
}
renderHistory();
document.getElementById("saveWarning").hidden = storageAvailable;
if (!storageAvailable)
  document.getElementById("storageNote").textContent =
    "保存が使えないため、受験中は画面を閉じないでね。";
if (state.status !== "ready") {
  showExam();
  if (state.status === "done") showResult();
  else tick();
}
setInterval(tick, 500);
