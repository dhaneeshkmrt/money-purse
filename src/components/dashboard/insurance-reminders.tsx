'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BellRing,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  HeartPulse,
  Car,
  LifeBuoy,
  Clock,
  Plus,
  Edit,
  FileCheck2,
  Smartphone,
  Bell,
  RotateCw,
  CheckCircle2,
  History,
} from 'lucide-react';
import { format, parseISO, startOfDay, differenceInDays } from 'date-fns';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Insurance, InsuranceType } from '@/lib/types';
import { InsuranceDialog } from '@/components/insurance/insurance-dialog';
import { RenewInsuranceDialog } from '@/components/insurance/renew-insurance-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  isMobileReminderEnabled,
  setMobileReminderEnabled,
  getNextSaturday9AM,
  shouldSendReminderNow,
  sendInsuranceNotification,
} from '@/lib/insurance-notifications';

function getTypeIcon(type: InsuranceType) {
  switch (type) {
    case 'Motor':
      return <Car className="h-4 w-4" />;
    case 'Health':
      return <HeartPulse className="h-4 w-4" />;
    case 'Term':
    case 'Life':
      return <LifeBuoy className="h-4 w-4" />;
    default:
      return <ShieldCheck className="h-4 w-4" />;
  }
}

export default function InsuranceReminders() {
  const { insurances } = useApp();
  const formatCurrency = useCurrencyFormatter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | '30' | '45' | '60' | 'renewed'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState<Insurance | null>(null);

  // Renewal dialog state
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedForRenewal, setSelectedForRenewal] = useState<Insurance | null>(null);

  // Mobile notification state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [nextSaturday, setNextSaturday] = useState<Date>(getNextSaturday9AM());
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Check notification permission and schedule Saturday 9:00 AM timer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setNotifPermission(getNotificationPermission());
    setRemindersEnabled(isMobileReminderEnabled());
    setNextSaturday(getNextSaturday9AM());

    // If notification is due right now (e.g. today is Saturday >= 9 AM or >= 7 days passed)
    if (shouldSendReminderNow() && insurances.length > 0) {
      sendInsuranceNotification({ policies: insurances });
    }

    // Schedule notification for Saturday 9:00 AM
    const msUntilTarget = getNextSaturday9AM().getTime() - Date.now();
    const timer = setTimeout(() => {
      if (shouldSendReminderNow() && insurances.length > 0) {
        sendInsuranceNotification({ policies: insurances });
      }
      setNextSaturday(getNextSaturday9AM());
    }, Math.max(1000, msUntilTarget));

    return () => clearTimeout(timer);
  }, [insurances]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setMobileReminderEnabled(true);
      setRemindersEnabled(true);
      toast({
        title: 'Mobile Reminders Active',
        description: 'You will receive mobile notifications every 7 days on Saturday at 9:00 AM.',
      });
      // Send confirmation test notification
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

  // Group policies into categories, sorted earliest to expire at the top
  const { allExpiring, thirtyDays, fortyFiveDays, sixtyDays, renewedPolicies } = useMemo(() => {
    const today = startOfDay(new Date());

    // Active expiring policies:
    // Once renewed for a new term (+1 year), its new expiryDate is > 60 days away,
    // so it is automatically removed from active expiry reminder windows (30, 45, 60 days).
    const validPolicies = insurances.filter((policy) => {
      if (!policy.expiryDate) return false;
      const expiryDate = startOfDay(parseISO(policy.expiryDate));
      const days = differenceInDays(expiryDate, today);
      return days <= 60 && days >= -60;
    });

    // Sort earliest to expire at the top
    const sorted = [...validPolicies].sort(
      (a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime()
    );

    const thirty: Insurance[] = [];
    const fortyFive: Insurance[] = [];
    const sixty: Insurance[] = [];

    sorted.forEach((policy) => {
      const days = differenceInDays(startOfDay(parseISO(policy.expiryDate)), today);
      if (days <= 30) {
        thirty.push(policy);
      } else if (days <= 45) {
        fortyFive.push(policy);
      } else {
        sixty.push(policy);
      }
    });

    // Policies that have been renewed
    const renewed = insurances.filter(
      (p) => p.isRenewed || (p.renewalHistory && p.renewalHistory.length > 0)
    );

    return {
      allExpiring: sorted,
      thirtyDays: thirty,
      fortyFiveDays: fortyFive,
      sixtyDays: sixty,
      renewedPolicies: renewed,
    };
  }, [insurances]);

  const handleEdit = (policy: Insurance) => {
    setSelectedInsurance(policy);
    setDialogOpen(true);
  };

  const handleRenewClick = (policy: Insurance, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedForRenewal(policy);
    setRenewDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedInsurance(null);
    setDialogOpen(true);
  };

  const renderPolicyItem = (policy: Insurance, isRenewedTab = false) => {
    const today = startOfDay(new Date());
    const expiryDate = startOfDay(parseISO(policy.expiryDate));
    const days = differenceInDays(expiryDate, today);
    const isExpired = days < 0;
    const is30Days = days <= 30;
    const is45Days = days > 30 && days <= 45;

    return (
      <div
        key={policy.id}
        onClick={() => handleEdit(policy)}
        className={cn(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border shadow-sm transition-colors cursor-pointer group hover:border-primary/40',
          isRenewedTab || (policy.isRenewed && days > 60)
            ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 dark:bg-emerald-950/20'
            : isExpired
            ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10'
            : is30Days
            ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 dark:bg-red-950/20'
            : is45Days
            ? 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 dark:bg-blue-950/20'
            : 'bg-card hover:bg-muted/40'
        )}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={cn(
              'p-2 rounded-full shrink-0 mt-0.5 sm:mt-0',
              isRenewedTab || (policy.isRenewed && days > 60)
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : isExpired
                ? 'bg-destructive/20 text-destructive'
                : is30Days
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : is45Days
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            )}
          >
            {isRenewedTab || (policy.isRenewed && days > 60) ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isExpired ? (
              <AlertTriangle className="h-4 w-4" />
            ) : is45Days ? (
              <FileCheck2 className="h-4 w-4" />
            ) : (
              getTypeIcon(policy.type)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {policy.name ? (
                <>
                  <p className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                    {policy.name}
                  </p>
                  <span className="text-xs text-muted-foreground font-normal">
                    ({policy.provider})
                  </span>
                </>
              ) : (
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {policy.provider}
                </p>
              )}
              {policy.policyNumber && (
                <span className="text-xs font-mono text-muted-foreground">
                  #{policy.policyNumber}
                </span>
              )}
              {policy.isRenewed && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                >
                  Renewed {policy.renewalCount ? `(${policy.renewalCount}x)` : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground">{policy.type}</span>
              <span>•</span>
              {isRenewedTab || (policy.isRenewed && days > 60) ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Active renewed term · Next expiry: {format(expiryDate, 'dd MMM yyyy')} ({days} days)
                </span>
              ) : isExpired ? (
                <span className="text-destructive font-semibold">
                  Expired {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} ago ({format(expiryDate, 'dd MMM yyyy')})
                </span>
              ) : days === 0 ? (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  Expires today ({format(expiryDate, 'dd MMM yyyy')})
                </span>
              ) : (
                <span
                  className={cn(
                    'font-medium',
                    is30Days
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : is45Days
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  Expires in {days} day{days === 1 ? '' : 's'} ({format(expiryDate, 'dd MMM yyyy')})
                </span>
              )}
            </div>

            {/* Display historical term notice if renewed */}
            {policy.previousExpiryDate && (
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <History className="h-3 w-3" />
                Previous term ended {format(parseISO(policy.previousExpiryDate), 'dd MMM yyyy')} (archived in history)
              </p>
            )}

            {/* Porting notice badge if policy is in 45-day window */}
            {!isRenewedTab && is45Days && (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1 flex items-center gap-1">
                <span>⚡ Ready for Porting:</span> apply now to switch insurers without losing cumulative benefits.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <p className="text-sm font-bold text-primary">{formatCurrency(policy.premiumAmount)}</p>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Status Badges */}
            {isRenewedTab || (policy.isRenewed && days > 60) ? (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              >
                Renewed
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                Expired
              </Badge>
            ) : is30Days ? (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10"
              >
                ≤ 30 Days · Renew Now
              </Badge>
            ) : is45Days ? (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
              >
                45 Days · Ready for Porting
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              >
                60 Days · Upcoming
              </Badge>
            )}

            {/* Quick Renew Button */}
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-xs"
              onClick={(e) => handleRenewClick(policy, e)}
              title="Renew Policy for next year"
            >
              <RotateCw className="h-3 w-3" />
              Renew
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(policy);
              }}
              title="Edit Policy"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BellRing className="h-5 w-5 text-orange-500 animate-pulse" />
                Insurance Expiry Tracker
              </CardTitle>
              <CardDescription>
                Track upcoming policy renewals in 3 key windows (30 days, 45 days for porting, 60 days). Early to expire shown at the top.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleAddNew}>
                <Plus className="h-3.5 w-3.5" /> Add Policy
              </Button>
              <Link href="/insurance">
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile Notification Reminder Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg border bg-muted/40 text-xs mt-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground">Mobile Reminders:</span>
                  <span className="text-muted-foreground">Every 7 days (Saturday 9:00 AM)</span>
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
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sends phone push notification alerts every Saturday morning at 9:00 AM for policies approaching renewal or porting deadlines.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {notifPermission === 'granted' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleTestNotification}
                  disabled={isSendingTest}
                >
                  <Bell className="h-3 w-3" />
                  {isSendingTest ? 'Sending...' : 'Test Mobile Alert'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-primary text-primary-foreground"
                  onClick={handleEnableNotifications}
                >
                  <Smartphone className="h-3 w-3" />
                  Enable Saturday 9 AM Reminders
                </Button>
              )}
            </div>
          </div>

          {/* Category Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3">
            {/* 30 Days Card */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === '30' ? 'all' : '30')}
              className={cn(
                'flex flex-col p-3 rounded-lg border text-left transition-all',
                activeTab === '30'
                  ? 'border-red-500 bg-red-500/10 dark:bg-red-950/30 ring-1 ring-red-500'
                  : 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10 dark:bg-red-950/15'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                  1. ≤ 30 Days
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10"
                >
                  Urgent
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {thirtyDays.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {thirtyDays.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Immediate renewal needed
              </p>
            </button>

            {/* 45 Days (Ready for Porting) Card */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === '45' ? 'all' : '45')}
              className={cn(
                'flex flex-col p-3 rounded-lg border text-left transition-all',
                activeTab === '45'
                  ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-950/30 ring-1 ring-blue-500'
                  : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-950/15'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  2. 45 Days
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                >
                  Porting
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {fortyFiveDays.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fortyFiveDays.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ready for Porting
              </p>
            </button>

            {/* 60 Days Card */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === '60' ? 'all' : '60')}
              className={cn(
                'flex flex-col p-3 rounded-lg border text-left transition-all',
                activeTab === '60'
                  ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-950/30 ring-1 ring-amber-500'
                  : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-950/15'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  3. 60 Days
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                >
                  Upcoming
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {sixtyDays.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {sixtyDays.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Upcoming renewal
              </p>
            </button>

            {/* Renewed Card */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'renewed' ? 'all' : 'renewed')}
              className={cn(
                'flex flex-col p-3 rounded-lg border text-left transition-all',
                activeTab === 'renewed'
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/15'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Renewed
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                >
                  Active
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {renewedPolicies.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {renewedPolicies.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Successfully renewed
              </p>
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
            <TabsList className="mb-3 flex-wrap">
              <TabsTrigger value="all" className="gap-1.5 text-xs">
                All Expiring ({allExpiring.length})
              </TabsTrigger>
              <TabsTrigger value="30" className="gap-1.5 text-xs text-red-600 dark:text-red-400">
                ≤ 30 Days ({thirtyDays.length})
              </TabsTrigger>
              <TabsTrigger value="45" className="gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                45 Days · Porting ({fortyFiveDays.length})
              </TabsTrigger>
              <TabsTrigger value="60" className="gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                60 Days ({sixtyDays.length})
              </TabsTrigger>
              <TabsTrigger value="renewed" className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Renewed ({renewedPolicies.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {allExpiring.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {allExpiring.map((p) => renderPolicyItem(p, false))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mb-2 text-green-500/40" />
                  <p className="text-sm font-semibold text-foreground">All Policies Up To Date</p>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    No insurance policies are expiring in the next 60 days.
                    {renewedPolicies.length > 0 && ` ${renewedPolicies.length} policy renewal(s) are active and tracked.`}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="30">
              {thirtyDays.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {thirtyDays.map((p) => renderPolicyItem(p, false))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <ShieldCheck className="h-8 w-8 mb-1.5 text-green-500/40" />
                  <p className="text-sm font-medium text-foreground">No Policies Expiring in 30 Days</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No urgent renewals required right now.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="45">
              {fortyFiveDays.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {fortyFiveDays.map((p) => renderPolicyItem(p, false))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <FileCheck2 className="h-8 w-8 mb-1.5 text-blue-500/40" />
                  <p className="text-sm font-medium text-foreground">No Policies in 45-Day Porting Window</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Policies in this window are ready for porting to other insurers.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="60">
              {sixtyDays.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {sixtyDays.map((p) => renderPolicyItem(p, false))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mb-1.5 text-amber-500/40" />
                  <p className="text-sm font-medium text-foreground">No Policies Expiring in 46-60 Days</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No policies scheduled for renewal in this window.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="renewed">
              {renewedPolicies.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {renewedPolicies.map((p) => renderPolicyItem(p, true))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-1.5 text-emerald-500/40" />
                  <p className="text-sm font-medium text-foreground">No Renewed Policies Yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When you renew a policy, it will appear here with its full historical record preserved.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <InsuranceDialog open={dialogOpen} setOpen={setDialogOpen} insurance={selectedInsurance} />
      <RenewInsuranceDialog open={renewDialogOpen} setOpen={setRenewDialogOpen} insurance={selectedForRenewal} />
    </>
  );
}
