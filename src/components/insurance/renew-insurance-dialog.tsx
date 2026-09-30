'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/lib/provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, addYears } from 'date-fns';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Calendar, ArrowRight, History, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { Insurance } from '@/lib/types';

interface RenewInsuranceDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  insurance: Insurance | null;
}

export function RenewInsuranceDialog({ open, setOpen, insurance }: RenewInsuranceDialogProps) {
  const { renewInsurance } = useApp();
  const { toast } = useToast();
  const formatCurrency = useCurrencyFormatter();

  const [name, setName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newPremiumAmount, setNewPremiumAmount] = useState('');
  const [newPolicyNumber, setNewPolicyNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (insurance && open) {
      setName(insurance.name || '');
      try {
        const currentExpiry = parseISO(insurance.expiryDate);
        setNewStartDate(insurance.expiryDate);
        // Default new expiry to exactly 1 year from current expiry
        setNewExpiryDate(format(addYears(currentExpiry, 1), 'yyyy-MM-dd'));
      } catch {
        setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
        setNewExpiryDate(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
      }
      setNewPremiumAmount(insurance.premiumAmount?.toString() || '');
      setNewPolicyNumber(insurance.policyNumber || '');
      setNotes('');
      setShowHistory(false);
    }
  }, [insurance, open]);

  if (!insurance) return null;

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpiryDate) {
      toast({ title: 'Validation Error', description: 'Please enter a valid expiry date.', variant: 'destructive' });
      return;
    }

    const premium = parseFloat(newPremiumAmount);
    if (isNaN(premium) || premium <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid premium amount.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await renewInsurance(insurance.id, {
        name: name.trim() || undefined,
        newExpiryDate,
        newStartDate,
        newPremiumAmount: premium,
        newPolicyNumber: newPolicyNumber.trim() || insurance.policyNumber,
        notes: notes.trim() ? notes.trim() : insurance.notes,
      });

      toast({
        title: 'Policy Renewed Successfully',
        description: `${insurance.name || insurance.provider} (#${newPolicyNumber || insurance.policyNumber}) renewed until ${format(parseISO(newExpiryDate), 'dd MMM yyyy')}. Expired term archived.`,
      });
      setOpen(false);
    } catch (err: any) {
      console.error('Error renewing policy:', err);
      toast({
        title: 'Renewal Failed',
        description: err?.message || 'Could not complete policy renewal.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const history = insurance.renewalHistory || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Renew Policy {insurance.name ? `— ${insurance.name}` : ''}
              </DialogTitle>
              <DialogDescription>
                Renew <span className="font-semibold text-foreground">{insurance.name ? `${insurance.name} (${insurance.provider})` : insurance.provider}</span> ({insurance.type}).
                The expiring term details will be permanently tracked under this policy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current / Expiring Term Details Box */}
        <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
            <span>Current Term (Expiring)</span>
            <Badge variant="outline" className="text-[10px] py-0 text-orange-600 border-orange-500/30 bg-orange-500/10">
              Being Renewed
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm pt-1">
            {insurance.name && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">For Whom / Policy Name</p>
                <p className="font-semibold text-foreground">{insurance.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Policy Number</p>
              <p className="font-mono font-medium">{insurance.policyNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Premium</p>
              <p className="font-bold text-primary">{formatCurrency(insurance.premiumAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{format(parseISO(insurance.startDate), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires On</p>
              <p className="font-medium text-destructive">{format(parseISO(insurance.expiryDate), 'dd MMM yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Renewal Form */}
        <form onSubmit={handleRenew} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="renewPolicyName" className="text-xs font-semibold">
              Policy Name / For Whom
            </Label>
            <Input
              id="renewPolicyName"
              placeholder="e.g. Dad, Mom, Self, Car i20"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="newStartDate" className="text-xs font-semibold">
                New Start Date
              </Label>
              <Input
                id="newStartDate"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newExpiryDate" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                New Expiry Date (+1 Year)
              </Label>
              <Input
                id="newExpiryDate"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                required
                className="border-emerald-500/40 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPremium" className="text-xs font-semibold">
                New Premium Amount
              </Label>
              <Input
                id="newPremium"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 5000"
                value={newPremiumAmount}
                onChange={(e) => setNewPremiumAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPolicyNumber" className="text-xs font-semibold">
                Policy Number (if changed)
              </Label>
              <Input
                id="newPolicyNumber"
                type="text"
                placeholder={insurance.policyNumber}
                value={newPolicyNumber}
                onChange={(e) => setNewPolicyNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renewalNotes" className="text-xs font-semibold">
              Renewal Notes / Discount / NCB (Optional)
            </Label>
            <Textarea
              id="renewalNotes"
              placeholder="e.g. Renewed with 20% No-Claim Bonus, paid via net banking"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-xs"
            />
          </div>

          {/* Historical Renewals Section */}
          {history.length > 0 && (
            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <History className="h-3.5 w-3.5" />
                {showHistory ? 'Hide' : 'View'} Past Renewal History ({history.length} term{history.length > 1 ? 's' : ''})
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {history.map((record, index) => (
                    <div
                      key={record.id || index}
                      className="p-2 rounded border bg-muted/30 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>Past Term #{history.length - index}: #{record.policyNumber}</span>
                        <span className="font-bold text-primary">{formatCurrency(record.premiumAmount)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(record.startDate), 'dd MMM yyyy')} &rarr;{' '}
                        {format(parseISO(record.expiryDate), 'dd MMM yyyy')}
                        {record.renewedAt && ` (Renewed on ${format(parseISO(record.renewedAt), 'dd MMM yyyy')})`}
                      </p>
                      {record.notes && (
                        <p className="text-[11px] italic text-muted-foreground">&ldquo;{record.notes}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Renewing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Confirm &amp; Renew Policy
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
