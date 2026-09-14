'use client';

import { useRouter } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PlusCircle, Layers } from 'lucide-react';
import { useApp } from '@/lib/provider';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import AddTransactionSheet from './transactions/add-transaction-sheet';
import { OfflineIndicator } from './OfflineIndicator';

const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
];

export function AppShellHeader() {
  const router = useRouter();
  const { 
    selectedTenantId,
    selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, availableYears,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-2">
      {/* Left: Menu toggle & Date Selectors */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <SidebarTrigger className="h-9 w-9 shrink-0" title="Toggle Navigation Menu" />
        <div className="hidden sm:block h-4 w-px bg-border/70 mx-0.5" />
        <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
          <SelectTrigger className="h-8 sm:h-9 w-[78px] sm:w-[94px] text-xs sm:text-sm px-2 font-medium bg-background shrink-0">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
          <SelectTrigger className="h-8 sm:h-9 w-[105px] sm:w-[130px] text-xs sm:text-sm px-2 font-medium bg-background shrink-0">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map(month => (
              <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: Actions and Status */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        <OfflineIndicator />
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedTenantId}
          onClick={() => router.push('/transactions/group')}
          className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm border-primary/30 text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors shrink-0"
          title="Group Add Transactions"
        >
          <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5 shrink-0" />
          <span className="hidden sm:inline">Group Add</span>
        </Button>
        <AddTransactionSheet>
          <Button
            size="sm"
            disabled={!selectedTenantId}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium shadow-sm cursor-pointer shrink-0"
            title="Add New Transaction"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5 shrink-0" />
            <span>Add<span className="hidden sm:inline"> Transaction</span></span>
          </Button>
        </AddTransactionSheet>
      </div>
    </header>
  );
}
