'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { voiceToText } from '@/ai/flows/voice-to-text';
import type { Note, NoteVariety, NoteType, NoteColor, NoteListItem } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoiceRecorder } from './voice-recorder';
import {
  PlusCircle,
  Trash2,
  Mic,
  Square,
  Loader2,
  StickyNote,
  FileText,
  List,
  Volume2,
  Bell,
  CheckSquare,
  ShoppingCart,
  BookOpen,
  Pin,
  PinOff,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const NOTE_VARIETIES: { value: NoteVariety; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'quick', label: 'Quick Note', icon: StickyNote, desc: 'A short one-liner' },
  { value: 'detailed', label: 'Detailed', icon: FileText, desc: 'Long text + voice-to-text' },
  { value: 'list', label: 'List', icon: List, desc: 'Items with checkboxes' },
  { value: 'voice', label: 'Voice Note', icon: Volume2, desc: 'Record audio' },
];

const NOTE_TYPES: { value: NoteType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'general', label: 'General', icon: BookOpen, desc: 'Just a memory aid' },
  { value: 'reminder', label: 'Reminder', icon: Bell, desc: 'Set a date/time alert' },
  { value: 'todo', label: 'To-Do', icon: CheckSquare, desc: 'Tasks to complete' },
  { value: 'shopping', label: 'Shopping List', icon: ShoppingCart, desc: 'Items to buy' },
];

