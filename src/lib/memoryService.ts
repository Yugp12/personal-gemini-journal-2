import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  type Unsubscribe,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Memory, MemoryCategory } from '../types';

export function normalizeMemoryContent(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isDuplicateMemory(
  existingList: Memory[],
  newContent: string,
  excludeId?: string
): boolean {
  const normalizedNew = normalizeMemoryContent(newContent);
  return existingList.some(
    (m) => m.id !== excludeId && normalizeMemoryContent(m.content) === normalizedNew
  );
}

export function subscribeToMemories(
  userId: string,
  onUpdate: (memories: Memory[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', userId, 'memories');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const mems = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          content: data.content || '',
          category: data.category || 'Other',
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || Timestamp.now()
        } as Memory;
      });
      onUpdate(mems);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function fetchUserMemories(userId: string, maxCount: number = 20): Promise<Memory[]> {
  const colRef = collection(db, 'users', userId, 'memories');
  const q = query(colRef, orderBy('updatedAt', 'desc'), limit(maxCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId || userId,
      content: data.content || '',
      category: data.category || 'Other',
      createdAt: data.createdAt || Timestamp.now(),
      updatedAt: data.updatedAt || Timestamp.now()
    } as Memory;
  });
}

export async function createMemory(
  userId: string,
  content: string,
  category: MemoryCategory | string = 'Personal Context'
): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Memory content cannot be empty.');
  }

  const colRef = collection(db, 'users', userId, 'memories');
  const newDoc = doc(colRef);
  const id = newDoc.id;

  await setDoc(newDoc, {
    id,
    userId,
    content: trimmed,
    category: category || 'Personal Context',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return id;
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  content: string,
  category: MemoryCategory | string
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Memory content cannot be empty.');
  }

  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await updateDoc(docRef, {
    content: trimmed,
    category: category || 'Personal Context',
    updatedAt: serverTimestamp()
  });
}

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await deleteDoc(docRef);
}
