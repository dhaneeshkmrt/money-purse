'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Note } from '@/lib/types';
import { Bell, CheckSquare, ShoppingCart, Check, StickyNote, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

function ReminderNoteItem({ note }: { note: Note }) {
  const { dismissNoteReminder } = useApp();
  const reminderDateTime = note.reminderDate
    ? new Date(`${note.reminderDate}T${note.reminderTime || '00:00'}`)
    : null;
  const isOverdue = reminderDateTime ? isPast(reminderDateTime) && !isToday(reminderDateTime) : false;
  const isTodayDue = reminderDateTime ? isToday(reminderDateTime) : false;

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0">
      <div className={cn(
        'mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0',
        isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
        isTodayDue ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
        'bg-muted text-muted-foreground'
      )}>
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{note.title}</p>
        <p className="text-xs text-muted-foreground">
          {reminderDateTime ? format(reminderDateTime, 'dd MMM · h:mm a') : 'No date set'}
          {isOverdue && <span className="ml-1 text-red-500 font-medium">· Overdue</span>}
          {isTodayDue && <span className="ml-1 text-amber-500 font-medium">· Today</span>}
        </p>
        {note.content && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{note.content}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => dismissNoteReminder(note.id)}
        className="h-7 px-2 text-xs shrink-0"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function TodoNoteItem({ note }: { note: Note }) {
  const { toggleNoteItem } = useApp();
  const doneCount = note.items?.filter((i) => i.isDone).length ?? 0;
  const totalCount = note.items?.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const TypeIcon = note.type === 'shopping' ? ShoppingCart : CheckSquare;

  return (
    <div className="py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5">
        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-medium flex-1 truncate">{note.title}</p>
        <span className="text-xs text-muted-foreground shrink-0">{doneCount}/{totalCount}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {note.items && note.items.filter((i) => !i.isDone).slice(0, 2).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => toggleNoteItem(note.id, item.id)}
          className="flex items-center gap-2 w-full text-left mt-1.5 group/item"
        >
          <div className="h-3.5 w-3.5 rounded border border-muted-foreground/40 group-hover/item:border-primary/60 transition-colors shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{item.text}</span>
        </button>
      ))}
    </div>
  );
}

export default function NotesReminderSection() {
  const { notes, loadingNotes } = useApp();

  const now = new Date();

  const activeReminderNotes = useMemo(() =>
    notes.filter((n) =>
      n.type === 'reminder' &&
      !n.isArchived &&
      !n.reminderDismissed &&
      n.reminderDate &&
      isPast(new Date(`${n.reminderDate}T${n.reminderTime || '23:59'}`))
    ).sort((a, b) => {
      const da = new Date(`${a.reminderDate}T${a.reminderTime || '00:00'}`);
      const db2 = new Date(`${b.reminderDate}T${b.reminderTime || '00:00'}`);
      return da.getTime() - db2.getTime();
    }),
    [notes]
  );

  const pendingTodoNotes = useMemo(() =>
    notes.filter((n) =>
      (n.type === 'todo' || n.type === 'shopping') &&
      !n.isArchived &&
      n.items?.some((i) => !i.isDone)
    ).slice(0, 4),
    [notes]
  );

  const hasContent = activeReminderNotes.length > 0 || pendingTodoNotes.length > 0;

  if (loadingNotes || !hasContent) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes
            </CardTitle>
            <CardDescription>
              {activeReminderNotes.length > 0 && `${activeReminderNotes.length} reminder${activeReminderNotes.length > 1 ? 's' : ''} due`}
              {activeReminderNotes.length > 0 && pendingTodoNotes.length > 0 && ' · '}
              {pendingTodoNotes.length > 0 && `${pendingTodoNotes.length} pending list${pendingTodoNotes.length > 1 ? 's' : ''}`}
            </CardDescription>
          </div>
          <Link href="/notes">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              View All <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reminder notes */}
        {activeReminderNotes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Bell className="h-3 w-3" /> Reminders Due
            </p>
            <div>
              {activeReminderNotes.slice(0, 3).map((note) => (
                <ReminderNoteItem key={note.id} note={note} />
              ))}
              {activeReminderNotes.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{activeReminderNotes.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Todo/Shopping notes */}
        {pendingTodoNotes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> Pending Lists
            </p>
            <div>
              {pendingTodoNotes.map((note) => (
                <TodoNoteItem key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
