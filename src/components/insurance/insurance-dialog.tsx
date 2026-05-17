
'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/provider';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, addYears } from 'date-fns';
import { Loader2, Sparkles, UploadCloud, FileText, X } from 'lucide-react';
import { extractInsuranceDetails } from '@/ai/flows/extract-insurance-details';
import type { Insurance, InsuranceType } from '@/lib/types';
import Image from 'next/image';

const insuranceTypes: InsuranceType[] = ['Motor', 'Health', 'Term', 'Life', 'Home', 'Travel', 'Other'];

export function InsuranceDialog({ 
  open, 
  setOpen,
  insurance = null
}: { 
  open: boolean, 
  setOpen: (open: boolean) => void,
  insurance?: Insurance | null
}) {
  const { addInsurance, editInsurance } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [type, setType] = useState<InsuranceType>('Motor');
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryDate, setExpiryDate] = useState(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [docBase64, setDocBase64] = useState<string | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSubmitting] = useState(false);

  const isEditing = !!insurance;

  useEffect(() => {
    if (open) {
      if (insurance) {
        setType(insurance.type);
        setProvider(insurance.provider);
        setPolicyNumber(insurance.policyNumber);
        setPremiumAmount(insurance.premiumAmount.toString());
        setStartDate(insurance.startDate);
        setExpiryDate(insurance.expiryDate);
        setNotes(insurance.notes || '');
        setDocBase64(insurance.documentBase64 || null);
      } else {
        reset();
      }
    }
  }, [open, insurance]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setDocBase64(base64);
        handleScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async (base64: string) => {
      console.log('Starting AI Scan...');
      setIsScanning(true);
      try {
          const result = await extractInsuranceDetails({ documentDataUri: base64 });
          if (result) {
              setType(result.type);
              setProvider(result.provider);
              setPolicyNumber(result.policyNumber);
              setPremiumAmount(result.premiumAmount.toString());
              setStartDate(result.startDate);
              setExpiryDate(result.expiryDate);
              if (result.notes) setNotes(result.notes);
              
              toast({ title: 'Scan Successful', description: 'AI has extracted the policy details.' });
          }
      } catch (err: any) {
          console.error('Scan Error:', err);
          toast({ title: 'Scan Failed', description: err.message || 'Could not read document.', variant: 'destructive' });
      } finally {
          setIsScanning(false);
      }
  };

  const handleSave = async () => {
    if (!provider || !policyNumber || !premiumAmount) return;
    
    setIsSubmitting(true);
    try {
      const data = {
          type,
          provider,
          policyNumber,
          premiumAmount: Number(premiumAmount),
          startDate,
          expiryDate,
          notes,
          documentBase64: docBase64 || undefined
      };

      if (isEditing && insurance) {
        await editInsurance(insurance.id, data);
        toast({ title: 'Policy Updated' });
      } else {
        await addInsurance(data);
        toast({ title: 'Policy Added' });
      }
      setOpen(false);
      reset();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const reset = () => {
    setType('Motor'); setProvider(''); setPolicyNumber(''); setPremiumAmount('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setExpiryDate(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
    setNotes(''); setDocBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Policy' : 'Add New Insurance'}</DialogTitle>
          <DialogDescription>
            Record your coverage details. Upload the policy document to automatically scan details using AI.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Document Upload Area */}
          <div 
            className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors relative group"
            onClick={() => !isScanning && fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
            
            {isScanning ? (
                <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">AI is scanning document...</p>
                </div>
            ) : docBase64 ? (
                <div className="w-full flex flex-col items-center gap-2">
                    {docBase64.startsWith('data:image') ? (
                        <div className="relative h-32 w-32 rounded overflow-hidden">
                            <Image src={docBase64} alt="Preview" fill className="object-cover" />
                        </div>
                    ) : (
                        <FileText className="h-12 w-12 text-primary" />
                    )}
                    <p className="text-xs text-muted-foreground">Document uploaded. Click to change.</p>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => {
                        e.stopPropagation();
                        setDocBase64(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <UploadCloud className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold">Upload Policy Document</p>
                        <p className="text-xs text-muted-foreground">Extract details with Gemini AI</p>
                    </div>
                </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Insurance Type</label>
                <Select onValueChange={(v: any) => setType(v)} value={type}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {insuranceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Provider Name</label>
                <Input value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. LIC, ICICI" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Policy Number</label>
                <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="POL-12345" />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Premium Amount</label>
                <Input type="number" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry Date</label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Renewal agent info, etc." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving || isScanning}>Cancel</Button>
          <Button onClick={handleSave} disabled={!provider || !policyNumber || isSaving || isScanning}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update Policy' : 'Save Policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
