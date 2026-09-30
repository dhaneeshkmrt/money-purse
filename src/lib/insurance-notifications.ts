'use client';

import { format, differenceInDays, parseISO, startOfDay } from 'date-fns';
import type { Insurance } from './types';

const STORAGE_KEYS = {
  ENABLED: 'money_purse_insurance_mobile_notif_enabled',
  LAST_NOTIFIED: 'money_purse_insurance_last_notified_ts',
};

/**
 * Returns whether the browser supports the Notifications API.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns current permission status: 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests permission for mobile/desktop push notifications.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setMobileReminderEnabled(true);
    }
    return permission;
  } catch (err) {
    console.warn('[Notification] Error requesting permission:', err);
    return Notification.permission;
  }
}

/**
 * Gets whether user enabled mobile reminders in localStorage (defaults to true if permission granted).
 */
export function isMobileReminderEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEYS.ENABLED);
  if (stored !== null) return stored === 'true';
  // Default to enabled if user has already granted notification permission
  return isNotificationSupported() && Notification.permission === 'granted';
}

/**
 * Toggles mobile reminder preference.
 */
export function setMobileReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ENABLED, String(enabled));
}

/**
 * Calculates the exact Date of the next Saturday at 9:00 AM (local time).
 */
export function getNextSaturday9AM(fromDate: Date = new Date()): Date {
  const target = new Date(fromDate);
  const day = target.getDay(); // 0 is Sunday, 6 is Saturday
  const currentHour = target.getHours();
  const currentMinute = target.getMinutes();

  if (day === 6) {
    // Today is Saturday
    if (currentHour < 9 || (currentHour === 9 && currentMinute === 0)) {
      // It's before 9:00 AM today
      target.setHours(9, 0, 0, 0);
      return target;
    } else {
      // 9:00 AM has passed today, next Saturday is 7 days away
      target.setDate(target.getDate() + 7);
      target.setHours(9, 0, 0, 0);
      return target;
    }
  } else {
    // Days until next Saturday
    const daysUntilSaturday = (6 - day + 7) % 7;
    target.setDate(target.getDate() + daysUntilSaturday);
    target.setHours(9, 0, 0, 0);
    return target;
  }
}

/**
 * Determines whether a Saturday 9 AM or weekly 7-day notification should be sent now.
 */
export function shouldSendReminderNow(): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  if (!isMobileReminderEnabled()) return false;

  const now = new Date();
  const lastNotifiedStr = localStorage.getItem(STORAGE_KEYS.LAST_NOTIFIED);
  const lastNotified = lastNotifiedStr ? parseInt(lastNotifiedStr, 10) : 0;
  const msSinceLast = Date.now() - lastNotified;
  const daysSinceLast = msSinceLast / (1000 * 60 * 60 * 24);

  const isSaturday = now.getDay() === 6;
  const isPast9AM = now.getHours() >= 9;

  // Condition 1: Today is Saturday, it is 9 AM or later, and we haven't notified today
  if (isSaturday && isPast9AM) {
    const todayStart = startOfDay(now).getTime();
    if (lastNotified < todayStart) {
      return true;
    }
  }

  // Condition 2: It has been 7 or more days since the last notification
  if (daysSinceLast >= 7) {
    return true;
  }

  return false;
}

/**
 * Triggers a mobile notification for expiring insurance policies.
 */
export async function sendInsuranceNotification(options: {
  policies: Insurance[];
  isTest?: boolean;
}): Promise<boolean> {
  const { policies, isTest = false } = options;

  if (!isNotificationSupported()) {
    console.warn('[Notification] Notifications not supported in this browser.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') return false;
  }

  const today = startOfDay(new Date());

  // Filter expiring policies (within 60 days or expired in last 60 days)
  const expiring = policies.filter((p) => {
    if (!p.expiryDate) return false;
    const expiry = startOfDay(parseISO(p.expiryDate));
    const days = differenceInDays(expiry, today);
    return days <= 60 && days >= -60;
  }).sort((a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime());

  if (!isTest && expiring.length === 0) {
    return false;
  }

  const firstPolicy = expiring[0];
  const urgentCount = expiring.filter((p) => differenceInDays(startOfDay(parseISO(p.expiryDate)), today) <= 30).length;
  const portingCount = expiring.filter((p) => {
    const d = differenceInDays(startOfDay(parseISO(p.expiryDate)), today);
    return d > 30 && d <= 45;
  }).length;

  let title = '🛡️ Insurance Renewal Reminder';
  let body = 'You have insurance policies approaching renewal. Tap to review your coverage.';

  if (isTest) {
    title = '🔔 Insurance Mobile Reminder Test';
    body = expiring.length > 0
      ? `Active test: ${expiring.length} policy renewal alert(s) will notify you every 7 days (Saturday 9:00 AM).`
      : 'Active test: Mobile reminders scheduled every Saturday at 9:00 AM for policies approaching renewal.';
  } else if (firstPolicy) {
    const days = differenceInDays(startOfDay(parseISO(firstPolicy.expiryDate)), today);
    const daysText = days < 0
      ? `expired ${Math.abs(days)} days ago`
      : days === 0
      ? 'expires today!'
      : `expires in ${days} days`;

    title = urgentCount > 0
      ? `🚨 Urgent Insurance Alert (${urgentCount} Due Soon)`
      : portingCount > 0
      ? `⚡ Insurance Porting Alert (${portingCount} Ready for Porting)`
      : `🛡️ Insurance Renewal (${expiring.length} Due)`;

    const policyLabel = firstPolicy.name
      ? `${firstPolicy.name} (${firstPolicy.provider})`
      : `${firstPolicy.provider} (${firstPolicy.type})`;

    body = `${policyLabel} ${daysText}.${
      expiring.length > 1 ? ` +${expiring.length - 1} more policies due.` : ''
    } Tap to view renewal or porting options.`;
  }

  const notificationOptions: any = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'money-purse-insurance-saturday-reminder',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: '/insurance',
      timestamp: Date.now(),
    },
    requireInteraction: true,
  };

  try {
    // Prefer service worker showNotification for native mobile PWA integration
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, notificationOptions);
        if (!isTest) {
          localStorage.setItem(STORAGE_KEYS.LAST_NOTIFIED, String(Date.now()));
        }
        return true;
      }
    }

    // Fallback to standard Notification API
    new Notification(title, notificationOptions);
    if (!isTest) {
      localStorage.setItem(STORAGE_KEYS.LAST_NOTIFIED, String(Date.now()));
    }
    return true;
  } catch (err) {
    console.error('[Notification] Error showing notification:', err);
    return false;
  }
}
