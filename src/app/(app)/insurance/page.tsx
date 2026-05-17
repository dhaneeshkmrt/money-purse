'use client';

import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ShieldCheck, Car, HeartPulse, LifeBuoy, MoreVertical, Trash2, Edit, AlertTriangle, AlertCircle, Loader2, BellRing } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format, parseISO } from 'date-fns';
import { InsuranceDialog } from '@/components/insurance/insurance-dialog';
import { cn } from '@/lib/utils';
import type { Insurance, InsuranceType } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function InsurancePage() {
  const { insurances, getInsuranceStatus, deleteInsurance, loadingInsurance } = useApp();
  const formatCurrency = useCurrencyFormatter();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState<Insurance | null>(null);

  const stats = useMemo(() => {
    const totalActivePremium = insurances
      .filter(i => getInsuranceStatus(i.expiryDate) !== 'Expired')
      .reduce((sum, i) => sum + i.premiumAmount, 0);
      
    const expiringSoonCount = insurances.filter(i => getInsuranceStatus(i.expiryDate) === 'Expiring Soon').length;
    const expiredCount = insurances.filter(i => getInsuranceStatus(i.expiryDate) === 'Expired').length;
    
    return { totalActivePremium, expiringSoonCount, expiredCount, totalCount: insurances.length };
  }, [insurances, getInsuranceStatus]);

  const getStatusInfo = (expiryDate: string) => {
    const status = getInsuranceStatus(expiryDate);
    switch (status) {
      case 'Expired': return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'Expiring Soon': return { label: 'Expiring Soon', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
      default: return { label: 'Active', color: 'bg-green-500/10 text-green-500 border-green-500/20' };
    }
  };

  const getTypeIcon = (type: InsuranceType) => {
    switch (type) {
      case 'Motor': return <Car className="h-5 w-5" />;
      case 'Health': return <HeartPulse className="h-5 w-5" />;
      case 'Term':
      case 'Life': return <LifeBuoy className="h-5 w-5" />;
      default: return <ShieldCheck className="h-5 w-5" />;
    }
  };

  const handleEdit = (insurance: Insurance) => {
    setSelectedInsurance(insurance);
    setDialogOpen(true);
  };

  if (loadingInsurance) return (
    <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Insurance Tracker</h1>
          <p className="text-muted-foreground">Monitor your policies and never miss a renewal deadline.</p>
        </div>
        <Button onClick={() => { setSelectedInsurance(null); setDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Annual Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalActivePremium)}</div>
            <p className="text-xs text-muted-foreground">Across {stats.totalCount} policies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-500">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.expiringSoonCount}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.expiredCount}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Coverage Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(((stats.totalCount - stats.expiredCount) / Math.max(1, stats.totalCount)) * 100)}%</div>
            <div className="w-full bg-secondary h-1 mt-2 rounded-full overflow-hidden">
                <div 
                    className="bg-primary h-full transition-all" 
                    style={{ width: `${((stats.totalCount - stats.expiredCount) / Math.max(1, stats.totalCount)) * 100}%` }} 
                />
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.expiringSoonCount > 0 && (
          <Alert className="bg-orange-500/5 border-orange-500/20 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                  You have {stats.expiringSoonCount} policies expiring soon. Please review and initiate renewals to avoid coverage gaps.
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {insurances.map(policy => {
          const statusInfo = getStatusInfo(policy.expiryDate);
          return (
            <Card key={policy.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {getTypeIcon(policy.type)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(policy)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <DropdownMenuItem className="text-destructive" onSelect={e => e.preventDefault()}>
                             <Trash2 className="mr-2 h-4 w-4" /> Delete
                           </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Policy?</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to remove the policy from <strong>{policy.provider}</strong>? This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteInsurance(policy.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <CardTitle className="text-lg">{policy.provider}</CardTitle>
                  <Badge variant="outline" className={cn("text-[10px] py-0", statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs mt-1"># {policy.policyNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Type</div>
                    <div className="text-sm font-medium">{policy.type}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Premium</div>
                    <div className="text-sm font-bold text-primary">{formatCurrency(policy.premiumAmount)}</div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Expires On</div>
                    <div className={cn("text-sm font-semibold", getInsuranceStatus(policy.expiryDate) !== 'Active' ? "text-destructive" : "")}>
                        {format(parseISO(policy.expiryDate), 'dd MMM yyyy')}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <BellRing className="h-3 w-3" /> Reminder
                    </div>
                    <div className="text-xs font-medium text-primary">
                        {policy.reminderDate ? format(parseISO(policy.reminderDate), 'dd MMM yyyy') : 'No reminder'}
                    </div>
                  </div>
                </div>

                {policy.notes && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Notes</div>
                    <p className="text-xs text-muted-foreground italic line-clamp-2">{policy.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {insurances.length === 0 && (
            <Card className="col-span-full py-16 text-center text-muted-foreground border-dashed">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <h3 className="text-lg font-medium text-foreground">No insurance policies found</h3>
                <p className="max-w-xs mx-auto mb-6">Start tracking your coverage. Use our AI scanner to quickly add your existing policies.</p>
                <Button onClick={() => setDialogOpen(true)} variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Policy
                </Button>
            </Card>
        )}
      </div>

      <InsuranceDialog open={dialogOpen} setOpen={setDialogOpen} insurance={selectedInsurance} />
    </div>
  );
}
