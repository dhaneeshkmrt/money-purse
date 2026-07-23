'use client';

import { useState, useRef, useCallback } from 'react';
import type { Note } from '@/lib/types';
import { useApp } from '@/lib/provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  MoreVertical,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Pencil,
  Play,
  Pause,
  Bell,
  CheckSquare,
  ShoppingCart,
  BookOpen,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

// Card background + left accent border per color
const COLOR_STYLE: Record<string, { card: string; accent: string }> = {
  default: { card: 'bg-card',                                                              accent: 'border-l-border' },
  yellow:  { card: 'bg-yellow-100/80 dark:bg-yellow-900/30',                               accent: 'border-l-yellow-400' },
  red:     { card: 'bg-red-100/80 dark:bg-red-900/30',                                     accent: 'border-l-red-400' },
  green:   { card: 'bg-green-100/80 dark:bg-green-900/30',                                 accent: 'border-l-green-400' },
  blue:    { card: 'bg-blue-100/80 dark:bg-blue-900/30',                                   accent: 'border-l-blue-400' },
  purple:  { card: 'bg-purple-100/80 dark:bg-purple-900/30',                               accent: 'border-l-purple-400' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; badgeClass: string }> = {
  general: { label: 'General', icon: BookOpen, badgeClass: 'bg-muted text-muted-foreground' },
  reminder: { label: 'Reminder', icon: Bell, badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  todo: { label: 'To-Do', icon: CheckSquare, badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  shopping: { label: 'Shopping', icon: ShoppingCart, badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
};

interface NoteCardProps {
  note: Note;
  onEdit: (id: string) => void;
}

export function NoteCard({ note, onEdit }: NoteCardProps) {
  const { deleteNote, pinNote, archiveNote, toggleNoteItem, dismissNoteReminder } = useApp();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const typeConfig = TYPE_CONFIG[note.type];
  const TypeIcon = typeConfig.icon;

  const doneCount = note.items?.filter((i) => i.isDone).length ?? 0;
  const totalCount = note.items?.length ?? 0;

  const handleDelete = async () => {
    try {
      await deleteNote(note.id);
      toast({ title: 'Note deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handlePin = async () => {
    await pinNote(note.id, !note.isPinned);
  };

  const handleArchive = async () => {
    await archiveNote(note.id);
    toast({ title: note.isArchived ? 'Note restored' : 'Note archived' });
  };

  const togglePlay = useCallback(() => {
    if (!note.audioDataUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(note.audioDataUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [note.audioDataUrl, isPlaying]);

  const handleToggleItem = async (itemId: string) => {
    try {
      await toggleNoteItem(note.id, itemId);
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const isOverdue = note.type === 'reminder' && note.reminderDate && !note.reminderDismissed &&
    new Date(`${note.reminderDate}T${note.reminderTime || '00:00'}`) < new Date();

  const colorStyle = COLOR_STYLE[note.color] || COLOR_STYLE.default;

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl border border-l-4 p-4 transition-all duration-200 hover:shadow-md',
          colorStyle.card,
          colorStyle.accent,
          note.isPinned && 'ring-1 ring-amber-400/50'
        )}
      >
        {/* Pin indicator */}
        {note.isPinned && (
          <Pin className="absolute top-3 right-10 h-3.5 w-3.5 text-amber-500 fill-amber-500 opacity-60" />
        )}

        {/* Actions menu */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(note.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePin}>
                {note.isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                {note.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                {note.isArchived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                {note.isArchived ? 'Restore' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Header */}
        <div className="flex items-start gap-2 mb-2 pr-8">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug truncate">{note.title}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge
                variant="secondary"
                className={cn('text-xs px-1.5 py-0 h-5 gap-1', typeConfig.badgeClass)}
              >
                <TypeIcon className="h-3 w-3" />
                {typeConfig.label}
              </Badge>
              {note.type === 'reminder' && note.reminderDate && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs px-1.5 py-0 h-5',
                    isOverdue && !note.reminderDismissed
                      ? 'border-red-400 text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {format(parseISO(note.reminderDate), 'dd MMM')}
                  {note.reminderTime && ` · ${note.reminderTime}`}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content body */}
        {(note.variety === 'quick' || note.variety === 'detailed') && note.content && (
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{note.content}</p>
        )}

        {note.variety === 'list' && note.items && note.items.length > 0 && (
          <div className="space-y-1.5 mt-1">
            {/* Progress bar for todo/shopping */}
            {(note.type === 'todo' || note.type === 'shopping') && totalCount > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(doneCount / totalCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{doneCount}/{totalCount}</span>
              </div>
            )}
            <div className="space-y-1">
              {note.items.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-center gap-2 w-full text-left group/item"
                >
                  <div className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all',
                    item.isDone
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40 group-hover/item:border-primary/60'
                  )}>
                    {item.isDone && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  <span className={cn(
                    'text-sm',
                    item.isDone && 'line-through text-muted-foreground'
                  )}>
                    {item.text}
                  </span>
                </button>
              ))}
              {note.items.length > 6 && (
                <p className="text-xs text-muted-foreground pl-6">+{note.items.length - 6} more items</p>
              )}
            </div>
          </div>
        )}

        {note.variety === 'voice' && note.audioDataUrl && (
          <div className="flex items-center gap-2 mt-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground">Voice note — tap to {isPlaying ? 'pause' : 'play'}</span>
          </div>
        )}

        {/* Reminder dismiss button */}
        {note.type === 'reminder' && note.reminderDate && !note.reminderDismissed && (
          <div className="mt-3 pt-2 border-t border-current/10">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => dismissNoteReminder(note.id)}
              className="h-7 text-xs w-full"
            >
              <Check className="mr-1.5 h-3 w-3" /> Dismiss Reminder
            </Button>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60 mt-3">
          {format(new Date(note.updatedAt), 'dd MMM, h:mm a')}
        </p>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &ldquo;{note.title}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
