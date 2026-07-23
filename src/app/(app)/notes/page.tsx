'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoteCard } from '@/components/notes/note-card';
import { NoteDialog } from '@/components/notes/note-dialog';
import type { NoteType } from '@/lib/types';
import {
  PlusCircle,
  Loader2,
  Search,
  Archive,
  BookOpen,
  Bell,
  CheckSquare,
  ShoppingCart,
  StickyNote,
  Pin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_FILTERS: { value: 'all' | NoteType; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: StickyNote },
  { value: 'general', label: 'General', icon: BookOpen },
  { value: 'reminder', label: 'Reminders', icon: Bell },
  { value: 'todo', label: 'To-Do', icon: CheckSquare },
  { value: 'shopping', label: 'Shopping', icon: ShoppingCart },
];

export default function NotesPage() {
  const { notes, loadingNotes } = useApp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | NoteType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const handleAdd = () => {
    setEditNoteId(null);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditNoteId(id);
    setDialogOpen(true);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (note.isArchived !== showArchived) return false;
      if (typeFilter !== 'all' && note.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content?.toLowerCase().includes(q);
        const inItems = note.items?.some((i) => i.text.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inItems) return false;
      }
      return true;
    });
  }, [notes, typeFilter, searchQuery, showArchived]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const unpinnedNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  const overdueCount = useMemo(() =>
    notes.filter((n) =>
      n.type === 'reminder' &&
      !n.isArchived &&
      !n.reminderDismissed &&
      n.reminderDate &&
      new Date(`${n.reminderDate}T${n.reminderTime || '00:00'}`) < new Date()
    ).length,
    [notes]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">My Notes</h1>
          <p className="text-muted-foreground">
            Jot down reminders, shopping lists, tasks and more.
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overdueCount} overdue
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={handleAdd} id="add-note-btn">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            id="notes-search"
          />
        </div>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived((p) => !p)}
          className="shrink-0"
          id="notes-archive-toggle"
        >
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? 'Showing Archived' : 'Archive'}
        </Button>
      </div>

      {/* Type filter tabs */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | NoteType)}>
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 h-8">
              <Icon className="h-3.5 w-3.5" />
              {label}
              {value !== 'all' && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 px-1 py-0 h-4 text-xs font-normal"
                >
                  {notes.filter((n) => !n.isArchived && n.type === value).length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {loadingNotes ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground">
          <StickyNote className="h-12 w-12 opacity-30" />
          <p className="text-sm">
            {showArchived
              ? 'No archived notes.'
              : searchQuery
              ? 'No notes match your search.'
              : 'No notes yet. Tap "+ New Note" to get started!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned section */}
          {pinnedNotes.length > 0 && !showArchived && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pinned</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onEdit={handleEdit} />
                ))}
              </div>
            </div>
          )}

          {/* Other notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && !showArchived && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Others</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinnedNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onEdit={handleEdit} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <NoteDialog open={dialogOpen} setOpen={setDialogOpen} noteId={editNoteId} />
    </div>
  );
}
