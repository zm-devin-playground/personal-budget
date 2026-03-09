import { describe, expect, it } from 'vitest';

import { theme } from '@actual-app/components/theme';

import { makeBalanceAmountStyle } from './util';

describe('makeBalanceAmountStyle', () => {
  describe('negative balance', () => {
    it('should return negative color when balance is negative', () => {
      const result = makeBalanceAmountStyle(-10000);
      expect(result).toEqual({ color: theme.budgetNumberNegative });
    });
  });

  describe('zero balance', () => {
    it('should return zero/grey color when balance is zero', () => {
      const result = makeBalanceAmountStyle(0);
      expect(result).toEqual({ color: theme.budgetNumberZero });
    });
  });

  describe('positive balance without goal', () => {
    it('should return positive color when balance is positive and no goal', () => {
      const result = makeBalanceAmountStyle(50000);
      expect(result).toEqual({ color: theme.budgetNumberPositive });
    });
  });

  describe('with goal values', () => {
    it('should return underfunded color when budgeted is less than goal', () => {
      const result = makeBalanceAmountStyle(10000, 50000, 30000);
      expect(result).toEqual({ color: theme.templateNumberUnderFunded });
    });

    it('should return funded color when budgeted meets goal', () => {
      const result = makeBalanceAmountStyle(10000, 50000, 50000);
      expect(result).toEqual({ color: theme.templateNumberFunded });
    });

    it('should return funded color when budgeted exceeds goal', () => {
      const result = makeBalanceAmountStyle(10000, 50000, 60000);
      expect(result).toEqual({ color: theme.templateNumberFunded });
    });
  });

  describe('budget category warning (90% threshold)', () => {
    it('should return warning color when 90% or more of budget is spent', () => {
      // Budget: 100000 (=$100.00), Balance: 5000 (=$5.00) → 95% spent
      const result = makeBalanceAmountStyle(5000, null, null, 100000);
      expect(result).toEqual({ color: theme.warningText });
    });

    it('should return warning color when exactly 90% of budget is spent', () => {
      // Budget: 100000 (=$100.00), Balance: 10000 (=$10.00) → exactly 90% spent
      const result = makeBalanceAmountStyle(10000, null, null, 100000);
      expect(result).toEqual({ color: theme.warningText });
    });

    it('should return positive color when less than 90% of budget is spent', () => {
      // Budget: 100000 (=$100.00), Balance: 20000 (=$20.00) → 80% spent
      const result = makeBalanceAmountStyle(20000, null, null, 100000);
      expect(result).toEqual({ color: theme.budgetNumberPositive });
    });

    it('should return positive color when no categoryBudgetedValue is provided', () => {
      const result = makeBalanceAmountStyle(5000);
      expect(result).toEqual({ color: theme.budgetNumberPositive });
    });

    it('should return positive color when categoryBudgetedValue is null', () => {
      const result = makeBalanceAmountStyle(5000, null, null, null);
      expect(result).toEqual({ color: theme.budgetNumberPositive });
    });

    it('should return positive color when categoryBudgetedValue is zero', () => {
      // No budget set, so no warning even though balance is low
      const result = makeBalanceAmountStyle(5000, null, null, 0);
      expect(result).toEqual({ color: theme.budgetNumberPositive });
    });

    it('should not show warning when balance is negative (negative takes priority)', () => {
      const result = makeBalanceAmountStyle(-5000, null, null, 100000);
      expect(result).toEqual({ color: theme.budgetNumberNegative });
    });

    it('should not show warning when goal is set (goal colors take priority)', () => {
      // Even though 90%+ spent, goal-based coloring should take priority
      const result = makeBalanceAmountStyle(5000, 50000, 50000, 100000);
      expect(result).toEqual({ color: theme.templateNumberFunded });
    });

    it('should return zero color when balance is zero even with budget set', () => {
      const result = makeBalanceAmountStyle(0, null, null, 100000);
      expect(result).toEqual({ color: theme.budgetNumberZero });
    });
  });
});
