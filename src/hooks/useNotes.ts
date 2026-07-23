'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Note, NoteListItem, User } from '@/lib/types';
import { logChange } from '@/lib/logger';

export function useNotes(tenantId: string | null, user: User | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setNotes([]);
      setLoadingNotes(false);
      return;
    }

    setLoadingNotes(true);
    const q = query(
      collection(db, 'notes'),
      where('tenantId', '==', tenantId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Note[] = [];
        snapshot.forEach((d) => {
          data.push({ id: d.id, ...d.data() } as Note);
        });
        // Sort: pinned first, then by updatedAt desc
        data.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setNotes(data);
        setLoadingNotes(false);
      },
      (error) => {
        console.error('Error fetching notes:', error);
        setLoadingNotes(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const addNote = useCallback(async (
    data: Omit<Note, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!tenantId || !user) throw new Error('User or tenant not available');
    const now = new Date().toISOString();
    const raw = {
      ...data,
      tenantId,
      userId: user.name,
      createdAt: now,
      updatedAt: now,
    };
    // Strip undefined values — Firestore rejects them
    const noteData = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
    const docRef = await addDoc(collection(db, 'notes'), noteData);
    await logChange(tenantId, user.name, 'CREATE', 'notes', docRef.id, `Created note: ${data.title}`, undefined, noteData);
  }, [tenantId, user]);

  const editNote = useCallback(async (id: string, data: Partial<Omit<Note, 'id' | 'tenantId' | 'userId' | 'createdAt'>>) => {
    if (!tenantId || !user) return;
    const oldNote = notes.find((n) => n.id === id);
    // Strip undefined values — Firestore rejects them
    const cleanData = Object.fromEntries(
      Object.entries({ ...data, updatedAt: new Date().toISOString() }).filter(([, v]) => v !== undefined)
    );
    const noteRef = doc(db, 'notes', id);
    await updateDoc(noteRef, cleanData);
    await logChange(tenantId, user.name, 'UPDATE', 'notes', id, `Updated note: ${oldNote?.title || id}`, oldNote, { ...oldNote, ...cleanData });
  }, [tenantId, user, notes]);

  const deleteNote = useCallback(async (id: string) => {
    if (!tenantId || !user) return;
    const noteToDelete = notes.find((n) => n.id === id);

    // Optimistic update
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      await deleteDoc(doc(db, 'notes', id));
      if (noteToDelete) {
        await logChange(tenantId, user.name, 'DELETE', 'notes', id, `Deleted note: ${noteToDelete.title}`, noteToDelete, undefined);
      }
    } catch (error) {
      console.error('Error deleting note, reverting:', error);
      if (noteToDelete) {
        setNotes((prev) => [...prev, noteToDelete].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      }
      throw error;
    }
  }, [tenantId, user, notes]);

  const toggleNoteItem = useCallback(async (noteId: string, itemId: string) => {
    if (!tenantId || !user) return;
    const note = notes.find((n) => n.id === noteId);
    if (!note || !note.items) return;

    const updatedItems: NoteListItem[] = note.items.map((item) =>
      item.id === itemId ? { ...item, isDone: !item.isDone } : item
    );

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, items: updatedItems, updatedAt: new Date().toISOString() } : n))
    );

    try {
      const noteRef = doc(db, 'notes', noteId);
      await updateDoc(noteRef, { items: updatedItems, updatedAt: new Date().toISOString() });
    } catch (error) {
      // Revert on error
      setNotes((prev) => prev.map((n) => (n.id === noteId ? note : n)));
      throw error;
    }
  }, [tenantId, user, notes]);

  const pinNote = useCallback(async (id: string, pin: boolean) => {
    if (!tenantId || !user) return;
    await editNote(id, { isPinned: pin });
  }, [tenantId, user, editNote]);

  const archiveNote = useCallback(async (id: string) => {
    if (!tenantId || !user) return;
    const note = notes.find((n) => n.id === id);
    await editNote(id, { isArchived: !note?.isArchived });
  }, [tenantId, user, notes, editNote]);

  const dismissNoteReminder = useCallback(async (id: string) => {
    if (!tenantId || !user) return;
    await editNote(id, { reminderDismissed: true });
  }, [tenantId, user, editNote]);

  return {
    notes,
    loadingNotes,
    addNote,
    editNote,
    deleteNote,
    toggleNoteItem,
    pinNote,
    archiveNote,
    dismissNoteReminder,
  };
}
