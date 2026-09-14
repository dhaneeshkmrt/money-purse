'use client';

import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PlusCircle, 
  HandCoins, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Trash2, 
  Edit, 
  History, 
  Archive, 
  ArchiveRestore, 
  CheckCircle2,
  CheckCheck
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { BorrowingDialog } from '@/components/borrowings/borrowing-dialog';
import { RepaymentHistoryDialog } from '@/components/borrowings/repayment-dialog';
import { RecordPaymentDialog } from '@/components/borrowings/record-payment-dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Borrowing } from '@/lib/types';

export default function BorrowingsPage() {
  const { 
    borrowings, 
    getBorrowingStatus, 
    deleteBorrowing, 
    closeBorrowing,
    closeAllZeroBalanceBorrowings,
    loadingBorrowings, 
    borrowingRepayments 
  } = useApp();
  const formatCurrency = useCurrencyFormatter();
  const { toast } = useToast();
  
  const [borrowingDialogOpen, setBorrowingDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [showClosedInActive, setShowClosedInActive] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<string | null>(null);
  const [editingBorrowing, setEditingBorrowing] = useState<Borrowing | null>(null);

  const stats = useMemo(() => {
    // Logic: Total Lent excludes "Written Off" records as they are technically losses
    const totalLent = borrowings
      .filter(b => b.type === 'Lent' && !b.isClosed && getBorrowingStatus(b) !== 'Written Off')
      .reduce((sum, b) => sum + b.balance, 0);
      
    const totalBorrowed = borrowings.filter(b => b.type === 'Borrowed' && !b.isClosed).reduce((sum, b) => sum + b.balance, 0);
    const activeLentCount = borrowings.filter(b => b.type === 'Lent' && !b.isClosed && getBorrowingStatus(b) !== 'Written Off').length;
    const activeBorrowedCount = borrowings.filter(b => b.type === 'Borrowed' && !b.isClosed).length;
    
    return { totalLent, totalBorrowed, activeLentCount, activeBorrowedCount };
  }, [borrowings, getBorrowingStatus]);

  const zeroBalanceUnclosed = useMemo(() => {
    return borrowings.filter(b => b.balance <= 0 && !b.isClosed);
  }, [borrowings]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Settled': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Active': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Overdue': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Sub-Standard': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'NPA': return 'bg-red-500/10 text-red-500 border-red-500/20 font-bold';
      case 'Written Off': return 'bg-gray-500/10 text-gray-500 border-gray-500/20 grayscale';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleViewHistory = (id: string) => {
    setSelectedBorrowingId(id);
    setHistoryDialogOpen(true);
  };

  const handleRecordPayment = (id: string) => {
    setSelectedBorrowingId(id);
    setRecordPaymentDialogOpen(true);
  };

  const handleEditBorrowing = (borrowing: Borrowing) => {
    setEditingBorrowing(borrowing);
    setBorrowingDialogOpen(true);
  };

  const handleCloseBorrowing = async (id: string, isClosed: boolean) => {
    try {
      await closeBorrowing(id, isClosed);
      toast({
        title: isClosed ? 'Borrowing Archived' : 'Borrowing Reopened',
        description: isClosed 
          ? 'Borrowing has been closed and archived.' 
          : 'Borrowing has been reopened and restored to active list.'
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to update borrowing status',
        variant: 'destructive'
      });
    }
  };

  const handleArchiveAllZeroBalance = async () => {
    if (zeroBalanceUnclosed.length === 0) return;
    try {
      setIsArchiving(true);
      await closeAllZeroBalanceBorrowings();
      toast({
        title: 'Zero Balance Borrowings Archived',
        description: `Successfully archived ${zeroBalanceUnclosed.length} borrowing(s).`
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to archive zero-balance borrowings',
        variant: 'destructive'
      });
    } finally {
      setIsArchiving(false);
    }
  };

  if (loadingBorrowings) return <div className="p-8 text-center">Loading borrowings...</div>;

  const lentRecords = borrowings.filter(b => 
    b.type === 'Lent' && 
    (showClosedInActive || !b.isClosed) && 
    getBorrowingStatus(b) !== 'Written Off'
  );
  const borrowedRecords = borrowings.filter(b => 
    b.type === 'Borrowed' && 
    (showClosedInActive || !b.isClosed)
  );
  const closedRecords = borrowings.filter(b => b.isClosed);
  const writtenOffRecords = borrowings.filter(b => b.type === 'Lent' && getBorrowingStatus(b) === 'Written Off');

  const renderTable = (records: Borrowing[], emptyMessage: string, showType = false) => (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              {showType && <TableHead>Type</TableHead>}
              <TableHead>Amount</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Due / Closed Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((borrowing) => {
              const status = getBorrowingStatus(borrowing);
              const paidPercent = borrowing.amount > 0 
                ? Math.min(100, Math.round(((borrowing.amount - borrowing.balance) / borrowing.amount) * 100))
                : 100;
              const hasHistory = borrowingRepayments.some(r => r.borrowingId === borrowing.id);
              const isZeroBalance = borrowing.balance <= 0;
              
              return (
                <TableRow key={borrowing.id} className={cn(borrowing.isClosed && "opacity-60", status === 'Written Off' && "opacity-50 grayscale bg-muted/20")}>
                  <TableCell>
                    <div className="font-medium">{borrowing.contactName}</div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(borrowing.startDate), 'dd MMM yyyy')}</div>
                  </TableCell>
                  {showType && (
                    <TableCell>
                      <Badge variant="outline" className={borrowing.type === 'Lent' ? 'border-green-500/30 text-green-600 dark:text-green-400' : 'border-blue-500/30 text-blue-600 dark:text-blue-400'}>
                        {borrowing.type}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>{formatCurrency(borrowing.amount)}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-primary">{formatCurrency(borrowing.balance)}</div>
                    <div className="w-24 mt-1">
                      <Progress value={paidPercent} className="h-1" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {borrowing.isClosed && borrowing.closedAt ? (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Closed: </span>
                        <span className="font-medium">{format(parseISO(borrowing.closedAt), 'dd MMM yyyy')}</span>
                      </div>
                    ) : (
                      <div className={cn("text-sm", !borrowing.isClosed && !['Active', 'Settled'].includes(status) && "text-destructive font-semibold")}>
                        {format(parseISO(borrowing.dueDate), 'dd MMM yyyy')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEditBorrowing(borrowing)} title="Edit Record">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {hasHistory && (
                      <Button size="sm" variant="ghost" onClick={() => handleViewHistory(borrowing.id)} title="View Payment History">
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                    {!borrowing.isClosed && isZeroBalance && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-primary hover:bg-primary/10 gap-1 h-8 px-2 text-xs" 
                        onClick={() => handleCloseBorrowing(borrowing.id, true)} 
                        title="Archive/Close zero balance borrowing"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    )}
                    {borrowing.isClosed && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-muted-foreground hover:text-foreground gap-1 h-8 px-2 text-xs" 
                        onClick={() => handleCloseBorrowing(borrowing.id, false)} 
                        title="Reopen borrowing"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Reopen
                      </Button>
                    )}
                    {!borrowing.isClosed && !isZeroBalance && status !== 'Written Off' && (
                      <Button size="sm" variant="outline" onClick={() => handleRecordPayment(borrowing.id)}>
                        Log Pay
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteBorrowing(borrowing.id)} title="Delete Record">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={showType ? 7 : 6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <HandCoins className="h-8 w-8 opacity-20" />
                    <p>{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Borrowings Dashboard</h1>
          <p className="text-muted-foreground">Track money lent to and borrowed from your network.</p>
        </div>
        <Button onClick={() => { setEditingBorrowing(null); setBorrowingDialogOpen(true); }} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Record Debt
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(stats.totalLent)}</div>
            <p className="text-xs text-muted-foreground">Excludes written off losses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Payables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(stats.totalBorrowed)}</div>
            <p className="text-xs text-muted-foreground">To {stats.activeBorrowedCount} active borrow records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              NPA / Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(borrowings.filter(b => b.type === 'Lent' && ['NPA', 'Overdue'].includes(getBorrowingStatus(b))).reduce((s, b) => s + b.balance, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              Recovery Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalLent > 0 ? Math.round(((stats.totalLent - borrowings.filter(b => b.type === 'Lent' && getBorrowingStatus(b) === 'NPA').reduce((s, b) => s + b.balance, 0)) / stats.totalLent) * 100) : 100}%
            </div>
            <Progress value={85} className="h-1 mt-2" />
          </CardContent>
        </Card>
      </div>

      {zeroBalanceUnclosed.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">
                {zeroBalanceUnclosed.length} debt{zeroBalanceUnclosed.length > 1 ? 's have' : ' has'} zero balance
              </p>
              <p className="text-xs text-muted-foreground">
                You have settled borrowings that can be archived to keep your dashboard clean.
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={handleArchiveAllZeroBalance} 
            disabled={isArchiving}
            className="w-full sm:w-auto gap-2 shrink-0"
          >
            <Archive className="h-4 w-4" />
            Archive All Zero Balance ({zeroBalanceUnclosed.length})
          </Button>
        </div>
      )}

      <Tabs defaultValue="lent" className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto h-auto p-1 gap-1">
            <TabsTrigger value="lent" className="gap-1.5 py-2">
              Money Lent
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {borrowings.filter(b => b.type === 'Lent' && !b.isClosed && getBorrowingStatus(b) !== 'Written Off').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="borrowed" className="gap-1.5 py-2">
              Money Borrowed
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {borrowings.filter(b => b.type === 'Borrowed' && !b.isClosed).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="closed" className="gap-1.5 py-2">
              Closed / Archived
              {closedRecords.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal bg-green-500/10 text-green-600 dark:text-green-400">
                  {closedRecords.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="writtenoff" className="relative gap-1.5 py-2">
              Written Off
              {writtenOffRecords.length > 0 && (
                <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive h-4 px-1 min-w-[1rem] flex items-center justify-center text-[10px]">
                  {writtenOffRecords.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Button 
            variant={showClosedInActive ? "secondary" : "outline"} 
            size="sm" 
            onClick={() => setShowClosedInActive(prev => !prev)}
            className="w-full sm:w-auto gap-2 text-xs h-9 shrink-0"
            title="Toggle whether closed borrowings are also shown inside the active Money Lent and Money Borrowed tabs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {showClosedInActive ? "Hiding Settled in Active" : "Show Settled in Active"}
          </Button>
        </div>
        
        <TabsContent value="lent">
          {renderTable(lentRecords, "No active lending records found.")}
        </TabsContent>

        <TabsContent value="borrowed">
          {renderTable(borrowedRecords, "No borrowing records found.")}
        </TabsContent>

        <TabsContent value="closed">
          {renderTable(closedRecords, "No closed or archived borrowings found.", true)}
        </TabsContent>

        <TabsContent value="writtenoff">
          <div className="mb-4">
            <AlertCircle className="inline-block mr-2 h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground italic">
              These are debts older than 180 days past due date and are considered non-recoverable losses.
            </span>
          </div>
          {renderTable(writtenOffRecords, "No written-off records found.")}
        </TabsContent>
      </Tabs>

      <BorrowingDialog 
        open={borrowingDialogOpen} 
        setOpen={setBorrowingDialogOpen} 
        borrowing={editingBorrowing} 
      />
      
      <RepaymentHistoryDialog 
        open={historyDialogOpen} 
        setOpen={setHistoryDialogOpen} 
        borrowingId={selectedBorrowingId} 
      />

      <RecordPaymentDialog 
        open={recordPaymentDialogOpen} 
        setOpen={setRecordPaymentDialogOpen} 
        borrowingId={selectedBorrowingId} 
      />
    </div>
  );
}
