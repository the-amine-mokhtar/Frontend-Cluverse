import { Injectable } from '@angular/core';
import { BudgetDto, TransactionDto } from '../../../core/services/finance.service';

export type ForecastHorizon = 1 | 3 | 6;

export interface ForecastFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface MonthlyForecastPoint {
  monthLabel: string;
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  eventOutflowShare: number;
}

export interface AiCashFlowProjection {
  horizonMonths: ForecastHorizon;
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  confidenceScore: number;
  errorBandRatio: number;
  netLowerBound: number;
  netUpperBound: number;
  backtestMape: number;
  backtestHitRate: number;
  backtestSampleSize: number;
  factors: ForecastFactor[];
  monthlyBreakdown: MonthlyForecastPoint[];
}

export interface AiCashFlowForecastResult {
  asOfDate: string;
  projections: AiCashFlowProjection[];
}

interface HistoricalMonthTotals {
  inflow: number;
  outflow: number;
}

@Injectable({
  providedIn: 'root'
})
export class CashflowForecastAiService {
  generateForecast(
    transactions: TransactionDto[],
    budgets: BudgetDto[],
    referenceDate = new Date(),
    horizons: ForecastHorizon[] = [1, 3, 6]
  ): AiCashFlowForecastResult {
    const monthTotals = this.buildHistoricalMonthTotals(transactions);

    const projections = horizons.map((horizon) =>
      this.projectForHorizon(monthTotals, budgets, referenceDate, horizon)
    );

    return {
      asOfDate: referenceDate.toISOString(),
      projections
    };
  }

  private projectForHorizon(
    monthTotals: Map<string, HistoricalMonthTotals>,
    budgets: BudgetDto[],
    referenceDate: Date,
    horizonMonths: ForecastHorizon
  ): AiCashFlowProjection {
    const recurringInflow = this.computeRecurringAverage(monthTotals, referenceDate, 'inflow');
    const recurringOutflow = this.computeRecurringAverage(monthTotals, referenceDate, 'outflow');
    const inflowTrend = this.computeMonthlyTrend(monthTotals, referenceDate, 'inflow');
    const outflowTrend = this.computeMonthlyTrend(monthTotals, referenceDate, 'outflow');

    const inflowStability = this.computeStability(monthTotals, referenceDate, 'inflow');
    const outflowStability = this.computeStability(monthTotals, referenceDate, 'outflow');

    const confidenceScore = this.computeConfidenceScore(
      monthTotals,
      budgets,
      inflowStability,
      outflowStability
    );

    const alpha = this.computeRecurringWeight(monthTotals.size);
    const futureMonths = this.getFutureMonths(referenceDate, horizonMonths);
    const eventOutflowByMonth = this.allocateExpectedEventOutflowByMonth(budgets, futureMonths);

    const monthlyBreakdown: MonthlyForecastPoint[] = futureMonths.map((monthDate, index) => {
      const seasonalInflow = this.computeSeasonalValue(monthTotals, monthDate, 'inflow');
      const seasonalOutflow = this.computeSeasonalValue(monthTotals, monthDate, 'outflow');

      const trendAdjustedInflow = this.applyTrend(recurringInflow, inflowTrend, index + 1);
      const trendAdjustedOutflow = this.applyTrend(recurringOutflow, outflowTrend, index + 1);

      const projectedInflow = this.mixRecurringAndSeasonal(trendAdjustedInflow, seasonalInflow, alpha);
      const projectedOutflowBase = this.mixRecurringAndSeasonal(trendAdjustedOutflow, seasonalOutflow, alpha);
      const eventOutflowShare = eventOutflowByMonth.get(this.monthKey(monthDate)) ?? 0;
      const projectedOutflow = projectedOutflowBase + eventOutflowShare;

      return {
        monthLabel: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        projectedInflow,
        projectedOutflow,
        projectedNet: projectedInflow - projectedOutflow,
        eventOutflowShare
      };
    });

    const projectedInflow = monthlyBreakdown.reduce((sum, month) => sum + month.projectedInflow, 0);
    const projectedOutflow = monthlyBreakdown.reduce((sum, month) => sum + month.projectedOutflow, 0);
    const projectedNet = projectedInflow - projectedOutflow;

    const backtest = this.runBacktest(monthTotals, referenceDate, horizonMonths);
    const baseErrorBand = Math.max(0.08, backtest.mape * 1.2);
    const dataPenalty = monthTotals.size < 6 ? 0.08 : monthTotals.size < 10 ? 0.04 : 0;
    const confidencePenalty = (100 - confidenceScore) / 500;
    const errorBandRatio = this.clamp(baseErrorBand + dataPenalty + confidencePenalty, 0.1, 0.6);
    const netBandAmount = Math.abs(projectedNet) * errorBandRatio;

    const factors = this.buildFactors(
      monthTotals,
      budgets,
      recurringInflow,
      recurringOutflow,
      inflowStability,
      outflowStability,
      monthlyBreakdown
    );

    return {
      horizonMonths,
      projectedInflow,
      projectedOutflow,
      projectedNet,
      confidenceScore,
      errorBandRatio,
      netLowerBound: projectedNet - netBandAmount,
      netUpperBound: projectedNet + netBandAmount,
      backtestMape: backtest.mape,
      backtestHitRate: backtest.hitRate,
      backtestSampleSize: backtest.sampleSize,
      factors,
      monthlyBreakdown
    };
  }

