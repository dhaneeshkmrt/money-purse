'use client';

import { useState, useMemo, useEffect, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Lock, Plus, PlusCircle, Eye, AlertTriangle, ChevronLeft, ChevronRight, Mic, Square, Volume2, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, getYear, getMonth, subDays, addDays } from 'date-fns';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { processVoiceTransaction } from '@/ai/flows/process-voice-transaction';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Transaction } from '@/lib/types';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const transactionSchema = z.object({
  date: z.date({
    required_error: 'A date is required.',
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  description: z.string().min(3, 'Description must be at least 3 characters.'),
  amount: z.number().finite().refine((value) => value !== 0, {
    message: 'Amount must not be zero.',
  }),
  category: z.string().min(1, 'Please select a category.'),
  subcategory: z.string().min(1, 'Please select a subcategory.'),
  microcategory: z.string().optional(),
  paidBy: z.string().min(1, 'Please select a payer.'),
  notes: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface AddTransactionSheetProps {
  children?: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  transaction?: Omit<Transaction, 'userId' | 'tenantId'>;
}

export default function AddTransactionSheet({
  children,
  open: controlledOpen,
  setOpen: setControlledOpen,
  transaction,
}: AddTransactionSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { categories, addTransaction, editTransaction, deleteTransaction, tenants, selectedTenantId, isMonthLocked, settings, filteredTransactions } = useApp();
  const { toast } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateTransactionsOpen, setDateTransactionsOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<{id: string; description: string; amount: number} | null>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isEditing = !!transaction;
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  const selectedTenant = useMemo(() => {
    return tenants.find(t => t.id === selectedTenantId);
  }, [tenants, selectedTenantId]);

  const paidByOptions = useMemo(() => {
    return selectedTenant?.paidByOptions || [];
  }, [selectedTenant]);
  
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: isEditing ? {
        ...transaction,
        date: parseISO(transaction.date),
        amount: transaction.amount,
        microcategory: transaction.microcategory || '',
        notes: transaction.notes || '',
      } : {
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        description: '',
        amount: undefined,
        category: '',
        subcategory: '',
        microcategory: '',
        paidBy: '',
        notes: '',
    },
  });

  const onValueChange = useCallback((value: number) => {
    form.setValue('amount', value, { shouldValidate: true, shouldDirty: true });
  }, [form]);

  const {
    inputRef,
    formattedValue,
    handleInputChange,
    handleBlur: handleCurrencyBlur,
    calculationResult,
    setValue,
    amountInWords,
    lastExpression,
  } = useCurrencyInput({
    onValueChange,
  });

  const lastSyncedExpression = useRef<string | null>(null);

  useEffect(() => {
    if (lastExpression && lastExpression !== lastSyncedExpression.current) {
      const currentDesc = form.getValues('description');
      const expressionRegex = /\s*\(([^)]*[+\-*/][^)]*)\)$/;
      const match = currentDesc.match(expressionRegex);
      
      let newDesc = currentDesc;
      if (match) {
        newDesc = currentDesc.replace(expressionRegex, ` (${lastExpression})`);
      } else {
        newDesc = `${currentDesc} (${lastExpression})`.trim();
      }

      if (newDesc !== currentDesc) {
        form.setValue('description', newDesc, { shouldDirty: true, shouldValidate: true });
      }
      lastSyncedExpression.current = lastExpression;
    } else if (!lastExpression) {
      lastSyncedExpression.current = null;
    }
  }, [lastExpression, form]);

  const selectedDate = form.watch('date');
  const watchedAmount = form.watch('amount');

  const duplicateMatches = useMemo(() => {
    if (!Number.isFinite(watchedAmount) || watchedAmount === 0 || isEditing) return [];
    return filteredTransactions.filter(t => t.amount === watchedAmount);
  }, [watchedAmount, filteredTransactions, isEditing]);

  const isSelectedMonthLocked = useMemo(() => {
    if (!selectedDate) return false;
    const year = getYear(selectedDate);
    const month = getMonth(selectedDate);
    return isMonthLocked(year, month);
  }, [selectedDate, isMonthLocked]);

  useEffect(() => {
    if (open) {
      lastSyncedExpression.current = null;
      if (isEditing && transaction) {
        form.reset({
          ...transaction,
          date: parseISO(transaction.date),
          amount: transaction.amount,
          microcategory: transaction.microcategory || '',
          notes: transaction.notes || '',
        });
        setValue(String(transaction.amount));
      } else {
         form.reset({
            date: new Date(),
            time: format(new Date(), 'HH:mm'),
            description: '',
            amount: undefined,
            category: settings.defaultCategory && settings.defaultCategory !== 'none' ? settings.defaultCategory : '',
            subcategory: settings.defaultSubcategory && settings.defaultSubcategory !== 'none' ? settings.defaultSubcategory : '',
            microcategory: settings.defaultMicrocategory && settings.defaultMicrocategory !== 'none' ? settings.defaultMicrocategory : '',
            paidBy: (settings.defaultPaidBy && settings.defaultPaidBy !== 'none') ? settings.defaultPaidBy : (paidByOptions[0] || ''),
            notes: '',
        });
        setValue('');
        inputRef.current?.focus();
      }
    }
  }, [open, isEditing, transaction, paidByOptions, form, setValue, inputRef, settings]);

  const selectedCategoryName = form.watch('category');
  const selectedSubcategoryName = form.watch('subcategory');
  
  const subcategories = useMemo(() => {
    const cat = categories.find((c) => c.name === selectedCategoryName);
    return cat ? cat.subcategories : [];
  }, [selectedCategoryName, categories]);

  const microcategories = useMemo(() => {
      const subcategory = subcategories.find(s => s.name === selectedSubcategoryName);
      return subcategory ? (subcategory.microcategories || []) : [];
  }, [selectedSubcategoryName, subcategories]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          processVoice(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ title: "Mic Access Denied", description: "Please enable microphone permissions to use voice entry.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoice = async (dataUri: string) => {
    setIsProcessingVoice(true);
    try {
      const result = await processVoiceTransaction({
        audioDataUri: dataUri,
        availableCategories: categories.map(c => c.name),
      });

      if (result) {
        // Robustly map AI result to form, ignoring invalid or mismatching fields
        if (result.description) form.setValue('description', result.description, { shouldDirty: true, shouldValidate: true });
        if (result.amount) {
            form.setValue('amount', result.amount, { shouldDirty: true, shouldValidate: true });
            setValue(String(result.amount));
        }
        
        // Ensure category matches one of our existing ones
        const validCategory = categories.find(c => c.name === result.category);
        if (validCategory) {
            form.setValue('category', validCategory.name, { shouldDirty: true, shouldValidate: true });
            
            // Only try subcategories if category is valid
            const validSub = validCategory.subcategories.find(s => s.name === result.subcategory);
            if (validSub) {
                form.setValue('subcategory', validSub.name, { shouldDirty: true, shouldValidate: true });
                
                // Only try microcategories if subcategory is valid
                const validMicro = validSub.microcategories.find(m => m.name === result.microcategory);
                if (validMicro) {
                    form.setValue('microcategory', validMicro.name, { shouldDirty: true, shouldValidate: true });
                }
            }
        }

        if (result.date) {
          try {
            form.setValue('date', parseISO(result.date), { shouldDirty: true, shouldValidate: true });
          } catch(e) { /* ignore invalid dates */ }
        }
        
        if (result.notes) form.setValue('notes', result.notes, { shouldDirty: true, shouldValidate: true });

        toast({ title: "Voice Processed", description: "Form pre-filled with extracted details." });
      }
    } catch (err: any) {
      console.error("Voice processing failed:", err);
      toast({ 
        title: "AI Analysis Failed", 
        description: err.message || "Failed to process voice note. Please try with clearer audio.", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleSave = async (data: TransactionFormValues, shouldClose: boolean) => {
    setIsSubmitting(true);
    const submissionData = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        microcategory: data.microcategory || '',
    };
    try {
      if (isEditing && transaction) {
          await editTransaction(transaction.id, submissionData);
          toast({ title: 'Transaction Updated' });
      } else {
          await addTransaction(submissionData);
          toast({ title: 'Transaction Added' });
      }
      if (shouldClose) {
        form.reset();
        setOpen(false);
      } else {
        const { date, time } = form.getValues();
        form.reset({
          date,
          time,
          paidBy: (settings.defaultPaidBy && settings.defaultPaidBy !== 'none') ? settings.defaultPaidBy : (paidByOptions[0] || ''),
          description: '',
          amount: undefined,
          category: settings.defaultCategory && settings.defaultCategory !== 'none' ? settings.defaultCategory : '',
          subcategory: settings.defaultSubcategory && settings.defaultSubcategory !== 'none' ? settings.defaultSubcategory : '',
          microcategory: settings.defaultMicrocategory && settings.defaultMicrocategory !== 'none' ? settings.defaultMicrocategory : '',
          notes: '',
        });
        setValue('');
        inputRef.current?.focus();
        lastSyncedExpression.current = null;
      }
    } catch(error: any) {
        toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const chipRadioClasses = "cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground";

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {children && <SheetTrigger asChild>{children}</SheetTrigger>}
        <SheetContent className="w-full sm:max-w-xl flex flex-col">
          <SheetHeader className="flex-row items-center justify-between space-y-0">
            <SheetTitle>{isEditing ? 'Edit Transaction' : 'New Transaction'}</SheetTitle>
            {!isEditing && (
                <Button 
                    variant={isRecording ? "destructive" : "outline"} 
                    size="sm" 
                    className={cn("rounded-full", isRecording && "animate-pulse")}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessingVoice}
                >
                    {isRecording ? <Square className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {isRecording ? "Stop" : "Speak"}
                    {isProcessingVoice && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                </Button>
            )}
          </SheetHeader>
          
          {isProcessingVoice && (
              <Alert className="bg-primary/10 border-primary/20 mt-4">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary font-medium">
                      Gemini is understanding your voice note...
                  </AlertDescription>
              </Alert>
          )}
          
          <Form {...form}>
            <form className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-6 -mr-6 space-y-6 py-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input 
                            ref={inputRef}
                            placeholder="0.00 or 50+25" 
                            value={formattedValue}
                            onChange={handleInputChange}
                            onBlur={handleCurrencyBlur}
                            className="text-lg font-bold"
                          />
                        </FormControl>
                        {calculationResult && <div className="text-xs text-muted-foreground pt-1">= {calculationResult}</div>}
                        {amountInWords && <div className="text-xs text-muted-foreground pt-1 font-medium italic">{amountInWords}</div>}
                        <div className="text-xs text-muted-foreground pt-1">Negative amounts are allowed for refunds, credits, or reversals.</div>
                        {duplicateMatches.length > 0 && (
                          <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {duplicateMatches.length} existing transaction{duplicateMatches.length !== 1 ? 's' : ''} with same amount
                            </div>
                            <div className="space-y-1">
                              {duplicateMatches.slice(0, 5).map(t => (
                                <div key={t.id} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground truncate mr-2">
                                    <span className="font-medium text-foreground">{t.description}</span>
                                    {' · '}{t.category}{t.subcategory ? ` › ${t.subcategory}` : ''}{t.microcategory ? ` › ${t.microcategory}` : ''}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">{t.date}</span>
                                </div>
                              ))}
                              {duplicateMatches.length > 5 && (
                                <div className="text-xs text-muted-foreground">...and {duplicateMatches.length - 5} more</div>
                              )}
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Weekly groceries" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Date</FormLabel>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="icon" onClick={() => {
                                const d = form.getValues('date');
                                if(d) form.setValue('date', subDays(d, 1));
                            }}><ChevronLeft className="h-4 w-4" /></Button>
                            
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button variant={'outline'} className={cn('flex-1 pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                            </Popover>
                            
                            <Button type="button" variant="outline" size="icon" onClick={() => {
                                const d = form.getValues('date');
                                if(d) form.setValue('date', addDays(d, 1));
                            }}><ChevronRight className="h-4 w-4" /></Button>

                            <Button type="button" variant="ghost" size="icon" onClick={() => setDateTransactionsOpen(true)} title="View transactions for this date">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                              <div key={cat.id}>
                                <RadioGroupItem value={cat.name} id={`cat-${cat.id}`} className="sr-only peer" />
                                <Label htmlFor={`cat-${cat.id}`} className={chipRadioClasses}>{cat.name}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {selectedCategoryName && (
                    <FormField
                      control={form.control}
                      name="subcategory"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Subcategory</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                              {subcategories.map((sub) => (
                                <div key={sub.id}>
                                  <RadioGroupItem value={sub.name} id={`sub-${sub.id}`} className="sr-only peer" />
                                  <Label htmlFor={`sub-${sub.id}`} className={chipRadioClasses}>{sub.name}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  {microcategories.length > 0 && (
                    <FormField
                      control={form.control}
                      name="microcategory"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Micro-category</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                              {microcategories.map((micro) => (
                                <div key={micro.id}>
                                  <RadioGroupItem value={micro.name} id={`micro-${micro.id}`} className="sr-only peer" />
                                  <Label htmlFor={`micro-${micro.id}`} className={chipRadioClasses}>{micro.name}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="paidBy"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Paid By</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                            {paidByOptions.map((option) => (
                                <div key={option}>
                                  <RadioGroupItem value={option} id={`paidby-${option}`} className="sr-only peer" />
                                  <Label htmlFor={`paidby-${option}`} className={chipRadioClasses}>{option.toUpperCase()}</Label>
                                </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="Extra details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <SheetFooter className="pt-4 gap-2">
                  <Button type="button" onClick={form.handleSubmit((data) => handleSave(data, true))} disabled={isSubmitting || isSelectedMonthLocked} className="flex-1">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Save Changes' : 'Save'}
                  </Button>
                  {!isEditing && (
                    <Button type="button" variant="outline" onClick={form.handleSubmit((data) => handleSave(data, false))} disabled={isSubmitting || isSelectedMonthLocked} className="flex-1">
                      Save & New
                    </Button>
                  )}
                </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Dialog open={dateTransactionsOpen} onOpenChange={setDateTransactionsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transactions on {selectedDate ? format(selectedDate, 'PPP') : ''}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-3 py-2">
              {(() => {
                const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                const dayTransactions = filteredTransactions.filter(t => t.date === dateStr);
                const totalForDay = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
                if (dayTransactions.length === 0) {
                  return <p className="text-center text-muted-foreground pt-10">No transactions on this date.</p>;
                }
                return (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground pb-2 border-b">
                      <span>{dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(totalForDay)}</span>
                    </div>
                    {dayTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center gap-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none truncate">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{transaction.category} &bull; {transaction.subcategory}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-medium">{formatCurrency(transaction.amount)}</span>
                            <Badge variant="outline" className="ml-2 font-mono text-xs">{transaction.paidBy.toUpperCase()}</Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setTransactionToDelete({ id: transaction.id, description: transaction.description, amount: transaction.amount })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => { if (!open) setTransactionToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&ldquo;{transactionToDelete?.description}&rdquo;</strong> ({transactionToDelete ? formatCurrency(transactionToDelete.amount) : ''})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!transactionToDelete) return;
                try {
                  await deleteTransaction(transactionToDelete.id);
                  toast({ title: 'Transaction Deleted', description: `"${transactionToDelete.description}" has been removed.` });
                } catch (error: any) {
                  toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setTransactionToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
