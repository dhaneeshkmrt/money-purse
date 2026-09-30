'use client';

import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  ShieldCheck,
  Car,
  HeartPulse,
  LifeBuoy,
  MoreVertical,
  Trash2,
  Edit,
  AlertTriangle,
  AlertCircle,
  Loader2,
  BellRing,
  Smartphone,
  Bell,
  RotateCw,
  CheckCircle2,
  History,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format, parseISO } from 'date-fns';
import { InsuranceDialog } from '@/components/insurance/insurance-dialog';
import { RenewInsuranceDialog } from '@/components/insurance/renew-insurance-dialog';
import { cn } from '@/lib/utils';
import type { Insurance, InsuranceType } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getNotificationPermission,
  requestNotificationPermission,
  isMobileReminderEnabled,
  setMobileReminderEnabled,
  getNextSaturday9AM,
  sendInsuranceNotification,
} from '@/lib/insurance-notifications';

export default function InsurancePage() {
  const { insurances, getInsuranceStatus, deleteInsurance, loadingInsurance } = useApp();
  const formatCurrency = useCurrencyFormatter();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState<Insurance | null>(null);

  // Renewal dialog state
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedForRenewal, setSelectedForRenewal] = useState<Insurance | null>(null);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [nextSaturday, setNextSaturday] = useState<Date>(getNextSaturday9AM());
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNotifPermission(getNotificationPermission());
    setRemindersEnabled(isMobileReminderEnabled());
    setNextSaturday(getNextSaturday9AM());
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setMobileReminderEnabled(true);
      setRemindersEnabled(true);
      toast({
        title: 'Mobile Reminders Active',
        description: 'You will receive mobile reminders every 7 days on Saturday at 9:00 AM.',
      });
      await sendInsuranceNotification({ policies: insurances, isTest: true });
    } else if (perm === 'denied') {
      toast({
        title: 'Notifications Blocked',
        description: 'Please enable notifications for this site in your phone or browser settings.',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    const success = await sendInsuranceNotification({ policies: insurances, isTest: true });
    setIsSendingTest(false);
    if (success) {
      toast({
        title: 'Mobile Alert Sent',
        description: 'Check your phone or browser notification tray to see the alert.',
      });
    } else {
      toast({
        title: 'Could Not Send Alert',
        description: 'Ensure notifications are allowed in your browser settings.',
        variant: 'destructive',
      });
    }
  };

  const stats = useMemo(() => {
    const totalActivePremium = insurances
      .filter((i) => getInsuranceStatus(i.expiryDate, i.isRenewed) !== 'Expired')
      .reduce((sum, i) => sum + i.premiumAmount, 0);

    const expiringSoonCount = insurances.filter(
      (i) => getInsuranceStatus(i.expiryDate, i.isRenewed) === 'Expiring Soon'
    ).length;
    const expiredCount = insurances.filter(
      (i) => getInsuranceStatus(i.expiryDate, i.isRenewed) === 'Expired'
    ).length;
    const renewedCount = insurances.filter(
      (i) => i.isRenewed || (i.renewalHistory && i.renewalHistory.length > 0)
    ).length;

    return { totalActivePremium, expiringSoonCount, expiredCount, renewedCount, totalCount: insurances.length };
  }, [insurances, getInsuranceStatus]);

  const getStatusInfo = (policy: Insurance) => {
    const status = getInsuranceStatus(policy.expiryDate, policy.isRenewed);
    switch (status) {
      case 'Expired':
        return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'Expiring Soon':
        return { label: 'Expiring Soon', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
      case 'Renewed':
        return { label: 'Renewed', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' };
      default:
        return { label: 'Active', color: 'bg-green-500/10 text-green-500 border-green-500/20' };
    }
  };

  const getTypeIcon = (type: InsuranceType) => {
    switch (type) {
      case 'Motor':
        return <Car className="h-5 w-5" />;
      case 'Health':
        return <HeartPulse className="h-5 w-5" />;
      case 'Term':
      case 'Life':
        return <LifeBuoy className="h-5 w-5" />;
      default:
        return <ShieldCheck className="h-5 w-5" />;
    }
  };

  const handleEdit = (insurance: Insurance) => {
    setSelectedInsurance(insurance);
    setDialogOpen(true);
  };

  const handleRenewClick = (insurance: Insurance) => {
    setSelectedForRenewal(insurance);
    setRenewDialogOpen(true);
  };

  if (loadingInsurance)
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Insurance Tracker</h1>
          <p className="text-muted-foreground">Monitor your policies, track renewals, and view full term history.</p>
        </div>
        <Button
          onClick={() => {
            setSelectedInsurance(null);
            setDialogOpen(true);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <p className="text-xs text-muted-foreground">Within 60 days</p>
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
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Renewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.renewedCount}</div>
            <p className="text-xs text-muted-foreground">History preserved</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Coverage Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                ((stats.totalCount - stats.expiredCount) / Math.max(1, stats.totalCount)) * 100
              )}
              %
            </div>
            <div className="w-full bg-secondary h-1 mt-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all"
                style={{
                  width: `${
                    ((stats.totalCount - stats.expiredCount) / Math.max(1, stats.totalCount)) * 100
                  }%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.expiringSoonCount > 0 && (
        <Alert className="bg-orange-500/5 border-orange-500/20 text-orange-600">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            You have {stats.expiringSoonCount} policies expiring soon. Use the &ldquo;Renew&rdquo; button to renew and archive expired details.
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile Reminders Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card shadow-sm text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">Mobile Reminders</span>
              <span className="text-muted-foreground">· Every 7 days (Saturday 9:00 AM)</span>
              {notifPermission === 'granted' && remindersEnabled ? (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-4 border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10 gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Active · Next: {format(nextSaturday, 'EEE, MMM dd · 9:00 a')}
                </Badge>
              ) : notifPermission === 'denied' ? (
                <Badge variant="destructive" className="text-[10px] py-0 h-4">
                  Permission Blocked
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                  Setup Needed
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sends phone push notification alerts every Saturday morning at 9:00 AM for policies approaching renewal or porting deadlines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {notifPermission === 'granted' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleTestNotification}
              disabled={isSendingTest}
            >
              <Bell className="h-3.5 w-3.5" />
              {isSendingTest ? 'Sending...' : 'Test Mobile Alert'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
              onClick={handleEnableNotifications}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Enable Saturday 9 AM Reminders
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {insurances.map((policy) => {
          const statusInfo = getStatusInfo(policy);
          const history = policy.renewalHistory || [];

          return (
            <Card key={policy.id} className="overflow-hidden flex flex-col justify-between">
              <div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {getTypeIcon(policy.type)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1 font-medium"
                        onClick={() => handleRenewClick(policy)}
                        title="Renew Policy"
                      >
                        <RotateCw className="h-3 w-3" /> Renew
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRenewClick(policy)}>
                            <RotateCw className="mr-2 h-4 w-4 text-emerald-600" /> Renew Policy
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(policy)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Policy
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Policy?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove the policy {policy.name ? `"${policy.name}" ` : ''}from <strong>{policy.provider}</strong>?
                                  All renewal history will also be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteInsurance(policy.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg leading-snug">
                        {policy.name || policy.provider}
                      </CardTitle>
                      <Badge variant="outline" className={cn('text-[10px] py-0', statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                      {policy.isRenewed && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        >
                          Renewed {policy.renewalCount ? `(${policy.renewalCount}x)` : ''}
                        </Badge>
                      )}
                    </div>
                    {policy.name ? (
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">
                        {policy.provider}
                      </div>
                    ) : null}
                  </div>
                  <CardDescription className="font-mono text-xs mt-1">
                    # {policy.policyNumber}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
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
                      <div
                        className={cn(
                          'text-sm font-semibold',
                          getInsuranceStatus(policy.expiryDate, policy.isRenewed) === 'Expired'
                            ? 'text-destructive'
                            : getInsuranceStatus(policy.expiryDate, policy.isRenewed) === 'Expiring Soon'
                            ? 'text-orange-600'
                            : getInsuranceStatus(policy.expiryDate, policy.isRenewed) === 'Renewed'
                            ? 'text-emerald-600'
                            : ''
                        )}
                      >
                        {format(parseISO(policy.expiryDate), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <BellRing className="h-3 w-3" /> Reminder
                      </div>
                      <div className="text-xs font-medium text-primary">
                        {policy.reminderDate
                          ? format(parseISO(policy.reminderDate), 'dd MMM yyyy')
                          : '60 days before'}
                      </div>
                    </div>
                  </div>

                  {/* Previous Term Notice & Renewal History */}
                  {policy.previousExpiryDate && (
                    <div className="pt-2 border-t text-[11px] text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <History className="h-3 w-3 text-emerald-600" />
                          Previous Term Ended:
                        </span>
                        <span>{format(parseISO(policy.previousExpiryDate), 'dd MMM yyyy')}</span>
                      </div>
                      {history.length > 0 && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {history.length} expired term{history.length > 1 ? 's' : ''} preserved under this policy history.
                        </p>
                      )}
                    </div>
                  )}

                  {policy.notes && (
                    <div className="pt-2 border-t">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Notes</div>
                      <p className="text-xs text-muted-foreground italic line-clamp-2">{policy.notes}</p>
                    </div>
                  )}
                </CardContent>
              </div>
            </Card>
          );
        })}
        {insurances.length === 0 && (
          <Card className="col-span-full py-16 text-center text-muted-foreground border-dashed">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-10" />
            <h3 className="text-lg font-medium text-foreground">No insurance policies found</h3>
            <p className="max-w-xs mx-auto mb-6">
              Start tracking your coverage. Use our AI scanner to quickly add your existing policies.
            </p>
            <Button onClick={() => setDialogOpen(true)} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Policy
            </Button>
          </Card>
        )}
      </div>

      <InsuranceDialog open={dialogOpen} setOpen={setDialogOpen} insurance={selectedInsurance} />
      <RenewInsuranceDialog
        open={renewDialogOpen}
        setOpen={setRenewDialogOpen}
        insurance={selectedForRenewal}
      />
    </div>
  );
}
