import assert from "node:assert/strict";
import { verifyExam } from "../../helpers/mock-exam.mjs";
import { closeAccounts } from "../../helpers/accounting.mjs";

await verifyExam("03", (data) => {
  const opening = {
    現金: 354000,
    当座預金: 468000,
    定期預金: 900000,
    売掛金: 780000,
    電子記録債権: 220000,
    繰越商品: 180000,
    仮払金: 90000,
    仮払消費税: 150000,
    建物: 3000000,
    備品: 840000,
    買掛金: -580000,
    電子記録債務: -260000,
    借入金: -1200000,
    仮受金: -76000,
    仮受消費税: -330000,
    貸倒引当金: -20000,
    建物減価償却累計額: -810000,
    備品減価償却累計額: -336000,
    資本金: -3000000,
    繰越利益剰余金: -13000,
    売上: -5100000,
    受取手数料: -372000,
    仕入: 3300000,
    給料: 1020000,
    保険料: 96000,
    支払家賃: 600000,
    支払利息: 15000,
    通信費: 84000,
  };
  assert.deepEqual(
    Object.fromEntries(
      data.final.trialBalance.map(([account, d, c]) => [account, d - c]),
    ),
    opening,
  );
  const equipment = 360000 + 12000,
    allowance = (780000 - 52000 + 220000 - 26000) * 0.025,
    stock = 80 * 1200 + 70 * 1600;
  const buildingDep = (3000000 * 0.9) / 30,
    equipmentDep = 840000 / 7 + ((equipment / 5) * 9) / 12,
    depositInterest = (900000 * 0.0365 * 150) / 365,
    loanInterest = (1200000 * 0.024 * 7) / 12;
  const entries = [
    [
      [["仮受金", 76000]],
      [
        ["売掛金", 52000],
        ["前受金", 24000],
      ],
    ],
    [
      [["備品", equipment]],
      [
        ["仮払金", 90000],
        ["未払金", equipment - 90000],
      ],
    ],
    [[["当座預金", 26000]], [["電子記録債権", 26000]]],
    [
      [["貸倒引当金繰入", allowance - 20000]],
      [["貸倒引当金", allowance - 20000]],
    ],
    [[["仕入", 180000]], [["繰越商品", 180000]]],
    [[["繰越商品", stock]], [["仕入", stock]]],
    [
      [["減価償却費", buildingDep + equipmentDep]],
      [
        ["建物減価償却累計額", buildingDep],
        ["備品減価償却累計額", equipmentDep],
      ],
    ],
    [[["未収利息", depositInterest]], [["受取利息", depositInterest]]],
    [[["前払保険料", (96000 * 7) / 12]], [["保険料", (96000 * 7) / 12]]],
    [[["受取手数料", (180000 * 2) / 6]], [["前受手数料", (180000 * 2) / 6]]],
    [[["支払利息", loanInterest]], [["未払利息", loanInterest]]],
    [[["法人税等", 90000]], [["未払法人税等", 90000]]],
    [
      [["仮受消費税", 330000]],
      [
        ["仮払消費税", 150000],
        ["未払消費税", 180000],
      ],
    ],
    [
      [
        ["通信費", 2400],
        ["雑損", 354000 - 350800 - 2400],
      ],
      [["現金", 354000 - 350800]],
    ],
  ];
  const result = closeAccounts(
    opening,
    entries,
    ["売上", "受取手数料", "受取利息"],
    [
      "仕入",
      "給料",
      "保険料",
      "支払家賃",
      "支払利息",
      "通信費",
      "貸倒引当金繰入",
      "減価償却費",
      "法人税等",
      "雑損",
    ],
  );
  assert.equal(result.profit, 15650);
  assert.equal(data.checks.trialTotal, 12097000);
  assert.equal(data.checks.profit, result.profit);
  assert.equal(data.checks.balanceSheetTotal, result.assets);
  const mappings = {
    f0a: ["現金", "d"],
    f0b: ["当座預金", "d"],
    f1a: ["売掛金", "d"],
    f1b: ["電子記録債権", "d"],
    f2a: ["備品", "d"],
    f2b: ["未払金", "c"],
    f3a: ["貸倒引当金", "c"],
    f3b: ["貸倒引当金繰入", "d"],
    f4a: ["繰越商品", "d"],
    f4b: ["仕入", "d"],
    f5a: ["減価償却費", "d"],
    f5b: ["建物減価償却累計額", "c"],
    f5c: ["備品減価償却累計額", "c"],
    f6a: ["未収利息", "d"],
    f6b: ["受取利息", "c"],
    f7a: ["前払保険料", "d"],
    f7b: ["保険料", "d"],
    f8a: ["前受手数料", "c"],
    f8b: ["受取手数料", "c"],
    f9a: ["未払利息", "c"],
    f9b: ["支払利息", "d"],
    f10a: ["未払消費税", "c"],
    f10b: ["未払法人税等", "c"],
  };
  const expected = {
    f11a: "当期純利益",
    f11pd: result.profit,
    f11pc: null,
    f11bd: null,
    f11bc: result.profit,
  };
  for (const [id, [account, side]] of Object.entries(mappings))
    for (const entrySide of ["d", "c"])
      expected[id + entrySide] =
        entrySide === side ? Math.abs(result.balances.get(account)) : null;
  for (const field of data.final.groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, expected[field.id], field.id);
  assert.equal(
    (144000 * 2) / 6 + 144000 + 180000,
    372000,
    "手数料残高には期首再振替を含む",
  );
  const reconstruction = {
    s0a: "仕入",
    s0v: 24000 + 56000,
    s1a: "売上",
    s1v: 18000 + 42000,
    s2a: "買掛金",
    s2v: 35000,
    s3a: "売掛金",
    s3v: 63000,
    s4v: 148000 + 92000 + 42000 - 63000,
  };
  assert.equal(
    56000 + 18000 + 63000 - 24000 - 35000,
    78000,
    "現金元帳の貸借一致",
  );
  assert.equal(96000 + 56000 - 35000, 117000, "買掛金元帳の貸借一致");
  for (const field of data.parts[0].groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, reconstruction[field.id]);
  const voucherEntries = [
    [[["現金", 48000]], [["売掛金A", 48000]]],
    [[["現金", 32000]], [["売上", 32000]]],
    [[["現金", 50000]], [["当座預金", 50000]]],
    [[["買掛金", 36000]], [["現金", 36000]]],
    [[["消耗品費", 4800]], [["現金", 4800]]],
    [[["当座預金", 25000]], [["現金", 25000]]],
    [[["売掛金A", 72000]], [["売上", 72000]]],
    [[["仕入", 84000]], [["買掛金", 84000]]],
    [[["電子記録債権", 45000]], [["売掛金B", 45000]]],
  ];
  const debits = {},
    credits = {};
  for (const [d, c] of voucherEntries) {
    for (const [account, value] of d)
      debits[account] = (debits[account] || 0) + value;
    for (const [account, value] of c)
      credits[account] = (credits[account] || 0) + value;
  }
  assert.equal(
    Object.values(debits).reduce((sum, value) => sum + value, 0),
    396800,
  );
  assert.equal(
    Object.values(credits).reduce((sum, value) => sum + value, 0),
    396800,
  );
  const vouchers = {
    s5a: debits.現金,
    s5b: credits.現金,
    s6v: credits.売掛金A + credits.売掛金B,
    s7v: 98000 + credits.買掛金 - debits.買掛金,
    s8v: 65000 + debits.売掛金A - credits.売掛金A,
    s9a: "仕訳日計表",
    s9b: "入金伝票",
  };
  for (const field of data.parts[1].groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, vouchers[field.id]);
  assert.equal(data.journals[3].debit.length, 4);
  assert.equal(data.journals[4].credit.length, 4);
  assert.equal(data.journals[8].debit.length, 4);
  assert.deepEqual(data.journals[8].debit, [
    ["現金", 110000],
    ["備品減価償却累計額", 151200],
    ["減価償却費", ((302400 / 6) * 3) / 12],
    ["固定資産売却損", 302400 - 151200 - ((302400 / 6) * 3) / 12 - 110000],
  ]);
  assert.deepEqual(data.journals[12].debit, [["未払消費税", 176000]]);
  console.log(`第3回貸借対照表の独立集計: ${result.assets}円`);
});
