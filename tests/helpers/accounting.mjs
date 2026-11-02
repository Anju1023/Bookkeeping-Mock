import assert from "node:assert/strict";

// 画面の正解データを使わず、独立した整理仕訳を残高へ転記して検算する。
export function closeAccounts(
  opening,
  entries,
  revenueAccounts,
  expenseAccounts,
) {
  const balances = new Map(Object.entries(opening));
  assert.equal(
    [...balances.values()].reduce((sum, value) => sum + value, 0),
    0,
    "整理前の貸借一致",
  );
  for (const [debit, credit] of entries) {
    assert.equal(
      debit.reduce((sum, [, value]) => sum + value, 0),
      credit.reduce((sum, [, value]) => sum + value, 0),
      "整理仕訳の貸借一致",
    );
    for (const [account, value] of debit)
      balances.set(account, (balances.get(account) || 0) + value);
    for (const [account, value] of credit)
      balances.set(account, (balances.get(account) || 0) - value);
  }
  assert.equal(
    [...balances.values()].reduce((sum, value) => sum + value, 0),
    0,
    "整理後の貸借一致",
  );
  const profit = -[...revenueAccounts, ...expenseAccounts].reduce(
    (sum, account) => sum + (balances.get(account) || 0),
    0,
  );
  const assets =
    [...balances]
      .filter(
        ([account, value]) => value > 0 && !expenseAccounts.includes(account),
      )
      .reduce((sum, [, value]) => sum + value, 0) +
    [...balances]
      .filter(
        ([account]) =>
          account.includes("減価償却累計額") || account === "貸倒引当金",
      )
      .reduce((sum, [, value]) => sum + value, 0);
  const liabilitiesEquity =
    -[...balances]
      .filter(
        ([account, value]) =>
          value < 0 &&
          !revenueAccounts.includes(account) &&
          !account.includes("減価償却累計額") &&
          account !== "貸倒引当金",
      )
      .reduce((sum, [, value]) => sum + value, 0) + profit;
  assert.equal(assets, liabilitiesEquity, "資産と負債・純資産の独立集計");
  return {
    balances,
    profit,
    assets,
    trialTotal: [...balances.values()]
      .filter((value) => value > 0)
      .reduce((sum, value) => sum + value, 0),
  };
}
