import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { JournalEntry, CreateJournalInput, UpdateJournalInput, AIReflection } from '../types';

function assertValidUserId(userId: string | undefined): asserts userId is string {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Unauthorized: An authenticated User ID is required.');
  }
}

/**
 * Get reference to the journalEntries collection under the user's UID partition
 */
export function getJournalEntriesCollectionRef(userId: string) {
  assertValidUserId(userId);
  return collection(db, 'users', userId, 'journalEntries');
}

/**
 * Get reference to a specific journal entry document
 */
export function getJournalEntryDocRef(userId: string, entryId: string) {
  assertValidUserId(userId);
  if (!entryId || typeof entryId !== 'string' || entryId.trim() === '') {
    throw new Error('Invalid entry ID provided.');
  }
  return doc(db, 'users', userId, 'journalEntries', entryId);
}

/**
 * Create a new journal entry under users/{uid}/journalEntries/{entryId}
 */
export async function createJournalEntry(
  uid: string,
  titleOrInput: string | CreateJournalInput,
  contentParam?: string
): Promise<string> {
  assertValidUserId(uid);

  let title = '';
  let content = '';
  let mood = '😊';
  let tags: string[] = [];

  if (typeof titleOrInput === 'object') {
    title = (titleOrInput.title || '').trim();
    content = (titleOrInput.content || '').trim();
    if (titleOrInput.mood) mood = titleOrInput.mood;
    if (titleOrInput.tags) tags = titleOrInput.tags;
  } else {
    title = (titleOrInput || '').trim();
    content = (contentParam || '').trim();
  }

  if (!title) {
    throw new Error('Title cannot be empty.');
  }
  if (!content) {
    throw new Error('Content cannot be empty.');
  }

  try {
    const colRef = getJournalEntriesCollectionRef(uid);
    const docRef = await addDoc(colRef, {
      title,
      content,
      mood,
      tags,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(docRef, { id: docRef.id });
    return docRef.id;
  } catch (err: unknown) {
    console.error('Error creating journal entry:', err);
    throw new Error('Unable to save this entry.');
  }
}

/**
 * Fetch all journal entries for a user, ordered newest first
 */
export async function getJournalEntries(uid: string): Promise<JournalEntry[]> {
  assertValidUserId(uid);
  try {
    const colRef = getJournalEntriesCollectionRef(uid);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: uid,
        title: data.title || '',
        content: data.content || '',
        mood: data.mood || '😊',
        tags: data.tags || [],
        reflection: data.reflection,
        aiReflection: data.aiReflection,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || data.createdAt || Timestamp.now()
      } as JournalEntry;
    });
  } catch (err: unknown) {
    console.error('Error fetching journal entries:', err);
    throw new Error('Unable to load your journal entries.');
  }
}

/**
 * Subscribe to real-time updates for a user's journal entries
 */
export function subscribeToJournalEntries(
  uid: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  assertValidUserId(uid);
  const colRef = getJournalEntriesCollectionRef(uid);
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: uid,
          title: data.title || '',
          content: data.content || '',
          mood: data.mood || '😊',
          tags: data.tags || [],
          reflection: data.reflection,
          aiReflection: data.aiReflection,
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || data.createdAt || Timestamp.now()
        } as JournalEntry;
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) {
        onError(new Error('Unable to load your journal entries.'));
      }
    }
  );
}

/**
 * Update an existing journal entry
 */
export async function updateJournalEntry(
  uid: string,
  entryId: string,
  titleOrInput: string | UpdateJournalInput,
  contentParam?: string
): Promise<void> {
  assertValidUserId(uid);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp()
  };

  if (typeof titleOrInput === 'object') {
    if (titleOrInput.title !== undefined) payload.title = titleOrInput.title.trim();
    if (titleOrInput.content !== undefined) payload.content = titleOrInput.content.trim();
    if (titleOrInput.mood !== undefined) payload.mood = titleOrInput.mood;
    if (titleOrInput.tags !== undefined) payload.tags = titleOrInput.tags;
  } else {
    const trimmedTitle = (titleOrInput || '').trim();
    const trimmedContent = (contentParam || '').trim();
    if (!trimmedTitle) throw new Error('Title cannot be empty.');
    if (!trimmedContent) throw new Error('Content cannot be empty.');
    payload.title = trimmedTitle;
    payload.content = trimmedContent;
  }

  try {
    const docRef = getJournalEntryDocRef(uid, entryId);
    await updateDoc(docRef, payload);
  } catch (err: unknown) {
    console.error('Error updating journal entry:', err);
    throw new Error('Unable to update this entry.');
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(uid: string, entryId: string): Promise<void> {
  assertValidUserId(uid);
  try {
    const docRef = getJournalEntryDocRef(uid, entryId);
    await deleteDoc(docRef);
  } catch (err: unknown) {
    console.error('Error deleting journal entry:', err);
    throw new Error('Unable to delete this entry.');
  }
}

/**
 * Save structured AI reflection to a journal entry
 */
export async function saveJournalAIReflection(
  userId: string,
  entryId: string,
  aiReflection: Omit<AIReflection, 'generatedAt'> & { generatedAt?: any }
): Promise<void> {
  assertValidUserId(userId);
  try {
    const docRef = getJournalEntryDocRef(userId, entryId);
    const reflectionPayload = {
      summary: aiReflection.summary,
      insights: aiReflection.insights || [],
      questions: aiReflection.questions || [],
      suggestedTags: aiReflection.suggestedTags || [],
      generatedAt: serverTimestamp()
    };

    await updateDoc(docRef, {
      aiReflection: reflectionPayload,
      updatedAt: serverTimestamp()
    });
  } catch (err: unknown) {
    console.error('Error saving AI reflection:', err);
    throw new Error('Unable to save AI reflection.');
  }
}

/**
 * Add unique tags to a journal entry
 */
export async function addJournalTags(
  userId: string,
  entryId: string,
  currentTags: string[],
  newTagsToAdd: string[]
): Promise<string[]> {
  assertValidUserId(userId);
  
  const existingSet = new Set(currentTags.map(t => t.toLowerCase().replace(/^#/, '')));
  const mergedTags = [...currentTags];

  newTagsToAdd.forEach(tag => {
    const clean = tag.trim().replace(/^#/, '');
    if (clean && !existingSet.has(clean.toLowerCase())) {
      existingSet.add(clean.toLowerCase());
      mergedTags.push(clean);
    }
  });

  try {
    const docRef = getJournalEntryDocRef(userId, entryId);
    await updateDoc(docRef, {
      tags: mergedTags,
      updatedAt: serverTimestamp()
    });
    return mergedTags;
  } catch (err: unknown) {
    console.error('Error updating journal tags:', err);
    throw new Error('Unable to update tags.');
  }
}

/**
 * Save reflection insight helper (legacy support)
 */
export async function saveJournalReflection(
  userId: string,
  entryId: string,
  reflection: string
): Promise<void> {
  assertValidUserId(userId);
  try {
    const docRef = getJournalEntryDocRef(userId, entryId);
    await updateDoc(docRef, {
      reflection,
      updatedAt: serverTimestamp()
    });
  } catch (err: unknown) {
    console.error('Error saving reflection:', err);
    throw new Error('Unable to save reflection.');
  }
}
