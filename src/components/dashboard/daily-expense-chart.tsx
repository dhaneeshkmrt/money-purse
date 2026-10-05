'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import type { Transaction, Category, Subcategory } from '@/lib/types';
import DayTransactionsDialog from './day-transactions-dialog';
import { ExcludeCategoryPopover } from './exclude-category-popover';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EyeOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyExpenseChartProps {
  transactions: Transaction[];
  year: number;
  month: number;
  className?: string;
}

const STORAGE_KEY_CATS = 'mp_daily_chart_excluded_categories';
const STORAGE_KEY_SUBS = 'mp_daily_chart_excluded_subcategories';

export function DailyExpenseChart({ transactions, year, month, className }: DailyExpenseChartProps) {
  const { categories } = useApp();
  const formatCurrency = useCurrencyFormatter();

  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([]);
  const [excludedSubcategoryKeys, setExcludedSubcategoryKeys] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [selectedDay, setSelectedDay] = useState<{
    date: Date | null;
    transactions: Transaction[];
    excludedCount: number;
  }>({
    date: null,
    transactions: [],
    excludedCount: 0,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load saved exclusions from localStorage on client mount
  useEffect(() => {
    try {
      const savedCats = localStorage.getItem(STORAGE_KEY_CATS);
      if (savedCats) {
        setExcludedCategoryIds(JSON.parse(savedCats));
      }
      const savedSubs = localStorage.getItem(STORAGE_KEY_SUBS);
      if (savedSubs) {
        setExcludedSubcategoryKeys(JSON.parse(savedSubs));
      }
    } catch (e) {
      console.warn('Failed to load chart filters from localStorage', e);
    }
    setIsMounted(true);
  }, []);

  // Save changes to localStorage after mounting
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(STORAGE_KEY_CATS, JSON.stringify(excludedCategoryIds));
    } catch (e) {}
  }, [excludedCategoryIds, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(STORAGE_KEY_SUBS, JSON.stringify(excludedSubcategoryKeys));
    } catch (e) {}
  }, [excludedSubcategoryKeys, isMounted]);

  // Identify Investment category
  const investmentCategory = useMemo(() => {
    return categories.find(c => {
      const n = (c.name || '').trim().toLowerCase();
      return n === 'investment' || n === 'investments' || n.startsWith('invest');
    });
  }, [categories]);

  // Check if a category is excluded
  const isCategoryExcluded = useCallback((cat: Category) => {
    return excludedCategoryIds.some(id =>
      id === cat.id || id.toLowerCase() === cat.name.toLowerCase()
    );
  }, [excludedCategoryIds]);

  // Check if a subcategory is excluded
  const isSubcategoryExcluded = useCallback((cat: Category, sub: Subcategory) => {
    const catId = cat.id || cat.name;
    const subId = sub.id || sub.name;
    const directKey = `${catId}::${subId}`;

    return excludedSubcategoryKeys.some(k => {
      if (k === directKey) return true;
      const [cPart, sPart] = k.split('::');
      const catMatches = cPart === cat.id || cPart.toLowerCase() === cat.name.toLowerCase();
      const subMatches = sPart === sub.id || sPart.toLowerCase() === sub.name.toLowerCase();
      return catMatches && subMatches;
    });
  }, [excludedSubcategoryKeys]);

  // Check if Investment category is currently hidden
  const isInvestmentHidden = useMemo(() => {
    if (investmentCategory) {
      return isCategoryExcluded(investmentCategory);
    }
    return excludedCategoryIds.some(id => id.toLowerCase().includes('invest'));
  }, [investmentCategory, isCategoryExcluded, excludedCategoryIds]);

  // Quick toggle for Investment category
  const handleToggleInvestment = useCallback(() => {
    const investKey = investmentCategory ? investmentCategory.id : 'Investment';
    if (isInvestmentHidden) {
      // Unhide investment
      setExcludedCategoryIds(prev =>
        prev.filter(id => {
          if (
            investmentCategory &&
            (id === investmentCategory.id || id.toLowerCase() === investmentCategory.name.toLowerCase())
          ) {
            return false;
          }
          return !id.toLowerCase().includes('invest');
        })
      );
    } else {
      // Hide investment
      setExcludedCategoryIds(prev => (prev.includes(investKey) ? prev : [...prev, investKey]));
    }
  }, [isInvestmentHidden, investmentCategory]);

  // Toggle Category exclusion
  const handleToggleCategory = useCallback((cat: Category) => {
    const key = cat.id || cat.name;
    setExcludedCategoryIds(prev => {
      const exists = prev.some(id => id === cat.id || id.toLowerCase() === cat.name.toLowerCase());
      if (exists) {
        return prev.filter(id => id !== cat.id && id.toLowerCase() !== cat.name.toLowerCase());
      } else {
        return [...prev, key];
      }
    });
  }, []);

  // Toggle Subcategory exclusion
  const handleToggleSubcategory = useCallback((cat: Category, sub: Subcategory) => {
    const key = `${cat.id || cat.name}::${sub.id || sub.name}`;
    setExcludedSubcategoryKeys(prev => {
      const exists = prev.some(k => {
        if (k === key) return true;
        const [cPart, sPart] = k.split('::');
        return (
          (cPart === cat.id || cPart.toLowerCase() === cat.name.toLowerCase()) &&
          (sPart === sub.id || sPart.toLowerCase() === sub.name.toLowerCase())
        );
      });
      if (exists) {
        return prev.filter(k => {
          if (k === key) return false;
          const [cPart, sPart] = k.split('::');
          const catMatches = cPart === cat.id || cPart.toLowerCase() === cat.name.toLowerCase();
          const subMatches = sPart === sub.id || sPart.toLowerCase() === sub.name.toLowerCase();
          return !(catMatches && subMatches);
        });
      } else {
        return [...prev, key];
      }
    });
  }, []);

  // Clear all exclusions
  const handleClearAll = useCallback(() => {
    setExcludedCategoryIds([]);
    setExcludedSubcategoryKeys([]);
  }, []);

  // Filter transaction helper
  const isTransactionExcluded = useCallback(
    (txn: Transaction) => {
      // 1. Category check
      const catMatches = excludedCategoryIds.some(id => {
        if (txn.categoryId && id === txn.categoryId) return true;
        if (txn.category && id.toLowerCase() === txn.category.trim().toLowerCase()) return true;
        return false;
      });
      if (catMatches) return true;

      // 2. Subcategory check
      const subMatches = excludedSubcategoryKeys.some(k => {
        const [cPart, sPart] = k.split('::');

        const catMatchesPart =
          !cPart ||
          (txn.categoryId && txn.categoryId === cPart) ||
          (txn.category && txn.category.trim().toLowerCase() === cPart.toLowerCase()) ||
          categories.some(
            c => (c.id === cPart || c.name.toLowerCase() === cPart.toLowerCase()) &&
                 (txn.categoryId === c.id || txn.category?.toLowerCase() === c.name.toLowerCase())
          );

        const subMatchesPart =
          (txn.subcategoryId && txn.subcategoryId === sPart) ||
          (txn.subcategory && txn.subcategory.trim().toLowerCase() === sPart.toLowerCase()) ||
          categories.some(c =>
            (c.subcategories || []).some(
              s => (s.id === sPart || s.name.toLowerCase() === sPart.toLowerCase()) &&
                   (txn.subcategoryId === s.id || txn.subcategory?.toLowerCase() === s.name.toLowerCase())
            )
          );

        return catMatchesPart && subMatchesPart;
      });

      return subMatches;
    },
    [excludedCategoryIds, excludedSubcategoryKeys, categories]
  );

  // Active filtered transactions
  const activeTransactions = useMemo(() => {
    return transactions.filter(t => !isTransactionExcluded(t));
  }, [transactions, isTransactionExcluded]);

  // Click on chart bar
  const handleBarClick = useCallback(
    (data: any) => {
      if (!data || !data.activePayload || !data.activePayload[0]) return;

      const payload = data.activePayload[0].payload;
      if (!payload || !payload.date) return;

      const clickedDate = payload.date;
      if (!isValid(clickedDate)) return;

      const clickedDateString = format(clickedDate, 'yyyy-MM-dd');

      const allDayTxns = transactions.filter(
        t => format(parseISO(t.date), 'yyyy-MM-dd') === clickedDateString
      );
      const activeDayTxns = activeTransactions.filter(
        t => format(parseISO(t.date), 'yyyy-MM-dd') === clickedDateString
      );

      const excludedCount = allDayTxns.length - activeDayTxns.length;

      setSelectedDay({
        date: clickedDate,
        transactions: activeDayTxns,
        excludedCount: Math.max(0, excludedCount),
      });
      setIsDialogOpen(true);
    },
    [transactions, activeTransactions]
  );

  // Chart data aggregation
  const data = useMemo(() => {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(new Date(year, month));

    const daysInMonth = eachDayOfInterval({
      start: monthStart,
      end: monthEnd,
    });

    const dailyData = new Map<string, { total: number; date: Date }>();
    daysInMonth.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      dailyData.set(dayKey, { total: 0, date: day });
    });

    activeTransactions.forEach(txn => {
      const transactionDate = parseISO(txn.date);
      const dayKey = format(transactionDate, 'yyyy-MM-dd');
      const currentData = dailyData.get(dayKey);
      if (currentData) {
        currentData.total += txn.amount;
      }
    });

    return Array.from(dailyData.values())
      .map(d => ({
        name: format(d.date, 'd MMM'),
        total: d.total,
        date: d.date,
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.date.getDate() - a.date.getDate());
  }, [activeTransactions, year, month]);

  // Active excluded tags for UI
  const activeCategoryTags = useMemo(() => {
    return excludedCategoryIds.map(id => {
      const found = categories.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase());
      return {
        id,
        name: found ? found.name : id,
      };
    });
  }, [excludedCategoryIds, categories]);

  const activeSubcategoryTags = useMemo(() => {
    return excludedSubcategoryKeys.map(key => {
      const [cPart, sPart] = key.split('::');
      const cat = categories.find(c => c.id === cPart || c.name.toLowerCase() === cPart.toLowerCase());
      const sub = cat?.subcategories?.find(
        s => s.id === sPart || s.name.toLowerCase() === sPart.toLowerCase()
      );
      const subName = sub ? sub.name : sPart;
      const catName = cat ? cat.name : cPart;
      return {
        key,
        name: `${subName} (${catName})`,
      };
    });
  }, [excludedSubcategoryKeys, categories]);

  const hasActiveExclusions = activeCategoryTags.length > 0 || activeSubcategoryTags.length > 0;

  const TotalLabel = (props: any) => {
    const { x, y, width, value } = props;

    if (value === null || value === undefined || value === 0) {
      return null;
    }

    return (
      <text
        x={x + width + 5}
        y={y + 11}
        fill="hsl(var(--foreground))"
        textAnchor="start"
        fontSize={11}
        fontWeight="bold"
      >
        {formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="font-bold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">
            Spent: <span className="font-medium text-foreground">{formatCurrency(d.total)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle>Daily Expense Overview</CardTitle>
            <CardDescription>Your spending by day for the selected period.</CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Toggle: Show / Hide Investment category */}
            <Button
              type="button"
              variant={isInvestmentHidden ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleInvestment}
              className={cn(
                'h-8 text-xs gap-1.5 transition-colors select-none',
                isInvestmentHidden && 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              )}
              title={
                isInvestmentHidden
                  ? 'Investment category is hidden. Click to show.'
                  : 'Click to hide Investment category from daily chart'
              }
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{isInvestmentHidden ? 'Investment Hidden' : 'Hide Investment'}</span>
            </Button>

            {/* Comprehensive Exclude Category and Subcategory popover */}
            <ExcludeCategoryPopover
              categories={categories}
              excludedCategoryIds={excludedCategoryIds}
              excludedSubcategoryKeys={excludedSubcategoryKeys}
              onToggleCategory={handleToggleCategory}
              onToggleSubcategory={handleToggleSubcategory}
              onClearAll={handleClearAll}
              isCategoryExcluded={isCategoryExcluded}
              isSubcategoryExcluded={isSubcategoryExcluded}
            />
          </div>
        </div>

        {/* Active exclusion chips */}
        {hasActiveExclusions && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs border-t">
            <span className="text-muted-foreground text-[11px] font-medium shrink-0">Excluded:</span>
            {activeCategoryTags.map(item => (
              <Badge
                key={item.id}
                variant="secondary"
                className="h-5 text-[11px] font-normal gap-1 pl-2 pr-1 bg-muted hover:bg-muted/80 text-foreground"
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setExcludedCategoryIds(prev => prev.filter(id => id !== item.id))
                  }
                  className="rounded-full hover:bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
                  title={`Include ${item.name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            {activeSubcategoryTags.map(item => (
              <Badge
                key={item.key}
                variant="secondary"
                className="h-5 text-[11px] font-normal gap-1 pl-2 pr-1 bg-muted hover:bg-muted/80 text-foreground"
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setExcludedSubcategoryKeys(prev => prev.filter(k => k !== item.key))
                  }
                  className="rounded-full hover:bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
                  title={`Include ${item.name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-muted-foreground hover:text-destructive underline ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-muted-foreground text-sm">
              {hasActiveExclusions
                ? 'No expenses match the current filter.'
                : 'No expenses for this month.'}
            </p>
            {hasActiveExclusions && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-8 text-xs"
              >
                Reset Exclusions
              </Button>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              onClick={handleBarClick}
              layout="vertical"
              margin={{ top: 5, right: 60, left: -10, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={value => formatCurrency(value, { notation: 'compact' })}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar
                dataKey="total"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
              >
                <LabelList dataKey="total" content={<TotalLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <DayTransactionsDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          date={selectedDay.date}
          transactions={selectedDay.transactions}
          excludedCount={selectedDay.excludedCount}
        />
      </CardContent>
    </Card>
  );
}
