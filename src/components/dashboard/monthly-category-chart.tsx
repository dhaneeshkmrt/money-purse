
'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList, Cell } from 'recharts';
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/lib/provider';
import type { Transaction } from '@/lib/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import CategoryTransactionsDialog from './category-transactions-dialog';

interface MonthlyCategoryChartProps {
    transactions: Transaction[];
}

interface ChartData {
    name: string;
    total: number;
    budget: number;
    percentage: number;
    balance: number;
    transactions: Transaction[];
}

export function MonthlyCategoryChart({ transactions }: MonthlyCategoryChartProps) {
    const { categories } = useApp();
    const formatCurrency = useCurrencyFormatter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedCategoryData, setSelectedCategoryData] = useState<ChartData | null>(null);

    const handleBarClick = useCallback((data: any) => {
        if (!data || !data.activePayload || !data.activePayload[0] || !data.activePayload[0].payload) return;
        setSelectedCategoryData(data.activePayload[0].payload);
        setDialogOpen(true);
    }, []);

    const activeCategoryTransactions = useMemo(() => {
        if (!selectedCategoryData?.name) return [];
        return transactions.filter(t => {
            const cat = categories.find(c => c.name === selectedCategoryData.name);
            return t.category === selectedCategoryData.name || (cat && t.categoryId === cat.id);
        });
    }, [selectedCategoryData?.name, transactions, categories]);

    const data = useMemo(() => {
        const categorySpending = new Map<string, { name: string; total: number; budget: number; transactions: Transaction[] }>();

        // Initialize map with all categories and their budgets
        categories.forEach(cat => {
            const budget = cat.budget || 0;
            categorySpending.set(cat.id, { name: cat.name, total: 0, budget, transactions: [] });
        });
        
        // Aggregate transactions for all categories from the already filtered transactions
        transactions.forEach(txn => {
            const catId = txn.categoryId || categories.find(c => c.name === txn.category)?.id;
            const catData = catId ? categorySpending.get(catId) : categorySpending.get(txn.category);
            if (catData) {
                catData.total += txn.amount;
                catData.transactions.push(txn);
            }
        });

        return Array.from(categorySpending.values())
            .map(({ name, total, budget, transactions }): ChartData => ({
                name,
                total,
                budget,
                percentage: budget > 0 ? Math.round((total / budget) * 100) : (total > 0 ? 100 : 0),
                balance: budget - total,
                transactions
            }))
            // Only show categories that have a budget OR have spending
            .filter(d => d.budget > 0 || d.total > 0)
            .sort((a, b) => b.budget - a.budget || b.total - a.total);
    }, [categories, transactions]);

    const maxPercentage = useMemo(() => {
        const max = Math.max(...data.map(d => d.percentage), 100);
        return Math.ceil(max / 10) * 10; // Round up to nearest 10
    }, [data]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <p className="font-bold text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                        Spent: <span className="font-medium text-foreground">{formatCurrency(data.total)}</span> / {formatCurrency(data.budget)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Balance: <span className="font-medium text-foreground">{formatCurrency(data.balance)}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    if (data.length === 0) {
        return <p className="text-muted-foreground text-center py-10">No budgeted categories or expenses for this month.</p>;
    }

    return (
        <>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }} onClick={handleBarClick}>
                    <XAxis 
                        type="number" 
                        domain={[0, maxPercentage]} 
                        tickFormatter={(tick) => `${tick}%`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={80} 
                        tick={{ fontSize: 12, width: 70, textAnchor: 'end' }}
                        interval={0}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} className="cursor-pointer">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.percentage > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                        ))}
                        <LabelList dataKey="percentage" position="right" formatter={(label: number) => `${label}%`} className="text-xs font-bold" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {selectedCategoryData && (
                <CategoryTransactionsDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    categoryName={selectedCategoryData.name}
                    transactions={activeCategoryTransactions}
                    budget={selectedCategoryData.budget}
                    spent={selectedCategoryData.total}
                />
            )}
        </>
    );
}
