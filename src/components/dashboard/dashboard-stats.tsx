
'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, parseISO } from 'date-fns';
import type { Transaction } from '@/lib/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

interface DashboardStatsProps {
    transactions: Transaction[];
    year: number;
    month: number;
}

export function DashboardStats({ transactions, year, month }: DashboardStatsProps) {
    const { loadingTransactions } = useApp();
    const formatCurrency = useCurrencyFormatter();

    const stats = useMemo(() => {
        const todaysExpense = transactions
            .filter(t => isToday(parseISO(t.date)))
            .reduce((sum, t) => sum + t.amount, 0);

        if (!transactions.length) {
            return {
                totalSpent: 0,
                todaysExpense,
            };
        }

        const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        return {
            totalSpent,
            todaysExpense,
        };

    }, [transactions]);
    
    if (loadingTransactions && !transactions.length) {
        return (
            <div className="grid gap-6 md:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-10 w-1/2" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }
    
    const selectedMonthName = format(new Date(year, month), 'MMMM');

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Total Spent ({selectedMonthName})</CardTitle>
                    <CardDescription>Total expenses for the selected month.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl sm:text-4xl font-bold">{formatCurrency(stats.totalSpent)}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Today&apos;s Expense</CardTitle>
                    <CardDescription>Total amount spent today.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl sm:text-4xl font-bold">{formatCurrency(stats.todaysExpense)}</p>
                </CardContent>
            </Card>
        </div>
    );
}
