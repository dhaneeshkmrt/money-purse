'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { processReceiptTransaction } from '@/ai/flows/process-receipt-transaction';
import { getSharedFiles, clearSharedFiles } from '@/lib/share-target-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Layers,
  RotateCcw,
  Camera,
  Upload,
  Sparkles,
  Eye,
  X,
  FileText,
  FileCode,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, getYear, getMonth, subDays, addDays } from 'date-fns';
import type { Category, Transaction } from '@/lib/types';
import { GEMINI_MODELS, DEFAULT_AI_MODEL, normalizeAiModel } from '@/lib/ai-models';

// Safe arithmetic evaluator
const evaluateExpression = (expr: string): number | null => {
  try {
    const sanitized = expr.trim();
    if (!sanitized) return null;
    if (/[^0-9+\-*/. ]/.test(sanitized)) return null;
    const result = new Function(`return ${sanitized}`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
};

// Indian numbering system to words
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertLessThanThousand(n: number): string {
  let result = '';
  if (n >= 100) {
    result += ones[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    result += tens[Math.floor(n / 10)] + ' ';
    n %= 10;
  } else if (n >= 10) {
    result += teens[n - 10] + ' ';
    n = 0;
  }
  if (n > 0) {
    result += ones[n] + ' ';
  }
  return result;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees';
  if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';
  const numStr = integerPart.toString();

  if (numStr.length > 7) {
    const crore = parseInt(numStr.slice(0, -7), 10);
    result += convertLessThanThousand(crore) + 'Crore ';
  }
  if (numStr.length > 5) {
    const lakh = parseInt(numStr.slice(-7, -5), 10);
    if (lakh > 0) result += convertLessThanThousand(lakh) + 'Lakh ';
  }
  if (numStr.length > 3) {
    const thousand = parseInt(numStr.slice(-5, -3), 10);
    if (thousand > 0) result += convertLessThanThousand(thousand) + 'Thousand ';
  }
  const hundred = parseInt(numStr.slice(-3), 10);
  if (hundred > 0) {
    result += convertLessThanThousand(hundred);
  }

  let words = result.trim() ? result.trim() + ' Rupees' : '';
  if (decimalPart > 0) {
    const decWords = convertLessThanThousand(decimalPart).trim() + ' Paise';
    words = words ? words + ' and ' + decWords : decWords;
  }

  return words.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Client-side image compressor for responsive mobile scanning
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
  });
};

interface SplitItem {
  id: string;
  rawAmount: string;
  evaluatedAmount: number;
  expression: string | null;
  description: string;
  category: string;
  subcategory: string;
  microcategory: string;
  notes: string;
}

interface QueuedBill {
  id: string;
  file: File;
  fileName: string;
  fileType: 'image' | 'pdf';
  previewUri?: string;
  status: 'pending' | 'processing' | 'ready' | 'error' | 'saved';
  errorMessage?: string;
  totalAmountInput: string;
  totalAmount: number;
  totalExpression: string | null;
  groupDescription: string;
  groupDate: Date;
  groupTime: string;
  paidBy: string;
  groupNotes: string;
  items: SplitItem[];
}

interface ParsedReceipt {
  groupDescription: string;
  groupDate: Date;
  totalAmount: number;
  totalAmountInput: string;
  groupNotes: string;
  items: SplitItem[];
}

function parseAiReceiptResult(
  result: any,
  fileName: string,
  categories: Category[]
): ParsedReceipt {
  let groupDescription = '';
  let groupDate = new Date();
  let totalAmount = 0;
  let totalAmountInput = '';
  let groupNotes = '';

  if (result?.storeName) {
    groupDescription = result.storeName;
  }

  if (result?.date) {
    try {
      const parsedDate = parseISO(result.date);
      if (!isNaN(parsedDate.getTime())) {
        groupDate = parsedDate;
      }
    } catch {
      // ignore invalid date
    }
  }

  if (typeof result?.totalAmount === 'number' && result.totalAmount > 0) {
    totalAmount = result.totalAmount;
    totalAmountInput = String(result.totalAmount);
  }

  if (result?.notes) {
    groupNotes = result.notes;
  }

  const parsedItems: SplitItem[] = [];

  if (result?.items && Array.isArray(result.items) && result.items.length > 0) {
    const matchedLineItems = result.items.map((aiItem: any) => {
      let matchedCatName = '';
      let matchedSubName = '';
      let matchedMicroName = '';

      const matchedCat = categories.find(c =>
        aiItem.category && c.name.trim().toLowerCase() === aiItem.category.trim().toLowerCase()
      ) || categories.find(c =>
        aiItem.category && c.name.toLowerCase().includes(aiItem.category.toLowerCase())
      ) || categories[0];

      if (matchedCat) {
        matchedCatName = matchedCat.name;
        const subcategories = matchedCat.subcategories || [];

        const matchedSub = subcategories.find(s =>
          aiItem.subcategory && s.name.trim().toLowerCase() === aiItem.subcategory.trim().toLowerCase()
        ) || subcategories.find(s =>
          aiItem.subcategory && s.name.toLowerCase().includes(aiItem.subcategory.toLowerCase())
        ) || subcategories[0];

        if (matchedSub) {
          matchedSubName = matchedSub.name;
          const microcategories = matchedSub.microcategories || [];

          const matchedMicro = microcategories.find(m =>
            aiItem.microcategory && m.name.trim().toLowerCase() === aiItem.microcategory.trim().toLowerCase()
          );
          if (matchedMicro) {
            matchedMicroName = matchedMicro.name;
          }
        }
      }

      const itemAmount = typeof aiItem.amount === 'number' ? aiItem.amount : parseFloat(String(aiItem.amount)) || 0;

      return {
        description: aiItem.description?.trim() || '',
        amount: itemAmount,
        category: matchedCatName,
        subcategory: matchedSubName,
        microcategory: matchedMicroName,
        quantity: aiItem.quantity,
        notes: aiItem.notes,
      };
    });

    const categoryGroups = new Map<string, {
      category: string;
      subcategory: string;
      microcategory: string;
      amounts: number[];
      descriptions: string[];
      notes: string[];
    }>();

    for (const item of matchedLineItems) {
      const groupKey = `${item.category}||${item.subcategory}||${item.microcategory || ''}`;
      const existing = categoryGroups.get(groupKey);
      const desc = item.description;
      const note = [item.quantity ? `Qty: ${item.quantity}` : null, item.notes?.trim() || null].filter(Boolean).join(' ');

      if (existing) {
        existing.amounts.push(item.amount);
        if (desc && !existing.descriptions.includes(desc)) {
          existing.descriptions.push(desc);
        }
        if (note && !existing.notes.includes(note)) {
          existing.notes.push(note);
        }
      } else {
        categoryGroups.set(groupKey, {
          category: item.category,
          subcategory: item.subcategory,
          microcategory: item.microcategory || '',
          amounts: [item.amount],
          descriptions: desc ? [desc] : [],
          notes: note ? [note] : [],
        });
      }
    }

    let groupIndex = 0;
    categoryGroups.forEach((group) => {
      groupIndex++;
      const isMultiple = group.amounts.length > 1;
      const totalGroupAmount = Math.round(group.amounts.reduce((sum, a) => sum + a, 0) * 100) / 100;
      const expressionString = isMultiple
        ? group.amounts.map(a => Number.isInteger(a) ? a.toString() : String(a)).join('+')
        : null;
      const rawAmountString = isMultiple ? expressionString! : String(totalGroupAmount);
      const combinedDesc = group.descriptions.length > 0
        ? group.descriptions.join(', ')
        : (group.microcategory || group.subcategory || group.category);

      parsedItems.push({
        id: `item-${Date.now()}-${groupIndex}-${Math.random().toString(36).substr(2, 4)}`,
        rawAmount: rawAmountString,
        evaluatedAmount: totalGroupAmount,
        expression: expressionString,
        description: combinedDesc,
        category: group.category,
        subcategory: group.subcategory,
        microcategory: group.microcategory,
        notes: group.notes.join(' | '),
      });
    });

    if (totalAmount <= 0 && parsedItems.length > 0) {
      const calculatedTotal = parsedItems.reduce((sum, item) => sum + item.evaluatedAmount, 0);
      totalAmount = calculatedTotal;
      totalAmountInput = String(calculatedTotal);
    }
  }

  return {
    groupDescription,
    groupDate,
    totalAmount,
    totalAmountInput,
    groupNotes,
    items: parsedItems.length > 0 ? parsedItems : [
      {
        id: `item-${Date.now()}`,
        rawAmount: '',
        evaluatedAmount: 0,
        expression: null,
        description: '',
        category: '',
        subcategory: '',
        microcategory: '',
        notes: '',
      }
    ],
  };
}

export default function GroupTransactionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const {
    categories,
    addMultipleTransactions,
    tenants,
    selectedTenantId,
    isMonthLocked,
    settings,
  } = useApp();

  const selectedTenant = useMemo(() => {
    return tenants.find(t => t.id === selectedTenantId);
  }, [tenants, selectedTenantId]);

  const paidByOptions = useMemo(() => {
    return selectedTenant?.paidByOptions || [];
  }, [selectedTenant]);

  // Master / Group States
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalExpression, setTotalExpression] = useState<string | null>(null);
  const [groupDescription, setGroupDescription] = useState('');
  const [groupDate, setGroupDate] = useState<Date>(new Date());
  const [groupTime, setGroupTime] = useState<string>(format(new Date(), 'HH:mm'));
  const [paidBy, setPaidBy] = useState<string>('');
  const [groupNotes, setGroupNotes] = useState('');

  // Receipt Scanner States
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(normalizeAiModel(settings.aiModel));
  const [receiptDocPreview, setReceiptDocPreview] = useState<string | null>(null);
  const [receiptDocType, setReceiptDocType] = useState<'image' | 'pdf' | null>(null);
  const [receiptDocName, setReceiptDocName] = useState<string>('');
  const [showDocDialog, setShowDocDialog] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Sync with user settings
  useEffect(() => {
    if (settings.aiModel) {
      setSelectedAiModel(normalizeAiModel(settings.aiModel));
    }
  }, [settings.aiModel]);

  // Items State
  const [items, setItems] = useState<SplitItem[]>([
    {
      id: 'item-1',
      rawAmount: '',
      evaluatedAmount: 0,
      expression: null,
      description: '',
      category: '',
      subcategory: '',
      microcategory: '',
      notes: '',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmMismatchDialog, setShowConfirmMismatchDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Set default paidBy when options load
  useEffect(() => {
    if (!paidBy && paidByOptions.length > 0) {
      const defaultOption = (settings.defaultPaidBy && settings.defaultPaidBy !== 'none')
        ? settings.defaultPaidBy
        : paidByOptions[0];
      setPaidBy(defaultOption || '');
    }
  }, [paidByOptions, settings.defaultPaidBy, paidBy]);

  // Detailed Category Guidelines for Gemini AI
  const categoryDetails = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      description: cat.description || '',
      subcategories: (cat.subcategories || []).map(sub => ({
        name: sub.name,
        description: sub.description || '',
        microcategories: (sub.microcategories || []).map(m => m.name),
      })),
    }));
  }, [categories]);

  // Batch Queue States
  const [queuedBills, setQueuedBills] = useState<QueuedBill[]>([]);
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [processingTick, setProcessingTick] = useState(0);
  const activeBillIdRef = useRef<string | null>(null);
  activeBillIdRef.current = activeBillId;
  const isProcessingRef = useRef(false);

  // Sync active form state to queued draft
  const syncCurrentFormToDraft = useCallback((draftId: string) => {
    setQueuedBills(prev => prev.map(bill => {
      if (bill.id !== draftId) return bill;
      return {
        ...bill,
        totalAmountInput,
        totalAmount,
        totalExpression,
        groupDescription,
        groupDate,
        groupTime,
        paidBy,
        groupNotes,
        items,
        previewUri: receiptDocPreview || bill.previewUri,
        fileType: receiptDocType || bill.fileType,
        fileName: receiptDocName || bill.fileName,
      };
    }));
  }, [totalAmountInput, totalAmount, totalExpression, groupDescription, groupDate, groupTime, paidBy, groupNotes, items, receiptDocPreview, receiptDocType, receiptDocName]);

  // Load a queued bill into active form fields
  const loadBillIntoForm = useCallback((bill: QueuedBill) => {
    setTotalAmountInput(bill.totalAmountInput || '');
    setTotalAmount(bill.totalAmount || 0);
    setTotalExpression(bill.totalExpression || null);
    setGroupDescription(bill.groupDescription || '');
    setGroupDate(bill.groupDate || new Date());
    setGroupTime(bill.groupTime || format(new Date(), 'HH:mm'));
    setPaidBy(bill.paidBy || paidByOptions[0] || '');
    setGroupNotes(bill.groupNotes || '');
    setItems(bill.items && bill.items.length > 0 ? bill.items : [
      {
        id: `item-${Date.now()}`,
        rawAmount: '',
        evaluatedAmount: 0,
        expression: null,
        description: '',
        category: '',
        subcategory: '',
        microcategory: '',
        notes: '',
      }
    ]);
    setReceiptDocPreview(bill.previewUri || null);
    setReceiptDocType(bill.fileType || null);
    setReceiptDocName(bill.fileName || '');
  }, [paidByOptions]);

  // Switch between bills in the queue
  const switchActiveBill = useCallback((targetBillId: string) => {
    if (targetBillId === activeBillId) return;
    if (activeBillId) {
      syncCurrentFormToDraft(activeBillId);
    }
    const target = queuedBills.find(b => b.id === targetBillId);
    if (target) {
      setActiveBillId(targetBillId);
      loadBillIntoForm(target);
    }
  }, [activeBillId, queuedBills, syncCurrentFormToDraft, loadBillIntoForm]);

  // Remove a bill from the queue
  const removeBillFromQueue = useCallback((billId: string) => {
    setQueuedBills(prev => {
      const remaining = prev.filter(b => b.id !== billId);
      if (activeBillId === billId) {
        const nextBill = remaining.find(b => b.status !== 'saved') || remaining[0];
        if (nextBill) {
          setActiveBillId(nextBill.id);
          loadBillIntoForm(nextBill);
        } else {
          setActiveBillId(null);
          resetForm();
        }
      }
      return remaining;
    });
  }, [activeBillId, loadBillIntoForm]);

  // Retry a failed bill
  const retryBill = useCallback((billId: string) => {
    setQueuedBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'pending', errorMessage: undefined } : b));
    setProcessingTick(t => t + 1);
  }, []);

  // Enqueue a list of files into the bill processing queue
  const enqueueFiles = useCallback((fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    const newBills: QueuedBill[] = fileList.map((file, i) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return {
        id: `bill-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        fileName: file.name,
        fileType: isPdf ? 'pdf' : 'image',
        status: 'pending',
        totalAmountInput: '',
        totalAmount: 0,
        totalExpression: null,
        groupDescription: '',
        groupDate: new Date(),
        groupTime: format(new Date(), 'HH:mm'),
        paidBy: paidBy || paidByOptions[0] || '',
        groupNotes: '',
        items: [
          {
            id: `item-${Date.now()}-${i}`,
            rawAmount: '',
            evaluatedAmount: 0,
            expression: null,
            description: '',
            category: '',
            subcategory: '',
            microcategory: '',
            notes: '',
          },
        ],
      };
    });

    // Save current active draft if exists and not yet saved
    if (activeBillId) {
      syncCurrentFormToDraft(activeBillId);
    }

    setQueuedBills(prev => {
      const updated = [...prev, ...newBills];
      // If no active bill or previous active was saved, activate the first new bill
      if (!activeBillId || prev.find(b => b.id === activeBillId)?.status === 'saved') {
        setActiveBillId(newBills[0].id);
        loadBillIntoForm(newBills[0]);
      }
      return updated;
    });

    setProcessingTick(t => t + 1);
  }, [paidBy, paidByOptions, activeBillId, syncCurrentFormToDraft, loadBillIntoForm]);

  // Handle files selected (supports multiple files from single pick)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    // Reset file input value so same files can be reselected if needed
    e.target.value = '';
    enqueueFiles(fileList);
  };

  // Check for files received via PWA Web Share Target
  const isCheckingSharedRef = useRef(false);

  const checkSharedFiles = useCallback(async () => {
    if (isCheckingSharedRef.current) return;
    isCheckingSharedRef.current = true;

    try {
      const shared = await getSharedFiles();
      if (!shared || shared.length === 0) return;

      // Clear shared files from IndexedDB immediately so they are not reprocessed
      await clearSharedFiles();

      const fileList = shared.map(item => {
        const blob = item.data instanceof Blob ? item.data : new Blob([item.data], { type: item.type });
        return new File([blob], item.name, { type: item.type, lastModified: item.timestamp });
      });

      enqueueFiles(fileList);

      // Remove ?shared= from URL cleanly without page reload
      if (typeof window !== 'undefined' && window.location.search.includes('shared=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      toast({
        title: 'Shared File Received',
        description: `Uploaded ${fileList.length} ${fileList.length === 1 ? 'receipt' : 'receipts'}. Starting AI scan...`,
      });
    } catch (err) {
      console.error('Failed to load shared files from Web Share Target:', err);
    } finally {
      isCheckingSharedRef.current = false;
    }
  }, [enqueueFiles, toast]);

  useEffect(() => {
    checkSharedFiles();

    const handleFocus = () => checkSharedFiles();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSharedFiles();
      }
    };
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SHARED_FILES_RECEIVED') {
        checkSharedFiles();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, [checkSharedFiles]);

  // Background queue processing effect: processes pending bills one by one
  useEffect(() => {
    if (isProcessingRef.current) return;
    const pendingBill = queuedBills.find(b => b.status === 'pending');
    if (!pendingBill) {
      setIsScanningReceipt(false);
      return;
    }

    const processBill = async (bill: QueuedBill) => {
      isProcessingRef.current = true;
      setIsScanningReceipt(true);
      setQueuedBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'processing' } : b));

      try {
        let dataUri = '';
        if (bill.fileType === 'pdf') {
          dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read PDF document.'));
            reader.readAsDataURL(bill.file);
          });
        } else {
          dataUri = await compressImage(bill.file);
        }

        const result = await processReceiptTransaction({
          imageDataUri: dataUri,
          availableCategories: categories.map(c => c.name),
          categoryDetails,
          model: selectedAiModel,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to analyze bill.');
        }

        const parsed = parseAiReceiptResult(result.data, bill.fileName, categories);

        // Update in queue
        setQueuedBills(prev => prev.map(b => {
          if (b.id !== bill.id) return b;
          return {
            ...b,
            previewUri: dataUri,
            status: 'ready',
            groupDescription: parsed.groupDescription,
            groupDate: parsed.groupDate,
            totalAmountInput: parsed.totalAmountInput,
            totalAmount: parsed.totalAmount,
            totalExpression: null,
            groupNotes: parsed.groupNotes,
            items: parsed.items,
          };
        }));

        // If this bill is active on screen right now, update form state
        if (activeBillIdRef.current === bill.id) {
          setReceiptDocPreview(dataUri);
          setReceiptDocType(bill.fileType);
          setReceiptDocName(bill.fileName);
          setGroupDescription(parsed.groupDescription);
          setGroupDate(parsed.groupDate);
          setTotalAmount(parsed.totalAmount);
          setTotalAmountInput(parsed.totalAmountInput);
          setTotalExpression(null);
          setGroupNotes(parsed.groupNotes);
          setItems(parsed.items);
        }

        toast({
          title: `Bill Scanned: ${parsed.groupDescription || bill.fileName}`,
          description: `Extracted ${parsed.items.length} items totaling ${formatCurrency(parsed.totalAmount)}.`,
        });
      } catch (err: any) {
        console.error('Receipt scan error:', err);
        setQueuedBills(prev => prev.map(b => b.id === bill.id ? {
          ...b,
          status: 'error',
          errorMessage: err?.message || 'Failed to analyze bill.',
        } : b));

        toast({
          title: `Scan Failed: ${bill.fileName}`,
          description: err?.message || 'Could not analyze document. You can still enter details manually.',
          variant: 'destructive',
        });
      } finally {
        isProcessingRef.current = false;
        setProcessingTick(t => t + 1);
      }
    };

    processBill(pendingBill);
  }, [queuedBills, processingTick, categories, categoryDetails, selectedAiModel, formatCurrency, toast]);

  const activeBillIndex = useMemo(() => {
    return queuedBills.findIndex(b => b.id === activeBillId);
  }, [queuedBills, activeBillId]);

  const activeBill = useMemo(() => {
    return queuedBills.find(b => b.id === activeBillId);
  }, [queuedBills, activeBillId]);

  const hasMoreUnsavedBills = useMemo(() => {
    return queuedBills.some(b => b.id !== activeBillId && b.status !== 'saved');
  }, [queuedBills, activeBillId]);

  const savedCount = useMemo(() => {
    return queuedBills.filter(b => b.status === 'saved').length;
  }, [queuedBills]);

  const isCurrentBillProcessing = useMemo(() => {
    return activeBill?.status === 'processing';
  }, [activeBill]);

  const goToNextBill = useCallback(() => {
    if (activeBillId) {
      syncCurrentFormToDraft(activeBillId);
    }
    const otherUnsaved = queuedBills.filter(b => b.id !== activeBillId && b.status !== 'saved');
    if (otherUnsaved.length > 0) {
      const currentIndex = queuedBills.findIndex(b => b.id === activeBillId);
      const nextAfterCurrent = queuedBills.slice(currentIndex + 1).find(b => b.status !== 'saved');
      const nextBill = nextAfterCurrent || otherUnsaved[0];
      setActiveBillId(nextBill.id);
      loadBillIntoForm(nextBill);
    }
  }, [activeBillId, queuedBills, syncCurrentFormToDraft, loadBillIntoForm]);

  // Handle total amount change with arithmetic calculation
  const handleTotalAmountChange = (val: string) => {
    setTotalAmountInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setTotalAmount(0);
      setTotalExpression(null);
      return;
    }
    const isExpr = /[+\-*/]/.test(trimmed);
    const evaluated = evaluateExpression(trimmed);
    if (evaluated !== null) {
      setTotalAmount(evaluated);
      setTotalExpression(isExpr ? trimmed : null);
    } else {
      const num = parseFloat(trimmed.replace(/,/g, ''));
      if (!isNaN(num)) {
        setTotalAmount(num);
        setTotalExpression(null);
      }
    }
  };

  // Handle item amount change
  const handleItemAmountChange = (id: string, val: string) => {
    const trimmed = val.trim();
    const isExpr = /[+\-*/]/.test(trimmed);
    const evaluated = evaluateExpression(trimmed);
    const numeric = evaluated !== null ? evaluated : (!isNaN(parseFloat(trimmed)) ? parseFloat(trimmed) : 0);

    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        rawAmount: val,
        evaluatedAmount: numeric,
        expression: isExpr && evaluated !== null ? trimmed : null,
      };
    }));
  };

  // Helper to update specific item field
  const updateItem = (id: string, updates: Partial<SplitItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      // If category changes and current subcategory is not in new category, reset subcategory
      if (updates.category && updates.category !== item.category) {
        const catObj = categories.find(c => c.name === updates.category);
        const hasSub = catObj?.subcategories.some(s => s.name === item.subcategory);
        if (!hasSub) {
          updated.subcategory = catObj?.subcategories[0]?.name || '';
          updated.microcategory = '';
        }
      }

      // If subcategory changes, reset microcategory if not in subcategory
      if (updates.subcategory && updates.subcategory !== item.subcategory) {
        const catObj = categories.find(c => c.name === (updates.category || item.category));
        const subObj = catObj?.subcategories.find(s => s.name === updates.subcategory);
        const hasMicro = subObj?.microcategories?.some(m => m.name === item.microcategory);
        if (!hasMicro) {
          updated.microcategory = '';
        }
      }

      return updated;
    }));
  };

  // Add a new item
  const addItem = (customAmount?: number) => {
    const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const remaining = totalAmount - totalAllocated;
    const initialAmount = customAmount !== undefined
      ? customAmount
      : (remaining > 0 ? remaining : '');

    const defaultCat = settings.defaultCategory && settings.defaultCategory !== 'none' ? settings.defaultCategory : (categories[0]?.name || '');
    const catObj = categories.find(c => c.name === defaultCat);
    const defaultSub = settings.defaultSubcategory && settings.defaultSubcategory !== 'none' ? settings.defaultSubcategory : (catObj?.subcategories[0]?.name || '');

    setItems(prev => [
      ...prev,
      {
        id: newId,
        rawAmount: initialAmount !== '' ? String(initialAmount) : '',
        evaluatedAmount: typeof initialAmount === 'number' ? initialAmount : 0,
        expression: null,
        description: '',
        category: defaultCat,
        subcategory: defaultSub,
        microcategory: '',
        notes: '',
      },
    ]);
  };

  // Duplicate an existing item
  const duplicateItem = (itemToDup: SplitItem) => {
    const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setItems(prev => [
      ...prev,
      {
        ...itemToDup,
        id: newId,
        description: itemToDup.description ? `${itemToDup.description} (Copy)` : '',
      },
    ]);
  };

  // Delete an item
  const deleteItem = (id: string) => {
    if (items.length <= 1) {
      toast({
        title: 'Cannot delete',
        description: 'At least one transaction item is required.',
        variant: 'destructive',
      });
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Calculation Metrics
  const totalAllocated = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number.isFinite(item.evaluatedAmount) ? item.evaluatedAmount : 0), 0);
  }, [items]);

  const remainingBalance = useMemo(() => {
    return Math.round((totalAmount - totalAllocated) * 100) / 100;
  }, [totalAmount, totalAllocated]);

  const isBalanced = useMemo(() => {
    return totalAmount > 0 && Math.abs(remainingBalance) < 0.01;
  }, [totalAmount, remainingBalance]);

  // Is selected month locked?
  const isSelectedMonthLocked = useMemo(() => {
    if (!groupDate) return false;
    const year = getYear(groupDate);
    const month = getMonth(groupDate);
    return isMonthLocked(year, month);
  }, [groupDate, isMonthLocked]);

  // Reset form
  const resetForm = () => {
    setTotalAmountInput('');
    setTotalAmount(0);
    setTotalExpression(null);
    setGroupDescription('');
    setGroupDate(new Date());
    setGroupTime(format(new Date(), 'HH:mm'));
    setGroupNotes('');
    setReceiptDocPreview(null);
    setReceiptDocType(null);
    setReceiptDocName('');
    setItems([
      {
        id: `item-${Date.now()}`,
        rawAmount: '',
        evaluatedAmount: 0,
        expression: null,
        description: '',
        category: '',
        subcategory: '',
        microcategory: '',
        notes: '',
      },
    ]);
  };

  // Reset form and entire batch queue
  const resetAll = () => {
    resetForm();
    setQueuedBills([]);
    setActiveBillId(null);
  };

  // Build final transaction description
  // Requirement: "prefix saying top total amount rs and desc. then current trans and description."
  const buildFinalDescription = useCallback((item: SplitItem): string => {
    const topDesc = groupDescription.trim();
    const formattedTotal = totalAmount > 0 ? formatCurrency(totalAmount) : '';
    const itemDesc = item.description.trim() || item.subcategory || item.category || 'Item';
    const itemExpr = item.expression ? ` (${item.expression})` : '';

    if (topDesc && formattedTotal) {
      return `${topDesc} (${formattedTotal}) - ${itemDesc}${itemExpr}`;
    } else if (topDesc) {
      return `${topDesc} - ${itemDesc}${itemExpr}`;
    } else if (formattedTotal) {
      return `Group ${formattedTotal} - ${itemDesc}${itemExpr}`;
    } else {
      return `${itemDesc}${itemExpr}`;
    }
  }, [groupDescription, totalAmount, formatCurrency]);

  // Prepare submission data and save
  const executeSave = async () => {
    if (isSelectedMonthLocked) {
      toast({
        title: 'Month Locked',
        description: 'The selected month is locked. Transactions cannot be added.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTenantId) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select a household/tenant first.',
        variant: 'destructive',
      });
      return;
    }

    // Validation
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.evaluatedAmount || item.evaluatedAmount <= 0) {
        toast({
          title: `Item #${i + 1} Missing Amount`,
          description: 'Each item must have an amount greater than zero.',
          variant: 'destructive',
        });
        return;
      }
      if (!item.category) {
        toast({
          title: `Item #${i + 1} Missing Category`,
          description: 'Please select a category for each item.',
          variant: 'destructive',
        });
        return;
      }
      if (!item.subcategory) {
        toast({
          title: `Item #${i + 1} Missing Subcategory`,
          description: 'Please select a subcategory for each item.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const dateStr = format(groupDate, 'yyyy-MM-dd');
      const timeStr = groupTime || format(new Date(), 'HH:mm');
      const chosenPaidBy = paidBy || paidByOptions[0] || 'Cash';

      const transactionsToCreate: Omit<Transaction, 'id' | 'tenantId' | 'userId'>[] = items.map(item => {
        const catObj = categories.find(c => c.name === item.category);
        const subObj = catObj?.subcategories.find(s => s.name === item.subcategory);
        const microObj = subObj?.microcategories?.find(m => m.name === item.microcategory);

        const finalDesc = buildFinalDescription(item);
        const combinedNotes = [
          groupNotes.trim() ? `Group: ${groupNotes.trim()}` : null,
          item.notes.trim() ? item.notes.trim() : null,
        ].filter(Boolean).join(' | ');

        return {
          date: dateStr,
          time: timeStr,
          description: finalDesc,
          amount: item.evaluatedAmount,
          categoryId: catObj?.id || '',
          subcategoryId: subObj?.id || '',
          microcategoryId: microObj?.id || '',
          category: item.category,
          subcategory: item.subcategory,
          microcategory: item.microcategory || '',
          paidBy: chosenPaidBy,
          notes: combinedNotes,
        };
      });

      await addMultipleTransactions(transactionsToCreate);

      // Multi-bill batch queue support
      if (activeBillId) {
        setQueuedBills(prev => prev.map(b => b.id === activeBillId ? { ...b, status: 'saved' } : b));
      }

      const remainingUnsaved = queuedBills.filter(b => b.id !== activeBillId && b.status !== 'saved');

      if (remainingUnsaved.length > 0) {
        // Find next bill (preferably sequentially after activeBillIndex)
        const currentIndex = queuedBills.findIndex(b => b.id === activeBillId);
        const nextAfterCurrent = queuedBills.slice(currentIndex + 1).find(b => b.status !== 'saved');
        const nextBill = nextAfterCurrent || remainingUnsaved[0];

        toast({
          title: `Bill Saved: ${groupDescription || receiptDocName || 'Group Transaction'}`,
          description: `Saved ${transactionsToCreate.length} items (${formatCurrency(totalAllocated)}). Now reviewing next bill.`,
        });

        setActiveBillId(nextBill.id);
        loadBillIntoForm(nextBill);
      } else {
        toast({
          title: 'All Group Transactions Saved!',
          description: `Successfully created ${transactionsToCreate.length} transactions totaling ${formatCurrency(totalAllocated)}.`,
        });
        router.push('/transactions');
      }
    } catch (error: any) {
      console.error('Error saving group transactions:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save group transactions.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setShowConfirmMismatchDialog(false);
    }
  };

  const handleSaveClick = () => {
    // If total amount was entered and there is a mismatch, prompt confirmation
    if (totalAmount > 0 && Math.abs(remainingBalance) >= 0.01) {
      setShowConfirmMismatchDialog(true);
      return;
    }
    executeSave();
  };

  const chipRadioClasses = "cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground";

  return (
    <div className="flex flex-col gap-6 pb-28 sm:pb-20 max-w-4xl mx-auto">
      {/* Hidden File Inputs for Camera, Image, and PDF */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,.png,.jpg,.jpeg,.webp"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input
        type="file"
        ref={pdfInputRef}
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            onClick={() => router.push('/transactions')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Group Transactions</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Enter a bulk bill or scan an image / PDF receipt to split across multiple categories.
            </p>
          </div>
        </div>

        {/* Top Action Buttons: Direct Upload Buttons & Reset */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Direct Upload Image Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isScanningReceipt}
            onClick={() => imageInputRef.current?.click()}
            className="border-primary/50 text-foreground hover:bg-accent hover:text-accent-foreground font-semibold text-xs shadow-sm gap-1.5 h-9 cursor-pointer"
            title="Upload bill images (PNG/JPG/WEBP) - Select multiple files supported"
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span>Upload Image</span>
            <span className="text-[10px] text-muted-foreground font-mono font-normal">PNG/JPG</span>
          </Button>

          {/* Direct Upload PDF Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isScanningReceipt}
            onClick={() => pdfInputRef.current?.click()}
            className="border-primary/50 text-foreground hover:bg-accent hover:text-accent-foreground font-semibold text-xs shadow-sm gap-1.5 h-9 cursor-pointer"
            title="Upload bill documents (PDF) - Select multiple files supported"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Upload PDF</span>
            <span className="text-[10px] text-muted-foreground font-mono font-normal">PDF</span>
          </Button>

          {/* Direct Camera Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isScanningReceipt}
            onClick={() => cameraInputRef.current?.click()}
            className="text-xs h-9 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground border-border/60 cursor-pointer"
            title="Take Photo with Camera"
          >
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Camera</span>
          </Button>

          {/* Quick AI Model Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2 text-xs font-mono text-muted-foreground hover:text-foreground gap-1 border-border/60"
                title={`Active AI Model: ${selectedAiModel}`}
              >
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[110px] truncate">{selectedAiModel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs">Active Gemini Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {GEMINI_MODELS.filter(m => m.value !== 'custom').map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  className={cn(
                    "cursor-pointer text-xs justify-between py-1.5",
                    selectedAiModel === m.value && "font-semibold text-primary bg-primary/10"
                  )}
                  onClick={() => setSelectedAiModel(m.value)}
                >
                  <span className="truncate">{m.label} {m.isNew ? '🔥' : ''}</span>
                  {selectedAiModel === m.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* AI Processing Alert */}
      {isScanningReceipt && (
        <Alert className="bg-primary/10 border-primary/30 animate-pulse">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary font-medium text-xs sm:text-sm flex items-center justify-between">
            <span>
              Gemini is analyzing bill document(s), extracting line items, and matching category guidelines...
              {queuedBills.length > 1 && ` (${queuedBills.filter(b => b.status === 'ready' || b.status === 'saved').length}/${queuedBills.length} ready)`}
            </span>
            <Loader2 className="h-4 w-4 animate-spin shrink-0 ml-2" />
          </AlertDescription>
        </Alert>
      )}

      {/* Batch Bill Queue Bar */}
      {queuedBills.length > 0 && (
        <div className="flex flex-col gap-2 p-3 sm:p-4 rounded-xl border border-primary/20 bg-muted/40 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                Bill Queue ({savedCount}/{queuedBills.length} Saved)
              </span>
              <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">
                Reviewing {activeBillIndex + 1} of {queuedBills.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
                title="Add more bill images to queue"
              >
                <Plus className="h-3 w-3" />
                <span>Add Image</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 cursor-pointer"
                onClick={() => pdfInputRef.current?.click()}
                title="Add more bill PDFs to queue"
              >
                <Plus className="h-3 w-3" />
                <span>Add PDF</span>
              </Button>
            </div>
          </div>

          {/* Queue Bill Items */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            {queuedBills.map((bill, index) => {
              const isActive = bill.id === activeBillId;
              return (
                <div
                  key={bill.id}
                  onClick={() => switchActiveBill(bill.id)}
                  className={cn(
                    "group relative flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all shrink-0 select-none",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30"
                      : bill.status === 'saved'
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                      : bill.status === 'error'
                      ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  )}
                >
                  {bill.status === 'processing' && (
                    <Loader2 className={cn("h-3.5 w-3.5 animate-spin", isActive ? "text-primary-foreground" : "text-primary")} />
                  )}
                  {bill.status === 'saved' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  {bill.status === 'error' && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  {bill.status === 'ready' && (
                    <Receipt className={cn("h-3.5 w-3.5", isActive ? "text-primary-foreground" : "text-primary")} />
                  )}
                  {bill.status === 'pending' && (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}

                  <div className="flex flex-col text-left">
                    <span className="truncate max-w-[130px] sm:max-w-[160px] font-semibold text-[11px]">
                      {index + 1}. {bill.groupDescription || bill.fileName}
                    </span>
                    <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {bill.status === 'saved'
                        ? 'Saved ✓'
                        : bill.status === 'processing'
                        ? 'Analyzing...'
                        : bill.status === 'error'
                        ? 'Failed (Click to edit)'
                        : bill.totalAmount > 0
                        ? formatCurrency(bill.totalAmount)
                        : bill.fileType.toUpperCase()}
                    </span>
                  </div>

                  {bill.status === 'error' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryBill(bill.id);
                      }}
                      className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      title="Retry AI scan"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}

                  {bill.status !== 'saved' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBillFromQueue(bill.id);
                      }}
                      className={cn(
                        "ml-1 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity",
                        isActive ? "hover:bg-white/20 text-primary-foreground" : "hover:bg-muted-foreground/20 text-muted-foreground"
                      )}
                      title="Remove from queue"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document / Receipt Thumbnail Banner (if document loaded) */}
      {receiptDocPreview && (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-primary/20 bg-muted/40 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {receiptDocType === 'pdf' ? (
              <div
                className="h-10 w-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 cursor-pointer text-primary"
                onClick={() => setShowDocDialog(true)}
                title="View PDF Document"
              >
                <FileText className="h-5 w-5" />
              </div>
            ) : (
              <div
                className="relative h-10 w-10 rounded-md overflow-hidden border border-border shrink-0 cursor-pointer group"
                onClick={() => setShowDocDialog(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptDocPreview} alt="Receipt" className="h-full w-full object-cover group-hover:opacity-80 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            )}

            <div className="truncate">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{receiptDocName || (receiptDocType === 'pdf' ? 'Bill Document.pdf' : 'Scanned Receipt')}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 uppercase">
                  {receiptDocType || 'Doc'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Click thumbnail to view attached bill</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowDocDialog(true)}
            >
              <Eye className="mr-1 h-3 w-3" />
              View
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => {
                setReceiptDocPreview(null);
                setReceiptDocType(null);
                setReceiptDocName('');
              }}
              title="Remove Attachment"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* MASTER / TOP SECTION: Total Amount & Group Info */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Group Purchase Details</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              Step 1: Total & Store Info
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Enter the total bill amount and store/merchant description, or scan a bill image.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Top Amount & Description Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Amount Input with Calculator */}
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount" className="text-sm font-semibold flex items-center justify-between">
                <span>Total Bill Amount ({settings.currency})</span>
                {totalExpression && (
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                    = {formatCurrency(totalAmount)}
                  </Badge>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="totalAmount"
                  type="text"
                  inputMode="text"
                  placeholder="e.g. 1000 or 500+250+250"
                  value={totalAmountInput}
                  onChange={(e) => handleTotalAmountChange(e.target.value)}
                  className="text-lg sm:text-xl font-bold h-11 tracking-tight"
                />
              </div>
              {totalAmount > 0 && (
                <p className="text-[11px] text-muted-foreground italic truncate">
                  {numberToWords(totalAmount)}
                </p>
              )}
            </div>

            {/* Store / Merchant / Group Description */}
            <div className="space-y-1.5">
              <Label htmlFor="groupDescription" className="text-sm font-semibold">
                Store / Purchase Description
              </Label>
              <Input
                id="groupDescription"
                placeholder="e.g. DMart Supermarket, Monthly Groceries, Amazon"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Will prefix each item (e.g. <span className="font-medium text-foreground">{groupDescription ? `${groupDescription} (${totalAmount > 0 ? formatCurrency(totalAmount) : '₹Total'}) - Milk` : 'DMart (₹1,000) - Milk'}</span>)
              </p>
            </div>
          </div>

          {/* Date, Time, and Paid By Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date</Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setGroupDate(prev => subDays(prev, 1))}
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 h-9 px-2.5 text-xs font-normal justify-between"
                    >
                      <span>{format(groupDate, 'MMM dd, yyyy')}</span>
                      <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={groupDate}
                      onSelect={(d) => d && setGroupDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setGroupDate(prev => addDays(prev, 1))}
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Time Picker */}
            <div className="space-y-1.5">
              <Label htmlFor="groupTime" className="text-xs font-medium text-muted-foreground">Time</Label>
              <Input
                id="groupTime"
                type="time"
                value={groupTime}
                onChange={(e) => setGroupTime(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Paid By Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Paid By</Label>
              <RadioGroup
                value={paidBy}
                onValueChange={setPaidBy}
                className="flex flex-wrap gap-1.5 pt-0.5"
              >
                {paidByOptions.map((option) => (
                  <div key={option}>
                    <RadioGroupItem value={option} id={`group-paidby-${option}`} className="sr-only peer" />
                    <Label
                      htmlFor={`group-paidby-${option}`}
                      className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs uppercase font-medium transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LIVE ALLOCATION SUMMARY BAR */}
      <Card className={cn(
        "border shadow-sm transition-colors",
        isBalanced ? "border-emerald-500/40 bg-emerald-500/5" :
        remainingBalance > 0 ? "border-amber-500/40 bg-amber-500/5" :
        "border-rose-500/40 bg-rose-500/5"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : remainingBalance > 0 ? (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {isBalanced ? 'Fully Balanced' : remainingBalance > 0 ? 'Unallocated Amount' : 'Overallocated Amount'}
                  </span>
                  <Badge
                    variant={isBalanced ? "default" : remainingBalance > 0 ? "secondary" : "destructive"}
                    className={cn(
                      "text-xs font-semibold",
                      isBalanced && "bg-emerald-600 hover:bg-emerald-600 text-white"
                    )}
                  >
                    {isBalanced ? '✓ 100% Split' : `${formatCurrency(Math.abs(remainingBalance))} ${remainingBalance > 0 ? 'left' : 'over'}`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total Bill: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span> &bull;
                  Allocated: <span className="font-semibold text-foreground">{formatCurrency(totalAllocated)}</span> across {items.length} item{items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {remainingBalance > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addItem(remainingBalance)}
                  className="text-xs border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Remaining ({formatCurrency(remainingBalance)})
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => addItem()}
                className="text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ITEMS SECTION: SPLIT TRANSACTIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Split Items ({items.length})</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addItem()}
            className="text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>

        {items.map((item, index) => {
          const catObj = categories.find(c => c.name === item.category);
          const subcategories = catObj?.subcategories || [];
          const subObj = subcategories.find(s => s.name === item.subcategory);
          const microcategories = subObj?.microcategories || [];
          const previewDesc = buildFinalDescription(item);

          return (
            <Card key={item.id} className="relative overflow-hidden border shadow-sm transition-all hover:border-primary/40">
              {/* Item Header */}
              <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5">
                    #{index + 1}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {item.description || item.subcategory || item.category || 'New Item'}
                  </span>
                  {item.evaluatedAmount > 0 && (
                    <Badge variant="secondary" className="font-semibold text-xs text-primary">
                      {formatCurrency(item.evaluatedAmount)}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => duplicateItem(item)}
                    title="Duplicate Item"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteItem(item.id)}
                    disabled={items.length <= 1}
                    title="Delete Item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Amount and Description Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Item Amount Input */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Item Amount ({settings.currency})</span>
                      {item.expression && (
                        <span className="text-[10px] font-mono text-primary">
                          = {formatCurrency(item.evaluatedAmount)}
                        </span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="text"
                        placeholder="e.g. 60 or 100+50+240"
                        value={item.rawAmount}
                        onChange={(e) => handleItemAmountChange(item.id, e.target.value)}
                        className="font-bold text-base h-10 tracking-tight"
                      />
                    </div>
                    {item.evaluatedAmount > 0 && (
                      <p className="text-[10px] text-muted-foreground italic truncate">
                        {numberToWords(item.evaluatedAmount)}
                      </p>
                    )}
                  </div>

                  {/* Item Description / Name */}
                  <div className="sm:col-span-8 space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Item Name / Specific Description
                    </Label>
                    <Input
                      placeholder="e.g. Milk, Fruits, Nonveg, Cleaning supplies..."
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Category Selection Chips */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    1. Select Category
                  </Label>
                  <RadioGroup
                    value={item.category}
                    onValueChange={(val) => updateItem(item.id, { category: val })}
                    className="flex flex-wrap gap-1.5"
                  >
                    {categories.map((cat) => (
                      <div key={cat.id}>
                        <RadioGroupItem value={cat.name} id={`cat-${item.id}-${cat.id}`} className="sr-only peer" />
                        <Label htmlFor={`cat-${item.id}-${cat.id}`} className={chipRadioClasses}>
                          {cat.name}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Subcategory Selection Chips */}
                {item.category && subcategories.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      2. Select Subcategory ({item.category})
                    </Label>
                    <RadioGroup
                      value={item.subcategory}
                      onValueChange={(val) => updateItem(item.id, { subcategory: val })}
                      className="flex flex-wrap gap-1.5"
                    >
                      {subcategories.map((sub) => (
                        <div key={sub.id}>
                          <RadioGroupItem value={sub.name} id={`sub-${item.id}-${sub.id}`} className="sr-only peer" />
                          <Label htmlFor={`sub-${item.id}-${sub.id}`} className={chipRadioClasses}>
                            {sub.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Microcategory Selection Chips (if any) */}
                {item.subcategory && microcategories.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      3. Select Micro Category (Optional)
                    </Label>
                    <RadioGroup
                      value={item.microcategory}
                      onValueChange={(val) => updateItem(item.id, { microcategory: val })}
                      className="flex flex-wrap gap-1.5"
                    >
                      <div>
                        <RadioGroupItem value="" id={`micro-${item.id}-none`} className="sr-only peer" />
                        <Label htmlFor={`micro-${item.id}-none`} className={chipRadioClasses}>
                          None
                        </Label>
                      </div>
                      {microcategories.map((micro) => (
                        <div key={micro.id}>
                          <RadioGroupItem value={micro.name} id={`micro-${item.id}-${micro.id}`} className="sr-only peer" />
                          <Label htmlFor={`micro-${item.id}-${micro.id}`} className={chipRadioClasses}>
                            {micro.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Final Description Live Preview */}
                <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-muted/20 p-2.5 rounded-md">
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                    <span className="font-semibold text-foreground/80 shrink-0">Saved as:</span>
                    <span className="font-mono text-primary font-medium truncate">{previewDesc}</span>
                  </div>
                  <div className="shrink-0 text-muted-foreground text-[11px]">
                    {item.category}{item.subcategory ? ` › ${item.subcategory}` : ''}{item.microcategory ? ` › ${item.microcategory}` : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Another Item Button Bottom */}
        <Button
          type="button"
          variant="outline"
          onClick={() => addItem()}
          className="w-full py-5 border-dashed border-2 hover:border-primary text-sm font-medium gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Another Split Item
        </Button>
      </div>

      {/* STICKY BOTTOM ACTION BAR (OPTIMIZED FOR MOBILE & DESKTOP) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t p-3 sm:p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Total Split:</span>
              <span className="text-sm sm:text-base font-bold text-foreground">
                {formatCurrency(totalAllocated)}
              </span>
              {totalAmount > 0 && (
                <span className="text-xs text-muted-foreground">
                  / {formatCurrency(totalAmount)}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''} &bull;{' '}
              {isBalanced ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Balanced</span>
              ) : remainingBalance > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(remainingBalance)} remaining</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">{formatCurrency(Math.abs(remainingBalance))} over</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex text-xs cursor-pointer"
              onClick={() => router.push('/transactions')}
            >
              Cancel
            </Button>
            {hasMoreUnsavedBills && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goToNextBill}
                className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex cursor-pointer"
                title="Review next bill without saving this one yet"
              >
                Next Bill
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSaveClick}
              disabled={isSubmitting || isSelectedMonthLocked || items.length === 0 || isCurrentBillProcessing}
              className="px-4 sm:px-6 font-semibold text-xs sm:text-sm h-10 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isCurrentBillProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Bill...
                </>
              ) : hasMoreUnsavedBills ? (
                <>
                  Save & Next Bill ({activeBillIndex + 1}/{queuedBills.length})
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </>
              ) : queuedBills.length > 1 ? (
                <>
                  Save & Finish ({items.length} items)
                  <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-400" />
                </>
              ) : (
                `Save Group (${items.length})`
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Full Document / Receipt Viewer Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base truncate">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{receiptDocName || 'Attached Bill / Receipt'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-black/5 dark:bg-black/20 rounded-md">
            {receiptDocPreview && receiptDocType === 'pdf' ? (
              <iframe
                src={receiptDocPreview}
                title="PDF Receipt"
                className="w-full h-[70vh] rounded-md border-0 bg-white"
              />
            ) : receiptDocPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receiptDocPreview}
                alt="Full Receipt"
                className="max-h-[70vh] w-auto object-contain rounded-md shadow"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Mismatch Alert Dialog */}
      <AlertDialog open={showConfirmMismatchDialog} onOpenChange={setShowConfirmMismatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Allocation Mismatch
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                The total bill amount is <strong>{formatCurrency(totalAmount)}</strong>, but the sum of your {items.length} split items is <strong>{formatCurrency(totalAllocated)}</strong>.
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Difference: {formatCurrency(Math.abs(remainingBalance))} {remainingBalance > 0 ? 'unallocated' : 'overallocated'}.
              </p>
              <p>
                Do you want to proceed and save these {items.length} transactions as they are?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back & Adjust</AlertDialogCancel>
            <AlertDialogAction onClick={executeSave}>
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Reset Alert Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Group Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all entered amounts, store descriptions, receipt attachments, and split items. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetAll(); setShowResetDialog(false); }}>
              Reset Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
