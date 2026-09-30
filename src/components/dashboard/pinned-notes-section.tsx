'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NoteViewDialog } from '@/components/notes/note-view-dialog';
import { NoteDialog } from '@/components/notes/note-dialog';
import type { Note, NoteType } from '@/lib/types';
import {
  Pin,
  PinOff,
  Bell,
  CheckSquare,
  ShoppingCart,
  BookOpen,
  Check,
  ExternalLink,
  MoreVertical,
  Eye,
  Pencil,
  Loader2,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TYPE_CONFIG: Record<NoteType, { label: string; icon: React.ElementType; badgeClass: string }> = {
  general: { label: 'General', icon: BookOpen, badgeClass: 'bg-muted text-muted-foreground' },
  reminder: { label: 'Reminder', icon: Bell, badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  todo: { label: 'To-Do', icon: CheckSquare, badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  shopping: { label: 'Shopping', icon: ShoppingCart, badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
};

const COLOR_STYLE: Record<string, { border: string; bg: string }> = {
  default: { border: 'border-l-border', bg: 'bg-card' },
  yellow: { border: 'border-l-yellow-400', bg: 'bg-yellow-50/50 dark:bg-yellow-950/20' },
  red: { border: 'border-l-red-400', bg: 'bg-red-50/50 dark:bg-red-950/20' },
  green: { border: 'border-l-green-400', bg: 'bg-green-50/50 dark:bg-green-950/20' },
  blue: { border: 'border-l-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
  purple: { border: 'border-l-purple-400', bg: 'bg-purple-50/50 dark:bg-purple-950/20' },
};

function PinnedNoteItem({
  note,
  onView,
  onEdit,
  onUnpin,
}: {
  note: Note;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  const { toggleNoteItem, dismissNoteReminder } = useApp();
  const typeConfig = TYPE_CONFIG[note.type] || TYPE_CONFIG.general;
  const TypeIcon = typeConfig.icon;
  const colorStyle = COLOR_STYLE[note.color] || COLOR_STYLE.default;

  const doneCount = note.items?.filter((i) => i.isDone).length ?? 0;
  const totalCount = note.items?.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const reminderDateTime = note.reminderDate
    ? new Date(`${note.reminderDate}T${note.reminderTime || '00:00'}`)
    : null;
  const isOverdue = reminderDateTime ? isPast(reminderDateTime) && !isToday(reminderDateTime) : false;
  const isTodayDue = reminderDateTime ? isToday(reminderDateTime) : false;

  return (
    <div
      onClick={() => onView(note.id)}
      className={cn(
        'group relative rounded-lg border border-l-4 p-3 transition-all duration-150 hover:shadow-sm cursor-pointer',
        colorStyle.border,
        colorStyle.bg
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {note.title}
          </h4>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUnpin(note.id)}
            className="h-6 w-6 text-amber-500 hover:text-amber-600 rounded"
            title="Unpin Note"
          >
            <Pin className="h-3.5 w-3.5 fill-amber-500" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                aria-label="Note options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(note.id)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(note.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUnpin(note.id)}>
                <PinOff className="mr-2 h-4 w-4" /> Unpin Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Badges / metadata */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 font-normal', typeConfig.badgeClass)}>
          {typeConfig.label}
        </Badge>
        {note.type === 'reminder' && note.reminderDate && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 h-4',
              isOverdue && !note.reminderDismissed
                ? 'border-red-400 text-red-600 dark:text-red-400'
                : isTodayDue
                ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            )}
          >
            {format(parseISO(note.reminderDate), 'MMM dd')}
            {note.reminderTime && ` · ${note.reminderTime}`}
            {isOverdue && ' (Overdue)'}
            {isTodayDue && ' (Today)'}
          </Badge>
        )}
      </div>

      {/* Content preview for text / quick notes */}
      {note.content && (note.variety === 'quick' || note.variety === 'detailed' || !note.items?.length) && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {note.content}
        </p>
      )}

      {/* Checklist items for todo / shopping lists */}
      {note.items && note.items.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">{doneCount}/{totalCount}</span>
          </div>

          <div className="space-y-1">
            {note.items.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNoteItem(note.id, item.id);
                }}
                className="flex items-center gap-2 w-full text-left group/item"
              >
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                    item.isDone
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40 group-hover/item:border-primary/60'
                  )}
                >
                  {item.isDone && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>
                <span className={cn('text-xs truncate', item.isDone && 'line-through text-muted-foreground')}>
                  {item.text}
                </span>
              </button>
            ))}
            {note.items.length > 3 && (
              <p className="text-[11px] text-primary font-medium pl-5 pt-0.5">
                +{note.items.length - 3} more items
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PinnedNotesSection() {
  const { notes, loadingNotes, pinNote } = useApp();
  const { toast } = useToast();

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewNoteId, setViewNoteId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);

  const pinnedNotes = useMemo(() => {
    return notes.filter((n) => !n.isArchived && n.isPinned);
  }, [notes]);

  const activeReminderNotes = useMemo(() => {
    return notes.filter((n) =>
      n.type === 'reminder' &&
      !n.isArchived &&
      !n.reminderDismissed &&
      n.reminderDate &&
      isPast(new Date(`${n.reminderDate}T${n.reminderTime || '23:59'}`))
    );
  }, [notes]);

  const handleView = (id: string) => {
    setViewNoteId(id);
    setViewDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditNoteId(id);
    setEditDialogOpen(true);
  };

  const handleUnpin = async (id: string) => {
    try {
      await pinNote(id, false);
      toast({ title: 'Note unpinned' });
    } catch {
      toast({ title: 'Failed to unpin note', variant: 'destructive' });
    }
  };

  const selectedViewNote = useMemo(() => {
    return notes.find((n) => n.id === viewNoteId) || null;
  }, [notes, viewNoteId]);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />
                Pinned Notes
              </CardTitle>
              <CardDescription>
                {pinnedNotes.length > 0
                  ? `${pinnedNotes.length} pinned note${pinnedNotes.length > 1 ? 's' : ''} from Notes page`
                  : 'Quick access to your pinned notes.'}
              </CardDescription>
            </div>
            <Link href="/notes">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                View All <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {loadingNotes ? (
            <div className="flex justify-center items-center h-28">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeReminderNotes.length > 0 ? (
            <Tabs defaultValue="pinned">
              <TabsList className="mb-2">
                <TabsTrigger value="pinned">Pinned ({pinnedNotes.length})</TabsTrigger>
                <TabsTrigger value="due" className="text-red-600 dark:text-red-400">
                  Due Reminders ({activeReminderNotes.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pinned">
                {pinnedNotes.length > 0 ? (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {pinnedNotes.map((note) => (
                      <PinnedNoteItem
                        key={note.id}
                        note={note}
                        onView={handleView}
                        onEdit={handleEdit}
                        onUnpin={handleUnpin}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                    <Pin className="h-8 w-8 mb-2 opacity-30 text-amber-500" />
                    <p className="text-sm font-medium">No pinned notes</p>
                    <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
                      Pin important notes from the Notes page to keep them handy here.
                    </p>
                    <Link href="/notes" className="mt-3">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Go to Notes
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="due">
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {activeReminderNotes.map((note) => (
                    <PinnedNoteItem
                      key={note.id}
                      note={note}
                      onView={handleView}
                      onEdit={handleEdit}
                      onUnpin={handleUnpin}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          ) : pinnedNotes.length > 0 ? (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {pinnedNotes.map((note) => (
                <PinnedNoteItem
                  key={note.id}
                  note={note}
                  onView={handleView}
                  onEdit={handleEdit}
                  onUnpin={handleUnpin}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-2 text-amber-500">
                <Pin className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No pinned notes</p>
              <p className="text-xs text-muted-foreground max-w-[260px] mt-1">
                Pin your important notes or checklists from the Notes page to keep them handy here.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Link href="/notes">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    Go to Notes <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    setEditNoteId(null);
                    setEditDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> New Note
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note View Dialog */}
      <NoteViewDialog
        open={viewDialogOpen}
        setOpen={setViewDialogOpen}
        note={selectedViewNote}
        onEdit={(id) => {
          setViewDialogOpen(false);
          handleEdit(id);
        }}
      />

      {/* Note Edit Dialog */}
      <NoteDialog
        open={editDialogOpen}
        setOpen={setEditDialogOpen}
        noteId={editNoteId}
      />
    </>
  );
}
