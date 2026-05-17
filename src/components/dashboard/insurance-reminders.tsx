'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, ShieldCheck, ArrowRight } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, isEqual } from 'date-fns';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import Link from 'next/link';

export default function InsuranceReminders() {
  const { insurances } = useApp();
  const formatCurrency = useCurrencyFormatter();

  const activeReminders = useMemo(() => {
    const today = startOfDay(new Date());
    
    return insurances.filter(policy => {
      if (!policy.reminderDate) return false;
      const reminderDate = startOfDay(parseISO(policy.reminderDate));
      const expiryDate = startOfDay(parseISO(policy.expiryDate));
      
      // Show if today is on or after reminder date, but policy hasn't expired yet
      return (isEqual(today, reminderDate) || isBefore(reminderDate, today)) && !isBefore(expiryDate, today);
    }).sort((a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime());
  }, [insurances]);

  if (activeReminders.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary animate-pulse" />
            Insurance Renewal Alerts
          </CardTitle>
          <Link href="/insurance">
            <Button variant="ghost" size="sm" className="text-xs">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          The following policies are due for renewal based on your reminders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeReminders.map(policy => (
            <div key={policy.id} className="flex items-center justify-between p-3 rounded-lg bg-card border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{policy.provider}</p>
                  <p className="text-xs text-muted-foreground">{policy.type} • Expires {format(parseISO(policy.expiryDate), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{formatCurrency(policy.premiumAmount)}</p>
                <Badge variant="outline" className="text-[10px] uppercase font-bold border-primary/30 text-primary">
                  Renew Now
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
