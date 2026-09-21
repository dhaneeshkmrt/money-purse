'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList, Cell } from 'recharts';
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/lib/provider';
import type { Transaction } from '@/lib/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import SubcategoryTransactionsDialog from './subcategory-transactions-dialog';

interface MonthlySubcategoryChartProps {
    transactions: Transaction[];
}

interface SubcategoryChartData {
    categoryName: string;
    subcategoryName: string;
    displayName: string;
    total: number;
    budget: number;
    percentage: number;
    balance: number;
    transactions: Transaction[];
}

export function MonthlySubcategoryChart({ transactions }: MonthlySubcategoryChartProps) {
    const { categories } = useApp();
    const formatCurrency = useCurrencyFormatter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSubcategoryData, setSelectedSubcategoryData] = useState<SubcategoryChartData | null>(null);

    const handleBarClick = useCallback((data: any) => {
        if (!data || !data.activePayload || !data.activePayload[0] || !data.activePayload[0].payload) return;
        setSelectedSubcategoryData(data.activePayload[0].payload);
        setDialogOpen(true);
    }, []);

    const data = useMemo(() => {
        const subcategorySpending = new Map<string, { categoryName: string; subcategoryName: string; total: number; budget: number; transactions: Transaction[] }>();

        // 1. Initialize with all subcategories from categories
        categories.forEach(cat => {
            (cat.subcategories || []).forEach(sub => {
                const budget = sub.budget || 0;
                subcategorySpending.set(sub.id, { 
                    categoryName: cat.name, 
                    subcategoryName: sub.name, 
                    total: 0, 
                    budget, 
                    transactions: [] 
                });
            });
        });

        // 2. Aggregate matching transactions for all subcategories
        transactions.forEach(txn => {
            if (!txn.subcategory && !txn.subcategoryId) return;

            let subData = txn.subcategoryId ? subcategorySpending.get(txn.subcategoryId) : undefined;
            if (!subData && txn.subcategory) {
                const targetSub = txn.subcategory.trim().toLowerCase();
                const targetCat = txn.category ? txn.category.trim().toLowerCase() : '';
                subData = Array.from(subcategorySpending.values()).find(s => 
                    s.subcategoryName.trim().toLowerCase() === targetSub &&
                    (!targetCat || s.categoryName.trim().toLowerCase() === targetCat)
                );
            }
            if (!subData && txn.subcategory) {
                // If transaction subcategory is not pre-registered in categories list
                const dynamicKey = txn.subcategoryId || `${txn.category || 'Other'}___${txn.subcategory}`;
                subData = {
                    categoryName: txn.category || 'Other',
                    subcategoryName: txn.subcategory,
                    total: 0,
                    budget: 0,
                    transactions: []
                };
                subcategorySpending.set(dynamicKey, subData);
            }
            if (subData) {
                subData.total += txn.amount;
                subData.transactions.push(txn);
            }
        });

        return Array.from(subcategorySpending.values())
            .map(({ categoryName, subcategoryName, total, budget, transactions }): SubcategoryChartData => ({
                categoryName,
                subcategoryName,
                displayName: `${subcategoryName} (${categoryName})`,
                total,
                budget,
                percentage: budget > 0 ? Math.round((total / budget) * 100) : (total > 0 ? 100 : 0),
                balance: budget - total,
                transactions
            }))
            .filter(d => d.total > 0)
            .sort((a, b) => {
                if (a.budget > 0 && b.budget > 0) {
                    return b.percentage - a.percentage || b.total - a.total;
                }
                if (a.budget > 0) return -1;
                if (b.budget > 0) return 1;
                return b.total - a.total;
            });
    }, [categories, transactions]);

    const maxPercentage = useMemo(() => {
        const max = Math.max(...data.map(d => d.percentage), 100);
        return Math.ceil(max / 10) * 10; // Round up to nearest 10
    }, [data]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload as SubcategoryChartData;
            const hasBudget = item.budget > 0;
            const isOver = hasBudget && item.total > item.budget;
            return (
                <div className="rounded-lg border bg-background p-2.5 shadow-sm space-y-1">
                    <p className="font-bold text-sm">{item.subcategoryName} <span className="text-xs text-muted-foreground font-normal">({item.categoryName})</span></p>
                    <p className="text-xs text-muted-foreground">
                        Spent: <span className={`font-semibold ${isOver ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(item.total)}</span> {hasBudget ? `/ ${formatCurrency(item.budget)}` : ''}
                    </p>
                    {hasBudget ? (
                        <p className="text-xs text-muted-foreground">
                            Balance: <span className={`font-semibold ${isOver ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(item.balance)}</span> {isOver ? '(Exceeded!)' : ''}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">
                            No budget set
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    if (data.length === 0) {
        return (
            <div className="text-center py-10 space-y-1">
                <p className="text-muted-foreground text-sm font-medium">No subcategory expenses recorded for this month.</p>
                <p className="text-xs text-muted-foreground">Subcategory spending will appear here once transactions are recorded.</p>
            </div>
        );
    }

    return (
        <>
            <ResponsiveContainer width="100%" height={Math.max(250, data.length * 45)}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 65, left: 10, bottom: 5 }} onClick={handleBarClick}>
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
                        dataKey="subcategoryName" 
                        width={90} 
                        tick={{ fontSize: 12, width: 85, textAnchor: 'end' }}
                        interval={0}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} className="cursor-pointer">
                        {data.map((entry, index) => (
                            <Cell 
                                key={`sub-cell-${index}`} 
                                fill={entry.budget > 0 && entry.percentage > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} 
                            />
                        ))}
                        <LabelList 
                            dataKey="percentage" 
                            position="right" 
                            formatter={(val: any, index: number) => {
                                const item = data[index];
                                if (item && item.budget <= 0) {
                                    return formatCurrency(item.total);
                                }
                                const num = Number(val);
                                return `${num}%${num > 100 ? ' ⚠' : ''}`;
                            }} 
                            className="text-xs font-bold" 
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {selectedSubcategoryData && (
                <SubcategoryTransactionsDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    categoryName={selectedSubcategoryData.categoryName}
                    subcategoryName={selectedSubcategoryData.subcategoryName}
                    transactions={selectedSubcategoryData.transactions}
                    budget={selectedSubcategoryData.budget}
                    spent={selectedSubcategoryData.total}
                />
            )}
        </>
    );
}
