import assert from "node:assert/strict";
import { verifyExam } from "../../helpers/mock-exam.mjs";
import { closeAccounts } from "../../helpers/accounting.mjs";

await verifyExam("01", (data) => {
  const opening = {
    現金: 188000,
    普通預金: 1260000,
    売掛金: 840000,
    繰越商品: 260000,
    仮払金: 70000,
    仮払法人税等: 60000,
    仮払消費税: 320000,
    備品: 960000,
    建物: 2400000,
    買掛金: -620000,
    借入金: -900000,
    仮受金: -45000,
    仮受消費税: -540000,
    貸倒引当金: -18000,
    備品減価償却累計額: -240000,
    建物減価償却累計額: -720000,
    資本金: -2000000,
    繰越利益剰余金: -153000,
    売上: -7200000,
    仕入: 4200000,
    給料: 1140000,
    支払家賃: 480000,
    保険料: 144000,
    支払利息: 18000,
    通信費: 96000,
  };
  assert.deepEqual(
    Object.fromEntries(
      data.final.trialBalance.map(([account, d, c]) => [account, d - c]),
    ),
    opening,
  );
  const ar = 840000 - 92600 - 30000,
    allowance = ar * 0.02,
    stock = 200 * 900 + 100 * 1300,
    newAsset = 225000 + 15000;
  const oldDep = 960000 / 8,
    newDep = ((newAsset / 8) * 4) / 12,
    buildingDep = (2400000 * 0.9) / 30,
    interest = (900000 * 36 * 5) / (1000 * 12);
  const entries = [
    [
      [
        ["普通預金", 92600 - 800],
        ["支払手数料", 800],
      ],
      [["売掛金", 92600]],
    ],
    [
      [["仮受金", 45000]],
      [
        ["売掛金", 30000],
        ["前受金", 15000],
      ],
    ],
    [
      [["備品", newAsset]],
      [
        ["仮払金", 70000],
        ["未払金", newAsset - 70000],
      ],
    ],
    [
      [["貸倒引当金", 18000 - allowance]],
      [["貸倒引当金戻入", 18000 - allowance]],
    ],
    [[["仕入", 260000]], [["繰越商品", 260000]]],
    [[["繰越商品", stock]], [["仕入", stock]]],
    [
      [["減価償却費", oldDep + newDep + buildingDep]],
      [
        ["備品減価償却累計額", oldDep + newDep],
        ["建物減価償却累計額", buildingDep],
      ],
    ],
    [[["前払保険料", (144000 * 3) / 12]], [["保険料", (144000 * 3) / 12]]],
    [[["支払利息", interest]], [["未払利息", interest]]],
    [[["貯蔵品", 6000]], [["通信費", 6000]]],
    [
      [["法人税等", 180000]],
      [
        ["仮払法人税等", 60000],
        ["未払法人税等", 120000],
      ],
    ],
    [
      [["仮受消費税", 540000]],
      [
        ["仮払消費税", 320000],
        ["未払消費税", 220000],
      ],
    ],
    [[["雑損", 188000 - 185700]], [["現金", 188000 - 185700]]],
  ];
  const result = closeAccounts(
    opening,
    entries,
    ["売上", "貸倒引当金戻入"],
    [
      "仕入",
      "給料",
      "支払家賃",
      "保険料",
      "支払利息",
      "通信費",
      "支払手数料",
      "減価償却費",
      "法人税等",
      "雑損",
    ],
  );
  assert.equal(result.profit, 819052);
  assert.equal(result.assets, 5030552);
  assert.equal(data.checks.trialTotal, 12436000);
  assert.equal(data.checks.profit, result.profit);
  assert.equal(data.checks.balanceSheetTotal, result.assets);
  const b = (account) => Math.abs(result.balances.get(account) || 0);
  const expected = {
    f0v: b("現金"),
    f1v: b("普通預金"),
    f2a: b("売掛金"),
    f2b: b("貸倒引当金"),
    f2c: b("売掛金") - b("貸倒引当金"),
    f3a: b("備品"),
    f3b: b("備品減価償却累計額"),
    f3c: b("備品") - b("備品減価償却累計額"),
    f4v: b("前払保険料"),
    f5a: b("未払金"),
    f5b: b("前受金"),
    f6v: b("未払利息"),
    f7a: b("未払消費税"),
    f7b: b("未払法人税等"),
    f8v: b("仕入"),
    f9v: b("減価償却費"),
    f10a: "貸倒引当金戻入",
    f10v: b("貸倒引当金戻入"),
    f11a: "当期純利益",
    f11v: result.profit,
  };
  for (const field of data.final.groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, expected[field.id], field.id);
  const rent = {
    s0a: "前払家賃",
    s0v: (300000 * 6) / 12,
    s1v: (360000 * 6) / 12,
    s2v: (300000 * 6) / 12 + 360000 - (360000 * 6) / 12,
    s3a: "支払家賃",
    s3v: (360000 * 6) / 12,
    s4a: "支払家賃",
    s4v: (360000 * 6) / 12,
  };
  for (const field of data.parts[0].groups.flatMap((unit) => unit.fields))
    assert.equal(field.answer, rent[field.id]);
  const auxiliary = {
    s5v: ["当座預金出納帳", "固定資産台帳"],
    s6v: ["商品有高帳", "売掛金元帳", "売上帳"],
    s7v: ["商品有高帳", "買掛金元帳", "仕入帳"],
    s8a: "買掛金",
    s8v: 96000,
    s9a: "買掛金",
    s9v: 26000,
  };
  for (const field of data.parts[1].groups.flatMap((unit) => unit.fields))
    assert.deepEqual(field.answer, auxiliary[field.id]);
  assert.deepEqual(data.journals[2].debit, [
    ["借入金", 180000],
    ["支払利息", (1080000 * 0.0365 * 30) / 365],
  ]);
  assert.equal(data.journals[3].debit.length, 4);
  assert.equal(data.journals[4].credit.length, 4);
  assert.deepEqual(data.journals[6].debit, [
    ["支払手形", 156000],
    ["現金", 246000 - 156000],
  ]);
  assert.deepEqual(data.journals[9].debit, [
    ["備品減価償却累計額", 243000],
    ["減価償却費", ((540000 / 6) * 8) / 12],
    ["未収入金", 230000],
    ["固定資産売却損", 540000 - 243000 - ((540000 / 6) * 8) / 12 - 230000],
  ]);
});