const NOTE_COLORS: { value: NoteColor; bg: string; picker: string; ring: string; label: string }[] = [
  { value: 'default', bg: 'bg-card border',                                                                   picker: 'bg-slate-500',   ring: 'ring-slate-500',   label: 'Default' },
  { value: 'yellow',  bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',      picker: 'bg-yellow-400',  ring: 'ring-yellow-400',  label: 'Yellow'  },
  { value: 'red',     bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',                  picker: 'bg-red-400',     ring: 'ring-red-400',     label: 'Red'     },
  { value: 'green',   bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',          picker: 'bg-green-400',   ring: 'ring-green-400',   label: 'Green'   },
  { value: 'blue',    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',              picker: 'bg-blue-400',    ring: 'ring-blue-400',    label: 'Blue'    },
  { value: 'purple',  bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',      picker: 'bg-purple-400',  ring: 'ring-purple-400',  label: 'Purple'  },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

interface NoteDialogProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  noteId?: string | null;
}

export function NoteDialog({ open, setOpen, noteId }: NoteDialogProps) {
  const { notes, addNote, editNote } = useApp();
  const { toast } = useToast();
  const existingNote = noteId ? notes.find((n) => n.id === noteId) : null;
  const isEditing = !!existingNote;

  // Form state
  const [title, setTitle] = useState('');
  const [variety, setVariety] = useState<NoteVariety>('quick');
  const [type, setType] = useState<NoteType>('general');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [content, setContent] = useState('');
  const [items, setItems] = useState<NoteListItem[]>([{ id: generateId(), text: '', isDone: false }]);
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(undefined);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // Voice-to-text for detailed notes
  const [isRecordingVTT, setIsRecordingVTT] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const vttRecorderRef = useRef<MediaRecorder | null>(null);
  const vttChunksRef = useRef<Blob[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (existingNote) {
        setTitle(existingNote.title);
        setVariety(existingNote.variety);
        setType(existingNote.type);
        setColor(existingNote.color);
        setIsPinned(existingNote.isPinned);
        setContent(existingNote.content || '');
        setItems(existingNote.items?.length ? existingNote.items : [{ id: generateId(), text: '', isDone: false }]);
        setAudioDataUrl(existingNote.audioDataUrl);
        setReminderDate(existingNote.reminderDate || '');
        setReminderTime(existingNote.reminderTime || '');
      } else {
        setTitle('');
        setVariety('quick');
        setType('general');
        setColor('default');
        setIsPinned(false);
        setContent('');
        setItems([{ id: generateId(), text: '', isDone: false }]);
        setAudioDataUrl(undefined);
        setReminderDate('');
        setReminderTime(format(new Date(), 'HH:mm'));
      }
    }
  }, [open, existingNote]);

  // Voice-to-text handlers
  const startVTT = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      vttRecorderRef.current = recorder;
      vttChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) vttChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(vttChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          setIsTranscribing(true);
          try {
            const result = await voiceToText({ audioDataUri: reader.result as string });
            if (result.transcript) {
              setContent((prev) => prev ? `${prev}\n${result.transcript}` : result.transcript);
            }
          } catch (err: any) {
            toast({ title: 'Transcription Failed', description: err.message, variant: 'destructive' });
          } finally {
            setIsTranscribing(false);
          }
        };
      };
      recorder.start();
      setIsRecordingVTT(true);
    } catch {
      toast({ title: 'Mic Access Denied', description: 'Please enable microphone permissions.', variant: 'destructive' });
    }
  }, [toast]);

  const stopVTT = useCallback(() => {
    if (vttRecorderRef.current && isRecordingVTT) {
      vttRecorderRef.current.stop();
      setIsRecordingVTT(false);
    }
  }, [isRecordingVTT]);

  // List item handlers
  const addItem = () => setItems((prev) => [...prev, { id: generateId(), text: '', isDone: false }]);
  const updateItem = (id: string, text: string) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for the note.', variant: 'destructive' });
      return;
    }

    const validItems = items.filter((i) => i.text.trim());

    setIsSaving(true);
    try {
      // Build base data — only include fields with real values (Firestore rejects undefined)
      const noteData: Omit<Note, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        variety,
        type,
        color,
        isPinned,
        isArchived: existingNote?.isArchived ?? false,
        reminderDismissed: existingNote?.reminderDismissed ?? false,
      };

      // Content — only for quick / detailed varieties
      if (variety === 'quick' || variety === 'detailed') {
        noteData.content = content || '';
      }

      // Items — only for list variety
      if (variety === 'list') {
        noteData.items = validItems;
      }

      // Audio — only for voice variety (and only if recorded)
      if (variety === 'voice' && audioDataUrl) {
        noteData.audioDataUrl = audioDataUrl;
      }

      // Reminder date/time — only for reminder type (and only if set)
      if (type === 'reminder') {
        if (reminderDate) noteData.reminderDate = reminderDate;
        if (reminderTime) noteData.reminderTime = reminderTime;
      }

      if (isEditing && noteId) {
        await editNote(noteId, noteData);
        toast({ title: 'Note Updated' });
      } else {
        await addNote(noteData);
        toast({ title: 'Note Saved' });
      }
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? 'Edit Note' : 'New Note'}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsPinned((p) => !p)}
              className={cn('h-8 w-8', isPinned ? 'text-amber-500' : 'text-muted-foreground')}
              title={isPinned ? 'Unpin note' : 'Pin note'}
            >
              {isPinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              placeholder="Give your note a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-medium"
            />
          </div>

          {/* Note Type */}
          <div className="space-y-2">
            <Label>Note Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all text-sm',
                    type === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium leading-none">{label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Date/Time — only for reminder type */}
          {type === 'reminder' && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="space-y-1">
                <Label htmlFor="reminder-date" className="text-xs">Remind on Date</Label>
                <Input
                  id="reminder-date"
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reminder-time" className="text-xs">Time</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="text-sm h-8"
                />
              </div>
            </div>
          )}

          {/* Note Variety */}
          <div className="space-y-2">
            <Label>Content Format</Label>
            <Tabs value={variety} onValueChange={(v) => setVariety(v as NoteVariety)}>
              <TabsList className="grid grid-cols-4 h-auto p-1">
                {NOTE_VARIETIES.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="flex-col gap-1 py-2 h-auto text-xs">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:block">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Variety Content */}
          {variety === 'quick' && (
            <Input
              placeholder="Write your quick note here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}

          {variety === 'detailed' && (
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="Write your detailed note here... (Tamil, English, or Tanglish)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[140px] pr-12"
                />
                <Button
                  type="button"
                  variant={isRecordingVTT ? 'destructive' : 'ghost'}
                  size="icon"
                  onClick={isRecordingVTT ? stopVTT : startVTT}
                  disabled={isTranscribing}
                  className={cn(
                    'absolute bottom-2 right-2 h-8 w-8 rounded-full',
                    isRecordingVTT && 'animate-pulse'
                  )}
                  title={isRecordingVTT ? 'Stop & transcribe' : 'Speak to add text (Tamil/English/Tanglish)'}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRecordingVTT ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isRecordingVTT && (
                <p className="text-xs text-destructive animate-pulse">
                  🎙️ Listening... Tap the mic button to stop and transcribe.
                </p>
              )}
              {isTranscribing && (
                <p className="text-xs text-primary animate-pulse flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Gemini is transcribing your voice...
                </p>
              )}
            </div>
          )}

          {variety === 'list' && (
            <div className="space-y-2">
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}.</span>
                    <Input
                      placeholder={`Item ${idx + 1}`}
                      value={item.text}
                      onChange={(e) => updateItem(item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                      }}
                      className="flex-1"
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
          )}

          {variety === 'voice' && (
            <VoiceRecorder
              audioDataUrl={audioDataUrl}
              onChange={setAudioDataUrl}
            />
          )}

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              {NOTE_COLORS.map(({ value, picker, ring, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  title={label}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-all duration-150 flex items-center justify-center',
                    picker,
                    color === value
                      ? `ring-2 ring-offset-2 ring-offset-background scale-110 ${ring}`
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  )}
                >
                  {color === value && (
                    <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
