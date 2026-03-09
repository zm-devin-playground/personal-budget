// @ts-strict-ignore
import { stringify as csvStringify } from 'csv-stringify/sync';

import { integerToAmount } from '../../../shared/util';
import { aqlQuery } from '../../aql';

export async function exportToCSV(
  transactions,
  accounts,
  categoryGroups,
  payees,
) {
  const accountNamesById = accounts.reduce((reduced, { id, name }) => {
    reduced[id] = name;
    return reduced;
  }, {});

  const categoryNamesById = categoryGroups.reduce(
    (reduced, { name, categories: subCategories }) => {
      subCategories.forEach(
        subCategory =>
          (reduced[subCategory.id] = `${name}: ${subCategory.name}`),
      );
      return reduced;
    },
    {},
  );

  const payeeNamesById = payees.reduce((reduced, { id, name }) => {
    reduced[id] = name;
    return reduced;
  }, {});

  const transactionsForExport = transactions.map(
    ({
      account,
      date,
      payee,
      notes,
      category,
      amount,
      cleared,
      reconciled,
    }) => ({
      Account: accountNamesById[account],
      Date: date,
      Payee: payeeNamesById[payee],
      Notes: notes,
      Category: categoryNamesById[category],
      Amount: amount == null ? 0 : integerToAmount(amount),
      Cleared: cleared,
      Reconciled: reconciled,
    }),
  );

  return csvStringify(transactionsForExport, { header: true });
}

export async function exportQueryToCSV(query) {
  const { data: transactions } = await aqlQuery(
    query
      .select([
        { Id: 'id' },
        { Account: 'account.name' },
        { Date: 'date' },
        { Payee: 'payee.name' },
        { ParentId: 'parent_id' },
        { IsParent: 'is_parent' },
        { IsChild: 'is_child' },
        { SortOrder: 'sort_order' },
        { Notes: 'notes' },
        { CategoryGroup: 'category.group.name' },
        { Category: 'category.name' },
        { Amount: 'amount' },
        { Cleared: 'cleared' },
        { Reconciled: 'reconciled' },
      ])
      .options({ splits: 'all' }),
  );

  // initialize a map to allow splits to have correct number of split from
  const parentsChildCount: Map<number, number> = new Map();
  const childSplitOrder: Map<number, number> = new Map();

  // find children, their order, and total # siblings
  for (const trans of transactions) {
    if (trans.IsChild) {
      let childNumber = parentsChildCount.get(trans.ParentId) || 0;
      childNumber++;
      childSplitOrder.set(trans.Id, childNumber);
      parentsChildCount.set(trans.ParentId, childNumber);
    }
  }

  // map final properties for export and grab the child count for splits from their parent transaction
  const transactionsForExport = transactions.map(trans => {
    return {
      Account: trans.Account,
      Date: trans.Date,
      Payee: trans.Payee,
      Notes: trans.IsParent
        ? '(SPLIT INTO ' +
          parentsChildCount.get(trans.Id) +
          ') ' +
          (trans.Notes || '')
        : trans.IsChild
          ? '(SPLIT ' +
            childSplitOrder.get(trans.Id) +
            ' OF ' +
            parentsChildCount.get(trans.ParentId) +
            ') ' +
            (trans.Notes || '')
          : trans.Notes,
      Category_Group: trans.CategoryGroup,
      Category: trans.Category,
      Amount: trans.IsParent
        ? 0
        : trans.Amount == null
          ? 0
          : integerToAmount(trans.Amount),
      Split_Amount: trans.IsParent ? integerToAmount(trans.Amount) : 0,
      Cleared:
        trans.Reconciled === true
          ? 'Reconciled'
          : trans.Cleared === true
            ? 'Cleared'
            : 'Not cleared',
    };
  });

  return csvStringify(transactionsForExport, { header: true });
}

export async function exportAccountQueryToCSV(query) {
  // Fetch transactions with running balance computed server-side
  const { data: transactions } = await aqlQuery(
    query
      .select([
        { Id: 'id' },
        { Date: 'date' },
        { Payee: 'payee.name' },
        { Notes: 'notes' },
        { Category: 'category.name' },
        { Amount: 'amount' },
        { Balance: { $sumOver: '$amount' } },
        { Cleared: 'cleared' },
        { Reconciled: 'reconciled' },
        { IsParent: 'is_parent' },
        { IsChild: 'is_child' },
        { ParentId: 'parent_id' },
      ])
      .options({ splits: 'all' }),
  );

  // Track split numbering
  const parentsChildCount: Map<number, number> = new Map();
  const childSplitOrder: Map<number, number> = new Map();

  for (const trans of transactions) {
    if (trans.IsChild) {
      let childNumber = parentsChildCount.get(trans.ParentId) || 0;
      childNumber++;
      childSplitOrder.set(trans.Id, childNumber);
      parentsChildCount.set(trans.ParentId, childNumber);
    }
  }

  const transactionsForExport = transactions.map(trans => {
    return {
      Date: trans.Date,
      Payee: trans.Payee,
      Category: trans.Category,
      Notes: trans.IsParent
        ? '(SPLIT INTO ' +
          parentsChildCount.get(trans.Id) +
          ') ' +
          (trans.Notes || '')
        : trans.IsChild
          ? '(SPLIT ' +
            childSplitOrder.get(trans.Id) +
            ' OF ' +
            parentsChildCount.get(trans.ParentId) +
            ') ' +
            (trans.Notes || '')
          : trans.Notes,
      Amount: trans.IsParent
        ? 0
        : trans.Amount == null
          ? 0
          : integerToAmount(trans.Amount),
      Balance: trans.Balance == null ? 0 : integerToAmount(trans.Balance),
      Cleared:
        trans.Reconciled === true
          ? 'Reconciled'
          : trans.Cleared === true
            ? 'Cleared'
            : 'Not cleared',
    };
  });

  // Collect the date range from the exported transactions
  const dates = transactions.filter(t => t.Date).map(t => t.Date as string);
  const startDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const endDate = dates.length > 0 ? dates[0] : null;

  return {
    csv: csvStringify(transactionsForExport, { header: true }),
    startDate,
    endDate,
  };
}
