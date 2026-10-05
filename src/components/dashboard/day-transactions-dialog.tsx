
'use client';

import { useApp } from '@/lib/provider';
import type { Transaction } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface DayTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  transactions: Transaction[];
  excludedCount?: number;
}

type SortKey = 'time' | 'amount';
type SortOrder = 'asc' | 'desc';

export default function DayTransactionsDialog({
  open,
  onOpenChange,
  date,
  transactions,
  excludedCount = 0,
}: DayTransactionsDialogProps) {
  const { categories, editTransaction, deleteTransaction } = useApp();
  const { toast } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editingDateTxId, setEditingDateTxId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<{id: string; description: string; amount: number} | null>(null);

  const getCategoryIcon = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    if (category && category.icon) {
      const Icon = typeof category.icon === 'string' ? () => null : category.icon;
      return <Icon className="w-4 h-4" />;
    }
    return null;
  };
  
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'time') {
        comparison = a.time.localeCompare(b.time);
      } else { // amount
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortKey, sortOrder]);


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Transactions for {date ? format(date, 'PPP') : ''}</DialogTitle>
           <div className="flex justify-between items-center pt-2">
            <DialogDescription>
              Total spent: <span className="font-bold">{formatCurrency(totalAmount)}</span>
              {excludedCount > 0 && (
                <span className="block sm:inline sm:ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                  ({excludedCount} transaction{excludedCount > 1 ? 's' : ''} excluded)
                </span>
              )}
            </DialogDescription>
             <Select value={`${sortKey}-${sortOrder}`} onValueChange={(value) => {
              const [key, order] = value.split('-') as [SortKey, SortOrder];
              setSortKey(key);
              setSortOrder(order);
            }}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time-asc">Time (Ascending)</SelectItem>
                <SelectItem value="time-desc">Time (Descending)</SelectItem>
                <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto max-h-[75vh] pr-1 sm:pr-2 space-y-3 py-2">
          {sortedTransactions.length > 0 ? (
            sortedTransactions.map((transaction) => (
              <div key={transaction.id} className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/30 transition-colors space-y-2">
                {/* Top Row: Avatar + Description & Amount + PaidBy */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {getCategoryIcon(transaction.category)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold text-foreground leading-snug break-words flex-1 min-w-0">{transaction.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-right">
                    <span className="text-sm font-bold text-primary">{formatCurrency(transaction.amount)}</span>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase px-1.5 py-0.5">{transaction.paidBy}</Badge>
                  </div>
                </div>

                {/* Bottom Row: Category info & Action buttons */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/30 text-xs">
                  <div className="flex flex-wrap items-center gap-1 text-muted-foreground flex-1 min-w-0 pr-1">
                    <span className="font-medium text-foreground/80">{transaction.category}</span>
                    {transaction.subcategory && <span>&bull; {transaction.subcategory}</span>}
                    {transaction.microcategory && <span>&bull; {transaction.microcategory}</span>}
                    {transaction.notes && <span className="italic text-muted-foreground/70 truncate max-w-[130px]">({transaction.notes})</span>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Popover open={editingDateTxId === transaction.id} onOpenChange={(isOpen) => setEditingDateTxId(isOpen ? transaction.id : null)}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs font-normal gap-1 hover:border-primary hover:text-primary"
                          title={`Click to change date (Current: ${format(parseISO(transaction.date), 'MMM dd, yyyy')})`}
                        >
                          <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{format(parseISO(transaction.date), 'MMM dd')}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]" align="end" side="bottom">
                        <Calendar
                          mode="single"
                          selected={parseISO(transaction.date)}
                          onSelect={async (newDate) => {
                            if (!newDate) return;
                            const newDateStr = format(newDate, 'yyyy-MM-dd');
                            setEditingDateTxId(null);
                            if (newDateStr === transaction.date) return;
                            try {
                              await editTransaction(transaction.id, {
                                date: newDateStr,
                                time: transaction.time || '12:00',
                                description: transaction.description,
                                amount: transaction.amount,
                                category: transaction.category,
                                subcategory: transaction.subcategory,
                                microcategory: transaction.microcategory || '',
                                paidBy: transaction.paidBy,
                                notes: transaction.notes || '',
                              });
                              toast({
                                title: 'Date Updated',
                                description: `Moved "${transaction.description}" to ${format(newDate, 'PPP')}.`,
                              });
                            } catch (error: any) {
                              toast({
                                title: 'Update Failed',
                                description: error.message || 'Could not update transaction date.',
                                variant: 'destructive',
                              });
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setTransactionToDelete({ id: transaction.id, description: transaction.description, amount: transaction.amount })}
                      title="Delete transaction"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground pt-10">No transactions for this day.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => { if (!open) setTransactionToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>&ldquo;{transactionToDelete?.description}&rdquo;</strong> ({transactionToDelete ? formatCurrency(transactionToDelete.amount) : ''})? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              if (!transactionToDelete) return;
              try {
                await deleteTransaction(transactionToDelete.id);
                toast({ title: 'Transaction Deleted', description: `"${transactionToDelete.description}" has been removed.` });
              } catch (error: any) {
                toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
              } finally {
                setTransactionToDelete(null);
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
