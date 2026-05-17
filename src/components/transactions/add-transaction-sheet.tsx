'use client';

import { useState, useMemo, useEffect, useTransition, useRef, useCallback } from 'react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Lock, Plus, PlusCircle, Eye, AlertTriangle, ChevronLeft, ChevronRight, Mic, Square, Volume2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, getYear, getMonth, subDays, addDays } from 'date-fns';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { suggestTransactionCategories } from '@/ai/flows/categorize-transaction';
import { processVoiceTransaction } from '@/ai/flows/process-voice-transaction';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Transaction } from '@/lib/types';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { SubcategoryDialog } from '../categories/subcategory-dialog';
import { MicrocategoryDialog } from '../categories/microcategory-dialog';
import DayTransactionsDialog from '../dashboard/day-transactions-dialog';

const transactionSchema = z.object({
  date: z.date({
    required_error: 'A date is required.',
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  description: z.string().min(3, 'Description must be at least 3 characters.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
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
  const { categories, addTransaction, editTransaction, tenants, selectedTenantId, isMonthLocked, settings, addSubcategory, addMicrocategory, transactions, filteredTransactions } = useApp();
  const { toast } = useToast();
  const [isAiPending, startAiTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateAmount, setDuplicateAmount] = useState<Transaction[]>([]);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [microcategoryDialogOpen, setMicrocategoryDialogOpen] = useState(false);
  const [dayTransactionsDialogOpen, setDayTransactionsDialogOpen] = useState(false);

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
      setDuplicateAmount([]);
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

  // Voice Recording Logic
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
        // Pre-fill all extracted fields
        form.setValue('description', result.description, { shouldDirty: true, shouldValidate: true });
        form.setValue('amount', result.amount, { shouldDirty: true, shouldValidate: true });
        setValue(String(result.amount));
        
        if (result.category) {
          form.setValue('category', result.category, { shouldDirty: true, shouldValidate: true });
        }
        if (result.subcategory) {
          form.setValue('subcategory', result.subcategory, { shouldDirty: true, shouldValidate: true });
        }
        if (result.microcategory) {
          form.setValue('microcategory', result.microcategory, { shouldDirty: true, shouldValidate: true });
        }
        if (result.date) {
          form.setValue('date', parseISO(result.date), { shouldDirty: true, shouldValidate: true });
        }
        if (result.notes) {
          form.setValue('notes', result.notes, { shouldDirty: true, shouldValidate: true });
        }

        toast({ title: "Voice Processed", description: "Form pre-filled with extracted details." });
      }
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
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
    </>
  );
}
