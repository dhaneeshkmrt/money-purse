'use client';

import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ShieldCheck, Calendar, Car, HeartPulse, LifeBuoy, MoreVertical, Trash2, Edit, FileText, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format, parseISO } from 'date-fns';
import { InsuranceDialog } from '@/components/insurance/insurance-dialog';
import { cn } from '@/lib/utils';
import type { Insurance, InsuranceType, InsuranceStatus } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Image from 'next/image';

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
      case 'Expired': return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle };
      case 'Expiring Soon': return { label: 'Expiring Soon', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: Clock };
      default: return { label: 'Active', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: ShieldCheck };
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
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Term</div>
                    <div className="text-xs">{format(parseISO(policy.startDate), 'MMM yy')} - {format(parseISO(policy.expiryDate), 'MMM yy')}</div>
                  </div>
                </div>

                {policy.documentBase64 && (
                    <div className="relative h-32 w-full rounded-md border overflow-hidden group cursor-pointer" onClick={() => {
                        const win = window.open();
                        win?.document.write(`<iframe src="${policy.documentBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                    }}>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button variant="secondary" size="sm"><FileText className="mr-2 h-4 w-4" /> View Document</Button>
                        </div>
                        {policy.documentBase64.startsWith('data:image') ? (
                            <Image src={policy.documentBase64} alt="Policy Preview" fill className="object-cover grayscale group-hover:grayscale-0 transition-all" />
                        ) : (
                            <div className="h-full w-full bg-muted flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
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

function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
