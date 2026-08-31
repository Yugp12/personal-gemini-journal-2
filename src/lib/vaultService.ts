import {
  collection,
  doc,
  setDoc,
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
import type { VaultRecord, VaultCategory } from '../types';

export function subscribeToVaultRecords(
  userId: string,
  onUpdate: (records: VaultRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    throw new Error('User ID is required to query private vault records.');
  }

  const colRef = collection(db, 'users', userId, 'vaultRecords');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Private Record',
          content: data.content || '',
          category: (data.category as VaultCategory) || 'Personal',
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || data.createdAt || Timestamp.now()
        } as VaultRecord;
      });
      onUpdate(records);
    },
    (err) => {
      console.error('Firestore Vault sync error:', err);
      if (onError) onError(err);
    }
  );
}

// Backward compatibility alias
export const subscribeToVault = subscribeToVaultRecords;

export async function createVaultRecord(
  userId: string,
  title: string,
  content: string,
  category: VaultCategory | string = 'Personal'
): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required to save a vault record.');
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();

  if (!trimmedTitle) {
    throw new Error('Title is required for private vault records.');
  }

  if (!trimmedContent) {
    throw new Error('Content is required for private vault records.');
  }

  const colRef = collection(db, 'users', userId, 'vaultRecords');
  const newDoc = doc(colRef);
  const id = newDoc.id;

  await setDoc(newDoc, {
    id,
    userId,
    title: trimmedTitle,
    content: trimmedContent,
    category: category || 'Personal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return id;
}

// Backward compatibility alias
export const createVaultItem = createVaultRecord;

export async function updateVaultRecord(
  userId: string,
  recordId: string,
  title: string,
  content: string,
  category: VaultCategory | string
): Promise<void> {
  if (!userId || !recordId) {
    throw new Error('User ID and Record ID are required to update a vault record.');
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();

  if (!trimmedTitle) {
    throw new Error('Title cannot be empty.');
  }

  if (!trimmedContent) {
    throw new Error('Content cannot be empty.');
  }

  const docRef = doc(db, 'users', userId, 'vaultRecords', recordId);
  await updateDoc(docRef, {
    title: trimmedTitle,
    content: trimmedContent,
    category: category || 'Personal',
    updatedAt: serverTimestamp()
  });
}

// Backward compatibility alias
export const updateVaultItem = updateVaultRecord;

export async function deleteVaultRecord(userId: string, recordId: string): Promise<void> {
  if (!userId || !recordId) {
    throw new Error('User ID and Record ID are required to delete a vault record.');
  }
  const docRef = doc(db, 'users', userId, 'vaultRecords', recordId);
  await deleteDoc(docRef);
}

// Backward compatibility alias
export const deleteVaultItem = deleteVaultRecord;