  private buildHistoricalMonthTotals(transactions: TransactionDto[]): Map<string, HistoricalMonthTotals> {
    const totals = new Map<string, HistoricalMonthTotals>();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = this.monthKey(date);
      const existing = totals.get(key) ?? { inflow: 0, outflow: 0 };

      if (transaction.type === 'INCOME') {
        existing.inflow += transaction.amount;
      } else {
        existing.outflow += transaction.amount;
      }

      totals.set(key, existing);
    });

    return totals;
  }

  private computeRecurringAverage(
    monthTotals: Map<string, HistoricalMonthTotals>,
    referenceDate: Date,
    field: 'inflow' | 'outflow'
  ): number {
    const recentValues = this.getRecentMonthlyValues(monthTotals, referenceDate, field, 6);
    if (recentValues.length === 0) {
      return 0;
    }

    return recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
  }

  private computeSeasonalValue(
    monthTotals: Map<string, HistoricalMonthTotals>,
    targetDate: Date,
    field: 'inflow' | 'outflow'
  ): number {
    const monthIndex = targetDate.getMonth();
    const seasonalValues: number[] = [];

    monthTotals.forEach((totals, key) => {
      const date = this.dateFromMonthKey(key);
      if (date.getMonth() === monthIndex) {
        seasonalValues.push(totals[field]);
      }
    });

    if (seasonalValues.length === 0) {
      return 0;
    }

    return seasonalValues.reduce((sum, value) => sum + value, 0) / seasonalValues.length;
  }

  private computeStability(
    monthTotals: Map<string, HistoricalMonthTotals>,
    referenceDate: Date,
    field: 'inflow' | 'outflow'
  ): number {
    const values = this.getRecentMonthlyValues(monthTotals, referenceDate, field, 6);
    if (values.length < 2) {
      return 0;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mean <= 0) {
      return 0;
    }

    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    return this.clamp(1 - coefficientOfVariation, 0, 1);
  }

  private computeMonthlyTrend(
    monthTotals: Map<string, HistoricalMonthTotals>,
    referenceDate: Date,
    field: 'inflow' | 'outflow'
  ): number {
    const values = this.getRecentMonthlyValues(monthTotals, referenceDate, field, 6).reverse();
    if (values.length < 3) {
      return 0;
    }

    const changes: number[] = [];
    for (let i = 1; i < values.length; i += 1) {
      const previous = Math.max(values[i - 1], 1);
      changes.push((values[i] - values[i - 1]) / previous);
    }

    if (changes.length === 0) {
      return 0;
    }

    const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    return this.clamp(averageChange, -0.12, 0.12);
  }

  private applyTrend(baseValue: number, trend: number, monthStep: number): number {
    if (baseValue <= 0) {
      return 0;
    }

    return Math.max(0, baseValue * Math.pow(1 + trend, monthStep));
  }

  private computeRecurringWeight(monthCount: number): number {
    if (monthCount >= 12) {
      return 0.75;
    }
    if (monthCount >= 6) {
      return 0.65;
    }
    if (monthCount >= 3) {
      return 0.55;
    }
    return 0.45;
  }

  private mixRecurringAndSeasonal(recurring: number, seasonal: number, recurringWeight: number): number {
    if (recurring <= 0 && seasonal <= 0) {
      return 0;
    }

    if (seasonal <= 0) {
      return recurring;
    }

    if (recurring <= 0) {
      return seasonal;
    }

    return recurring * recurringWeight + seasonal * (1 - recurringWeight);
  }

  private allocateExpectedEventOutflowByMonth(
    budgets: BudgetDto[],
    forecastMonths: Date[]
  ): Map<string, number> {
    const result = new Map<string, number>();
    const forecastYears = new Set(forecastMonths.map((date) => date.getFullYear()));

    const expectedEventBudgets = budgets.filter((budget) => {
      const hasEvent = Boolean(budget.event?.id || budget.eventId);
      const year = this.normalizeYear(budget.year);
      return hasEvent && budget.totalAllocated > 0 && forecastYears.has(year);
    });

    expectedEventBudgets.forEach((budget) => {
      const budgetYear = this.normalizeYear(budget.year);
      const yearMatchedMonths = forecastMonths.filter((date) => date.getFullYear() === budgetYear);
      const targetMonths = yearMatchedMonths.length > 0 ? yearMatchedMonths : forecastMonths;

      if (targetMonths.length === 0) {
        return;
      }

      const perMonthShare = budget.totalAllocated / targetMonths.length;
      targetMonths.forEach((monthDate) => {
        const key = this.monthKey(monthDate);
        result.set(key, (result.get(key) ?? 0) + perMonthShare);
      });
    });

    return result;
  }

  private computeConfidenceScore(
    monthTotals: Map<string, HistoricalMonthTotals>,
    budgets: BudgetDto[],
    inflowStability: number,
    outflowStability: number
  ): number {
    const dataSufficiencyScore = this.clamp(monthTotals.size / 12, 0, 1) * 40;
    const stabilityScore = ((inflowStability + outflowStability) / 2) * 40;

    const hasExpectedEvents = budgets.some((budget) => {
      const hasEvent = Boolean(budget.event?.id || budget.eventId);
      return hasEvent && budget.totalAllocated > 0;
    });

    const eventCoverageScore = hasExpectedEvents ? 20 : 12;

    return Math.round(this.clamp(dataSufficiencyScore + stabilityScore + eventCoverageScore, 0, 100));
  }

  private buildFactors(
    monthTotals: Map<string, HistoricalMonthTotals>,
    budgets: BudgetDto[],
    recurringInflow: number,
    recurringOutflow: number,
    inflowStability: number,
    outflowStability: number,
    monthlyBreakdown: MonthlyForecastPoint[]
  ): ForecastFactor[] {
    const eventShare = monthlyBreakdown.reduce((sum, month) => sum + month.eventOutflowShare, 0);

    const factors: ForecastFactor[] = [
      {
        label: `Recurring inflow baseline is ${this.roundCurrency(recurringInflow)} per month`,
        impact: recurringInflow > recurringOutflow ? 'positive' : 'neutral',
        weight: 0.28
      },
      {
        label: `Recurring outflow baseline is ${this.roundCurrency(recurringOutflow)} per month`,
        impact: recurringOutflow > recurringInflow ? 'negative' : 'neutral',
        weight: 0.28
      },
      {
        label: `Inflow stability ${(inflowStability * 100).toFixed(0)}% and outflow stability ${(outflowStability * 100).toFixed(0)}%`,
        impact: (inflowStability + outflowStability) / 2 >= 0.6 ? 'positive' : 'neutral',
        weight: 0.22
      },
      {
        label: eventShare > 0
          ? `Expected event-linked outflow adds ${this.roundCurrency(eventShare)} in this horizon`
          : 'No event-linked budget outflow found for this horizon',
        impact: eventShare > 0 ? 'negative' : 'neutral',
        weight: 0.22
      }
    ];

    if (monthTotals.size < 4) {
      factors.push({
        label: 'Low transaction history depth may reduce projection precision',
        impact: 'negative',
        weight: 0.18
      });
    }

    const hasEventBudgets = budgets.some((budget) => Boolean(budget.event?.id || budget.eventId));
    if (!hasEventBudgets) {
      factors.push({
        label: 'No event-linked budgets detected; event impact component is limited',
        impact: 'neutral',
        weight: 0.15
      });
    }

    return factors;
  }

  private runBacktest(
    monthTotals: Map<string, HistoricalMonthTotals>,
    referenceDate: Date,
    horizonMonths: ForecastHorizon
  ): { mape: number; hitRate: number; sampleSize: number } {
    const lookback = Math.max(4, horizonMonths + 2);
    const samples: Array<{ actual: number; predicted: number }> = [];

    for (let i = lookback; i >= 1; i -= 1) {
      const targetDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const targetKey = this.monthKey(targetDate);
      const actualTotals = monthTotals.get(targetKey);
      if (!actualTotals) {
        continue;
      }

      const historyMap = this.sliceHistoryBefore(monthTotals, targetDate);
      if (historyMap.size < 3) {
        continue;
      }

      const predictedInflow = this.forecastSingleMonthValue(historyMap, targetDate, 'inflow');
      const predictedOutflow = this.forecastSingleMonthValue(historyMap, targetDate, 'outflow');
      const predictedNet = predictedInflow - predictedOutflow;
      const actualNet = actualTotals.inflow - actualTotals.outflow;

      samples.push({ actual: actualNet, predicted: predictedNet });
    }

    if (samples.length === 0) {
      return { mape: 0.3, hitRate: 0.5, sampleSize: 0 };
    }

    const absolutePctErrors = samples.map((sample) => {
      const denominator = Math.max(Math.abs(sample.actual), 1);
      return Math.abs(sample.actual - sample.predicted) / denominator;
    });

    const mapeRaw = absolutePctErrors.reduce((sum, value) => sum + value, 0) / absolutePctErrors.length;
    const mape = this.clamp(mapeRaw, 0, 1.5);

    const directionalHits = samples.filter((sample) => {
      if (sample.actual === 0 || sample.predicted === 0) {
        return Math.abs(sample.actual - sample.predicted) <= Math.max(100, Math.abs(sample.actual) * 0.2);
      }
      return Math.sign(sample.actual) === Math.sign(sample.predicted);
    }).length;

    const hitRate = directionalHits / samples.length;
    return { mape, hitRate, sampleSize: samples.length };
  }

  private forecastSingleMonthValue(
    monthTotals: Map<string, HistoricalMonthTotals>,
    targetDate: Date,
    field: 'inflow' | 'outflow'
  ): number {
    const recurring = this.computeRecurringAverage(monthTotals, targetDate, field);
    const seasonal = this.computeSeasonalValue(monthTotals, targetDate, field);
    const alpha = this.computeRecurringWeight(monthTotals.size);
    return this.mixRecurringAndSeasonal(recurring, seasonal, alpha);
  }

  private sliceHistoryBefore(
    monthTotals: Map<string, HistoricalMonthTotals>,
    cutoffDate: Date
  ): Map<string, HistoricalMonthTotals> {
    const sliced = new Map<string, HistoricalMonthTotals>();

    monthTotals.forEach((value, key) => {
      const date = this.dateFromMonthKey(key);
      if (date < cutoffDate) {
        sliced.set(key, value);
      }
    });

    return sliced;
  }

  private getFutureMonths(referenceDate: Date, horizonMonths: number): Date[] {
    const months: Date[] = [];

    for (let i = 1; i <= horizonMonths; i += 1) {
      months.push(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + i, 1));
    }

    return months;
  }

  private getRecentMonthlyValues(
    monthTotals: Map<string, HistoricalMonthTotals>,
    referenceDate: Date,
    field: 'inflow' | 'outflow',
    monthsBack: number
  ): number[] {
    const values: number[] = [];

    for (let i = 1; i <= monthsBack; i += 1) {
      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const key = this.monthKey(date);
      values.push(monthTotals.get(key)?.[field] ?? 0);
    }

    return values;
  }

  private normalizeYear(year: number | string): number {
    if (typeof year === 'number') {
      return year;
    }

    const parsedDate = new Date(year);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getUTCFullYear();
    }

    const parsedNumber = Number(year);
    return Number.isFinite(parsedNumber) ? parsedNumber : new Date().getFullYear();
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private dateFromMonthKey(key: string): Date {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1);
  }

  private roundCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
