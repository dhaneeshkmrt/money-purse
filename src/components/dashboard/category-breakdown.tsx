
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Transaction } from '@/lib/types';
import { parseISO, format } from 'date-fns';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export function CategoryBreakdown({ transactions }: { transactions: Transaction[] }) {
    const { categories } = useApp();
    const formatCurrency = useCurrencyFormatter();
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
    const [selectedMicrocategory, setSelectedMicrocategory] = useState<string>('');
    const [selectedPaidBy, setSelectedPaidBy] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    
    const paidByOptions = useMemo(() => {
        if (!transactions) return [];
        const uniquePayers = new Set(transactions.map(t => t.paidBy));
        return Array.from(uniquePayers).sort();
    }, [transactions]);


    const subcategoryOptions = useMemo(() => {
        if (!selectedCategory) return [];
        const category = categories.find(c => c.id === selectedCategory || c.name === selectedCategory);
        return category ? category.subcategories : [];
    }, [selectedCategory, categories]);

    const microcategoryOptions = useMemo(() => {
        if (!selectedSubcategory) return [];
        const subcategory = subcategoryOptions.find(s => s.id === selectedSubcategory || s.name === selectedSubcategory);
        return subcategory ? (subcategory.microcategories || []) : [];
    }, [selectedSubcategory, subcategoryOptions]);
    
    const filteredAndSortedTransactions = useMemo(() => {
        const filtered = transactions.filter(t => {
            const categoryMatch = !selectedCategory || t.categoryId === selectedCategory || t.category === selectedCategory;
            const subcategoryMatch = !selectedSubcategory || t.subcategoryId === selectedSubcategory || t.subcategory === selectedSubcategory;
            const microcategoryMatch = !selectedMicrocategory || t.microcategoryId === selectedMicrocategory || t.microcategory === selectedMicrocategory;
            const paidByMatch = selectedPaidBy.length === 0 || selectedPaidBy.includes(t.paidBy);
            return categoryMatch && subcategoryMatch && microcategoryMatch && paidByMatch;
        });

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (sortKey === 'date') {
                const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
                const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
                comparison = dateA - dateB;
            } else { // amount
                comparison = a.amount - b.amount;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    }, [transactions, selectedCategory, selectedSubcategory, selectedMicrocategory, selectedPaidBy, sortKey, sortOrder]);
    
    const totalAmount = useMemo(() => {
        return filteredAndSortedTransactions.reduce((sum, t) => sum + t.amount, 0);
    }, [filteredAndSortedTransactions]);

    const getCategoryIcon = (categoryName: string) => {
        const category = categories.find(c => c.name === categoryName);
        if (category && category.icon) {
            const Icon = typeof category.icon === 'string' ? () => null : category.icon;
            return <Icon className="w-4 h-4" />;
        }
        return null;
    };

    const handlePaidByChange = (payer: string) => {
        setSelectedPaidBy(prev => 
            prev.includes(payer) ? prev.filter(p => p !== payer) : [...prev, payer]
        );
    };
    
    return (
        <Card className="flex flex-col w-full min-w-0">
            <CardHeader>
                <CardTitle>Transaction Breakdown</CardTitle>
                <CardDescription>Filter and sort transactions from the selected period.</CardDescription>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Select value={selectedCategory} onValueChange={v => {setSelectedCategory(v === 'all' ? '' : v); setSelectedSubcategory(''); setSelectedMicrocategory('');}}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedSubcategory} onValueChange={v => {setSelectedSubcategory(v === 'all' ? '' : v); setSelectedMicrocategory('');}} disabled={!selectedCategory}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="all">All Subcategories</SelectItem>
                            {subcategoryOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedMicrocategory} onValueChange={v => setSelectedMicrocategory(v === 'all' ? '' : v)} disabled={!selectedSubcategory}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Micro Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Micro Categories</SelectItem>
                            {microcategoryOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto">
                                Paid By
                                {selectedPaidBy.length > 0 && <Badge variant="secondary" className="ml-2">{selectedPaidBy.length}</Badge>}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Filter by Payer</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {paidByOptions.map(p => (
                                <DropdownMenuCheckboxItem
                                    key={p}
                                    checked={selectedPaidBy.includes(p)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={() => handlePaidByChange(p)}
                                >
                                    {p.toUpperCase()}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Select value={`${sortKey}-${sortOrder}`} onValueChange={(value) => {
                        const [key, order] = value.split('-') as [typeof sortKey, typeof sortOrder];
                        setSortKey(key);
                        setSortOrder(order);
                    }}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date-desc">Date (Newest first)</SelectItem>
                            <SelectItem value="date-asc">Date (Oldest first)</SelectItem>
                            <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                            <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                    {selectedPaidBy.map(p => (
                        <Badge key={p} variant="secondary" className="flex items-center gap-1">
                            {p.toUpperCase()}
                        </Badge>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col min-w-0">
                <div className="border-t pt-4">
                    <p className="text-2xl font-bold text-center mb-4">
                        Total: {formatCurrency(totalAmount)}
                    </p>
                </div>
                <div className="flex-grow min-w-0">
                    <div className="space-y-4">
                        {filteredAndSortedTransactions.length > 0 ? filteredAndSortedTransactions.map((transaction) => (
                            <div key={transaction.id} className="flex items-start sm:items-center justify-between gap-3 min-w-0">
                                <Avatar className="h-9 w-9 shrink-0 mt-0.5 sm:mt-0">
                                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                                    {getCategoryIcon(transaction.category)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1 min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-snug break-words">{transaction.description}</p>
                                    <p className="text-sm text-muted-foreground">{format(parseISO(transaction.date), 'dd MMM yyyy')}</p>
                                </div>
                                <div className="font-medium text-right shrink-0">
                                    <div className="flex items-center justify-end gap-2">
                                    <span>{formatCurrency(transaction.amount)}</span>
                                    <Badge variant="outline" className="font-mono">{transaction.paidBy.toUpperCase()}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground max-w-[130px] sm:max-w-none truncate sm:whitespace-normal">{transaction.category}{transaction.subcategory ? ` / ${transaction.subcategory}` : ''}{transaction.microcategory ? ` / ${transaction.microcategory}` : ''}</p>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center pt-4">No transactions match your filters.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
