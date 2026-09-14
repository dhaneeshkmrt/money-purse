'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, PlusCircle, Trash2, Copy, RefreshCw, Palette, Moon, Sun, Download, Sparkles, AlertCircle, Bot, Cpu, Building2, ChevronsUpDown, Check } from 'lucide-react';
import type { Settings, Tenant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { GEMINI_MODELS, DEFAULT_AI_MODEL } from '@/lib/ai-models';

export const dynamic = 'force-dynamic';

const countryLocales = [
  { value: 'en-US', label: 'United States (USD)' },
  { value: 'en-IN', label: 'India (INR)' },
  { value: 'en-GB', label: 'United Kingdom (GBP)' },
  { value: 'en-CA', label: 'Canada (CAD)' },
  { value: 'en-AU', label: 'Australia (AUD)' },
  { value: 'de-DE', label: 'Germany (EUR)' },
  { value: 'ja-JP', label: 'Japan (JPY)' },
];

const generateSecretToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

const settingsSchema = z.object({
  currency: z.string().min(1, 'Currency symbol is required.'),
  locale: z.string().min(1, 'Country selection is required.'),
  dateInputStyle: z.enum(['popup', 'inline']),
  defaultCategory: z.string().optional(),
  defaultSubcategory: z.string().optional(),
  defaultMicrocategory: z.string().optional(),
  defaultPaidBy: z.string().optional(),
  aiModel: z.string().optional(),
});

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  paidByOptions: z.array(z.object({
    name: z.string().min(1, 'Paid by option cannot be empty.'),
  })).min(1, 'At least one "Paid by" option is required.'),
  members: z.array(z.object({
    name: z.string().min(2, 'Member name must be at least 2 characters.'),
    email: z.string().email('Please enter a valid email for the member.'),
    mobileNo: z.string().optional(),
    secretToken: z.string().min(1, 'Secret Token is required.'),
  })).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type TenantFormValues = z.infer<typeof tenantSchema>;

const colorThemes = [
    { value: 'default', label: 'Default', preview: 'bg-primary' },
    { value: 'rainbow', label: 'Rainbow', preview: 'bg-gradient-to-r from-pink-500 to-cyan-500' },
    { value: 'ocean', label: 'Ocean', preview: 'bg-gradient-to-r from-blue-600 to-cyan-400' },
    { value: 'sunset', label: 'Sunset', preview: 'bg-gradient-to-r from-orange-500 to-pink-600' },
    { value: 'forest', label: 'Forest', preview: 'bg-gradient-to-r from-green-600 to-lime-500' },
    { value: 'electric', label: 'Electric', preview: 'bg-gradient-to-r from-purple-600 to-cyan-500' },
];

export default function SettingsPage() {
  const { 
    user, settings, updateSettings, loadingSettings, selectedTenantId, setSelectedTenantId, loadingTenants, isAdminUser, tenants, editTenant, 
    isMainTenantUser, generateCurrentMonthCsv, copyCurrentMonthToClipboard, selectedMonth, selectedMonthName, 
    selectedYear, categories 
  } = useApp();
  const { theme, colorTheme, setColorTheme, toggleTheme } = useTheme();
  const { toast } = useToast();
  
  const [isTenantSubmitting, setIsTenantSubmitting] = useState(false);
  const [tenantPopoverOpen, setTenantPopoverOpen] = useState(false);

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      currency: '₹',
      locale: 'en-IN',
      dateInputStyle: 'popup',
      defaultCategory: 'none',
      defaultSubcategory: 'none',
      defaultMicrocategory: 'none',
      defaultPaidBy: 'none',
      aiModel: DEFAULT_AI_MODEL,
    }
  });

  const tenantForm = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
        name: '',
        paidByOptions: [{ name: 'Cash' }],
        members: [],
    }
  });

  const { fields: paidByFields, append: appendPaidBy, remove: removePaidBy } = useFieldArray({
      control: tenantForm.control,
      name: "paidByOptions",
  });
  
  const { fields: memberFields, append: appendMember, remove: removeMember } = useFieldArray({
    control: tenantForm.control,
    name: "members",
  });

  useEffect(() => {
    if (settings && !settingsForm.formState.isDirty) {
      settingsForm.reset({
        currency: settings.currency || '₹',
        locale: settings.locale || 'en-IN',
        dateInputStyle: settings.dateInputStyle || 'popup',
        defaultCategory: settings.defaultCategory || 'none',
        defaultSubcategory: settings.defaultSubcategory || 'none',
        defaultMicrocategory: settings.defaultMicrocategory || 'none',
        defaultPaidBy: settings.defaultPaidBy || 'none',
        aiModel: settings.aiModel || DEFAULT_AI_MODEL,
      });
    }
  }, [settings, settingsForm.formState.isDirty, settingsForm.reset]);

  const resetTenantForm = useCallback((tenant: Tenant | undefined) => {
    if (tenant) {
      tenantForm.reset({
        name: tenant.name,
        paidByOptions: tenant.paidByOptions?.map(name => ({name})) || [{ name: 'Cash' }],
        members: tenant.members || [],
      });
    }
  }, [tenantForm]);
  
  useEffect(() => {
    const currentTenant = tenants.find(t => t.id === selectedTenantId);
    if (currentTenant && !tenantForm.formState.isDirty) {
      resetTenantForm(currentTenant);
    }
  }, [selectedTenantId, tenants, tenantForm.formState.isDirty, resetTenantForm]);

  const onSettingsSubmit = async (data: SettingsFormValues) => {
    if (!selectedTenantId) {
        toast({
          title: 'No Tenant Selected',
          description: 'Please select a tenant before saving settings.',
          variant: 'destructive',
        });
        return;
    }
    
    try {
      await updateSettings(data);
      toast({
        title: 'Settings Saved',
        description: 'Your personal settings have been saved successfully.',
      });
      settingsForm.reset(data);
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'An error occurred while saving settings.',
        variant: 'destructive',
      });
    }
  };

  const onSettingsError = (errors: any) => {
    console.error("Settings Form Errors:", errors);
    const firstError = Object.values(errors)[0] as any;
    toast({
      title: 'Validation Error',
      description: firstError?.message || 'Please check the form for errors.',
      variant: 'destructive',
    });
  };
  
  const onTenantSubmit = async (data: TenantFormValues) => {
    if (!selectedTenantId) return;
    setIsTenantSubmitting(true);
    const tenantData = {
        name: data.name,
        paidByOptions: data.paidByOptions.map(opt => opt.name).filter(Boolean),
        members: data.members || [],
    };

    try {
        await editTenant(selectedTenantId, tenantData);
        toast({
          title: 'Tenant Details Updated',
          description: 'Your tenant information has been updated successfully.',
        });
        tenantForm.reset(data);
    } catch(e) {
        console.error(e);
        toast({ title: "Update Failed", description: "Could not update tenant details.", variant: "destructive" });
    } finally {
        setIsTenantSubmitting(false);
    }
  };

  const handleCopyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: 'Copied!', description: 'Secret token copied to clipboard.' });
  }

  const handleDownload = () => {
    const csv = generateCurrentMonthCsv();
    if (!csv) {
        toast({
            title: 'No Data',
            description: `No transactions or budget data to export for ${selectedMonthName} ${selectedYear}.`,
            variant: 'destructive',
        });
        return;
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const monthName = format(new Date(selectedYear, selectedMonth), 'MMMM');
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions-${monthName}-${selectedYear}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  const handleCopyCsv = async () => {
    try {
      const success = await copyCurrentMonthToClipboard();
      if (!success) {
        toast({
          title: 'No Data',
          description: `No transactions or budget data to export for ${selectedMonthName} ${selectedYear}.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Copied to Clipboard!',
        description: `Spreadsheet data for ${selectedMonthName} ${selectedYear} copied. You can paste directly into Google Sheets or Excel cells.`,
      });
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy spreadsheet data to clipboard.',
        variant: 'destructive',
      });
    }
  }

  // Hierarchical Default Value Logic
  const watchedCategoryName = settingsForm.watch('defaultCategory');
  const watchedSubcategoryName = settingsForm.watch('defaultSubcategory');

  const availableSubcategories = useMemo(() => {
    if (!watchedCategoryName || watchedCategoryName === 'none') return [];
    return categories.find(c => c.name === watchedCategoryName)?.subcategories || [];
  }, [watchedCategoryName, categories]);

  const availableMicrocategories = useMemo(() => {
    if (!watchedSubcategoryName || watchedSubcategoryName === 'none' || !watchedCategoryName) return [];
    return availableSubcategories.find(s => s.name === watchedSubcategoryName)?.microcategories || [];
  }, [watchedSubcategoryName, availableSubcategories, watchedCategoryName]);

  const currentTenant = useMemo(() => tenants.find(t => t.id === selectedTenantId), [tenants, selectedTenantId]);
  const paidByOptions = useMemo(() => currentTenant?.paidByOptions || [], [currentTenant]);

  if (loadingSettings) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasFormErrors = Object.keys(settingsForm.formState.errors).length > 0;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Active Account
          </CardTitle>
          <CardDescription>
            {isAdminUser 
              ? "Select the active account/tenant to view and manage associated transactions, budgets, and settings."
              : "Your currently active account workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">
                  {currentTenant ? currentTenant.name : "No account selected"}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentTenant ? `Tenant ID: ${currentTenant.id}` : "Please select an account"}
              </p>
            </div>

            {isAdminUser && (
              <Popover open={tenantPopoverOpen} onOpenChange={setTenantPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tenantPopoverOpen}
                    className="w-full sm:w-[240px] justify-between cursor-pointer"
                    disabled={loadingTenants}
                  >
                    <span className="truncate">{currentTenant ? currentTenant.name : "Select account..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search account..." />
                    <CommandList>
                      <CommandEmpty>No account found.</CommandEmpty>
                      <CommandGroup>
                        {tenants.map((tenant) => (
                          <CommandItem
                            key={tenant.id}
                            value={tenant.name}
                            onSelect={() => {
                              setSelectedTenantId(tenant.id);
                              setTenantPopoverOpen(false);
                              toast({
                                title: "Account Switched",
                                description: `Switched active account to ${tenant.name}.`,
                              });
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTenantId === tenant.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{tenant.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>
      
      {isMainTenantUser && (
        <Card>
            <CardHeader>
                <CardTitle>Tenant Information</CardTitle>
                <CardDescription>Manage your tenant name, payment methods, and family members.</CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...tenantForm}>
                <form onSubmit={tenantForm.handleSubmit(onTenantSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                    <FormField
                      control={tenantForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="w-full md:w-1/3" disabled={isTenantSubmitting} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                        <FormLabel>Paid By Options</FormLabel>
                        <div className="space-y-2 mt-2">
                        {paidByFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                            <FormField
                                control={tenantForm.control}
                                name={`paidByOptions.${index}.name`}
                                render={({ field }) => (
                                <FormItem className="flex-grow">
                                    <FormControl>
                                    <Input {...field} placeholder="e.g., Credit Card" className="w-full md:w-1/3" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => removePaidBy(index)}
                            >
                            <Trash2 className="h-4 w-4" />
                            </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendPaidBy({ name: '' })}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Option
                        </Button>
                        </div>
                    </div>

                    <div>
                      <FormLabel>Family Members</FormLabel>
                      <div className="space-y-4 mt-2">
                        {memberFields.map((field, index) => (
                          <div key={field.id} className="p-4 border rounded-md relative space-y-2">
                             <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 text-destructive"
                              onClick={() => removeMember(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <FormField
                              control={tenantForm.control}
                              name={`members.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Member Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="e.g., Jane Doe"/>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={tenantForm.control}
                              name={`members.${index}.email`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Member Email</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="e.g., member@example.com"/>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={tenantForm.control}
                              name={`members.${index}.secretToken`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Member Secret Token</FormLabel>
                                  <div className="flex items-center gap-2">
                                    <FormControl>
                                      <Input readOnly {...field} />
                                    </FormControl>
                                    <Button type="button" variant="outline" size="icon" onClick={() => handleCopyToClipboard(field.value)}>
                                        <Copy className="h-4 w-4"/>
                                    </Button>
                                    <Button type="button" variant="outline" size="icon" onClick={() => tenantForm.setValue(`members.${index}.secretToken`, generateSecretToken())}>
                                        <RefreshCw className="h-4 w-4"/>
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                         <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => appendMember({ name: '', email: '', mobileNo: '', secretToken: generateSecretToken() })}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Member
                        </Button>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isTenantSubmitting || !tenantForm.formState.isDirty}>
                    {isTenantSubmitting && <Loader2 className="mr-2 animate-spin" />}
                    Save Tenant Details
                    </Button>
                </form>
            </Form>
            </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download or copy your financial data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium">Monthly Transactions & Budget Data</h3>
            <p className="text-sm text-muted-foreground">
              Download all transactions and budget data for {selectedMonthName} {selectedYear} as a CSV file or copy it to clipboard to paste directly into cells in Google Sheets or Excel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV for {selectedMonthName}
            </Button>
            <Button variant="outline" onClick={handleCopyCsv}>
              <Copy className="mr-2 h-4 w-4" />
              Copy for Google Sheets / Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode-toggle" className="flex items-center gap-2">
              <Moon />
              <span>Theme</span>
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              id="dark-mode-toggle"
            >
              {theme === 'dark' ? <Sun className="mr-2" /> : <Moon className="mr-2" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="color-theme-selector" className="flex items-center gap-2">
              <Palette />
              <span>Color Palette</span>
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button id="color-theme-selector" variant="outline">
                  {colorThemes.find(ct => ct.value === colorTheme)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {colorThemes.map((colorOption) => (
                  <DropdownMenuItem
                    key={colorOption.value}
                    onClick={() => setColorTheme(colorOption.value as any)}
                    className="flex items-center justify-between"
                  >
                    <span>{colorOption.label}</span>
                    <div className={`w-4 h-4 rounded-full ${colorOption.preview} ${
                      colorTheme === colorOption.value ? 'ring-2 ring-foreground' : ''
                    }`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personal Transaction Defaults
          </CardTitle>
          <CardDescription>Pre-fill values for new transactions to save time. These settings are private to you ({user?.name}).</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit, onSettingsError)} className="space-y-6">
              {hasFormErrors && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    Some fields in your settings are invalid. Please check all sections (Defaults and Regional) before saving.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={settingsForm.control}
                  name="defaultCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Category</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          settingsForm.setValue('defaultSubcategory', 'none', { shouldDirty: true });
                          settingsForm.setValue('defaultMicrocategory', 'none', { shouldDirty: true });
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No default" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="defaultSubcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Subcategory</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          settingsForm.setValue('defaultMicrocategory', 'none', { shouldDirty: true });
                        }} 
                        value={field.value}
                        disabled={!watchedCategoryName || watchedCategoryName === 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No default" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableSubcategories.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="defaultMicrocategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Micro Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={availableMicrocategories.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No default" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableMicrocategories.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="defaultPaidBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Paid By</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No default" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {paidByOptions.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={settingsForm.formState.isSubmitting || !settingsForm.formState.isDirty}>
                {settingsForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Save My Defaults
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI & Intelligence Models
          </CardTitle>
          <CardDescription>Select or customize the Google Gemini model used for receipt scanning, voice notes, and smart categorization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit, onSettingsError)} className="space-y-4">
              <FormField
                control={settingsForm.control}
                name="aiModel"
                render={({ field }) => {
                  const isPredefined = GEMINI_MODELS.some(m => m.value === field.value && m.value !== 'custom');
                  const selectedSelectValue = isPredefined ? field.value : 'custom';

                  return (
                    <div className="space-y-4">
                      <FormItem>
                        <FormLabel>Gemini AI Model</FormLabel>
                        <Select
                          value={selectedSelectValue || 'gemini-2.0-flash'}
                          onValueChange={(val) => {
                            if (val === 'custom') {
                              if (isPredefined) field.onChange('gemini-3.7-flash');
                            } else {
                              field.onChange(val);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full md:w-2/3">
                              <SelectValue placeholder="Select Gemini model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GEMINI_MODELS.map(m => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label} {m.isNew ? '🔥' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          If a model experiences temporary high demand (503), switch to <strong>Gemini 2.0 Flash</strong> for high availability.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>

                      {(!isPredefined || selectedSelectValue === 'custom') && (
                        <FormItem>
                          <FormLabel>Custom Model Identifier</FormLabel>
                          <FormControl>
                            <Input
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              placeholder="e.g. gemini-2.5-flash or gemini-3.0-flash"
                              className="w-full md:w-2/3 font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter any newly released Google Gemini model ID to use it immediately.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    </div>
                  );
                }}
              />
              <Button type="submit" disabled={settingsForm.formState.isSubmitting || !settingsForm.formState.isDirty}>
                {settingsForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Save AI Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
           <CardDescription>Configure personal currency and formatting preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit, onSettingsError)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={settingsForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency Symbol</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="w-full md:w-2/3"
                            disabled={!selectedTenantId}
                            placeholder="e.g. ₹, $, €"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                      <Label htmlFor="locale">Country for Formatting</Label>
                      <Controller
                          name="locale"
                          control={settingsForm.control}
                          render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value} disabled={!selectedTenantId}>
                                  <SelectTrigger className="w-full md:w-2/3">
                                      <SelectValue placeholder="Select a country" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {countryLocales.map(cl => (
                                          <SelectItem key={cl.value} value={cl.value}>
                                              {cl.label}
                                          </SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          )}
                      />
                  </div>
                  <FormField
                    control={settingsForm.control}
                    name="dateInputStyle"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-1 md:col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel>Date Input Style</FormLabel>
                          <FormDescription>
                            Show a full calendar instead of a popup in the transaction form.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === 'inline'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'inline' : 'popup')}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
              </div>
              <Button type="submit" disabled={settingsForm.formState.isSubmitting || !settingsForm.formState.isDirty || !selectedTenantId}>
                {settingsForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Save My Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
