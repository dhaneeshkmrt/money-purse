'use client';

import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useApp } from '@/lib/provider';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { isSyncing } = useApp();
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showJustSynced, setShowJustSynced] = useState(false);
  const prevSyncingRef = useRef(isSyncing);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowSyncedToast(true);
      const timer = setTimeout(() => {
        setShowSyncedToast(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && isOnline && !wasOffline) {
      setShowJustSynced(true);
      const timer = setTimeout(() => {
        setShowJustSynced(false);
      }, 2500);
      prevSyncingRef.current = isSyncing;
      return () => clearTimeout(timer);
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shadow-sm animate-pulse">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline Mode (Changes saved locally)</span>
      </div>
    );
  }

  if (showSyncedToast) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full shadow-sm transition-all duration-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Back Online — Synced with Firestore</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full shadow-sm transition-all duration-300">
        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span>Syncing with cloud...</span>
      </div>
    );
  }

  if (showJustSynced) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full shadow-sm transition-all duration-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Up to date</span>
      </div>
    );
  }

  return null;
}
