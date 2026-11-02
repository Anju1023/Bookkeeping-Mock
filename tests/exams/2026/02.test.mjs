import assert from "node:assert/strict";
import { verifyExam } from "../../helpers/mock-exam.mjs";
import { closeAccounts } from "../../helpers/accounting.mjs";

await verifyExam("02", (data) => {
  const opening = {
    現金: 245000,
    普通預金: 670000,
    売掛金: 620000,
    電子記録債権: 280000,
    繰越商品: 340000,
    定期預金: 600000,
    備品: 1500000,
    貯蔵品: 18000,
    仮受金: -190000,
    貸倒引当金: -27000,
    備品減価償却累計額: -690000,
    資本金: -1800000,
    繰越利益剰余金: -726000,
    買掛金: -460000,
    借入金: -700000,
    売上: -3600000,
    受取家賃: -420000,
    仕入: 2400000,
    給料: 920000,
    支払家賃: 360000,
    租税公課: 32000,
    通信費: 72000,
    支払利息: 6000,
    その他の費用: 550000,
  };
  assert.deepEqual(
    Object.fromEntries(
      data.final.trialBalance.map(([account, d, c]) => [account, d - c]),
    ),
    opening,
  );
  const ar = 620000 - 46000 - 60000,
    electronic = 280000 - 94000,
    allowance = (ar + electronic) * 0.03,
    remainingAllowance = 27000 - 26000;
  const entries = [
    [
      [
        ["貸倒引当金", 26000],
        ["貸倒損失", 20000],
      ],
      [["売掛金", 46000]],
    ],
    [[["普通預金", 94000]], [["電子記録債権", 94000]]],
    [
      [["仮受金", 90000]],
      [
        ["売掛金", 60000],
        ["前受金", 30000],
      ],
    ],
    [
      [["貸倒引当金繰入", allowance - remainingAllowance]],
      [["貸倒引当金", allowance - remainingAllowance]],
    ],
    [[["仕入", 340000]], [["繰越商品", 340000]]],
    [[["繰越商品", 270000]], [["仕入", 270000]]],
    [
      [
        ["仮受金", 100000],
        ["備品減価償却累計額", 180000],
        ["固定資産売却損", 300000 - 180000 - 100000],
      ],
      [["備品", 300000]],
    ],
    [[["減価償却費", 1200000 / 5]], [["備品減価償却累計額", 1200000 / 5]]],
    [[["通信費", 18000]], [["貯蔵品", 18000]]],
    [[["貯蔵品", 7000]], [["通信費", 7000]]],
    [[["受取家賃", (240000 * 9) / 12]], [["前受家賃", (240000 * 9) / 12]]],
    [
      [["未収利息", (600000 * 0.0365 * 168) / 365]],
      [["受取利息", (600000 * 0.0365 * 168) / 365]],
    ],
    [
      [["支払利息", (700000 * 0.03 * 2) / 12]],
      [["未払利息", (700000 * 0.03 * 2) / 12]],
    ],
    [[["法人税等", 6000]], [["未払法人税等", 6000]]],
  ];
  const result = closeAccounts(
    opening,
    entries,
    ["売上", "受取家賃", "受取利息"],
    [
      "仕入",
      "給料",
      "支払家賃",
      "租税公課",
      "通信費",
      "支払利息",
      "その他の費用",
      "貸倒損失",
      "貸倒引当金繰入",
      "固定資産売却損",
      "減価償却費",
      "法人税等",
    ],
  );
  assert.equal(result.profit, -880420);
  assert.equal(result.assets, 3025080);
  assert.equal(data.checks.trialTotal, 8613000);
  assert.equal(data.checks.profit, result.profit);
  assert.equal(data.checks.balanceSheetTotal, result.assets);
  const b = (account) => Math.abs(result.balances.get(account) || 0);
  const expected = {
    f0v: b("普通預金"),
    f1a: b("売掛金"),
    f1b: b("電子記録債権"),
    f2a: b("貸倒引当金"),
    f2b: b("貸倒引当金繰入"),
    f3a: b("繰越商品"),
    f3b: b("仕入"),
    f4a: b("備品"),
    f4b: b("備品減価償却累計額"),
    f5v: b("仮受金"),
    f6a: b("受取家賃"),
    f6b: b("前受家賃"),
    f7a: b("貯蔵品"),
    f7b: b("通信費"),
    f8a: b("未収利息"),
    f8b: b("受取利息"),
    f9a: b("未払利息"),
    f9b: b("支払利息"),
    f10a: b("貸倒損失"),
    f10b: b("固定資産売却損"),
    f10c: b("減価償却費"),
    f11a: "当期純損失",
    f11v: -result.profit,
  };
  for (const field of data.final.groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, expected[field.id], field.id);
  const annual = 240000 / 5,
    initial = (annual * 4) / 12,
    openingAccum = initial + annual,
    closingAccum = openingAccum + annual,
    saleDep = ((720000 / 8) * 6) / 12;
  const assets = {
    s0v: initial,
    s1v: openingAccum,
    s2a: closingAccum,
    s2b: 240000 - closingAccum,
    s3v: saleDep,
    s4a: "固定資産売却損",
    s4v: 720000 - 360000 - saleDep - 280000,
  };
  for (const field of data.parts[0].groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, assets[field.id]);
  const firstAverage = (60 * 800 + 90 * 980 + 1800) / 150,
    firstCost = firstAverage * 100,
    returned = firstAverage * 10;
  const nextAverage =
      ((150 - 100 + 10) * firstAverage + 40 * 1100 + 2000) / 100,
    lastCost = nextAverage * 70;
  const goods = {
    s5v: firstCost,
    s6v: returned,
    s7v: nextAverage,
    s8v: lastCost,
    s9v: (100 - 10 + 70) * 1500 - (firstCost - returned + lastCost),
  };
  assert.equal(goods.s9v, 86360);
  assert.equal(30 * nextAverage, 30360);
  for (const field of data.parts[1].groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, goods[field.id]);
  assert.deepEqual(data.journals[0].debit, [
    ["普通預金", 154000 - 660],
    ["支払手数料", 660],
  ]);
  assert.deepEqual(data.journals[4].credit, [
    ["当座預金", 92000],
    ["当座借越", 145000 - 92000],
  ]);
  assert.deepEqual(data.journals[9].debit, [["減価償却費", 69600 - 5300 * 11]]);
  assert.deepEqual(data.journals[14].debit, [
    ["繰越利益剰余金", 4185000 - 4042000],
  ]);
});
