import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Conversation, Message } from '../types';

export function generateTitleFromMessage(message: string): string {
  const clean = message.trim().replace(/^["']|["']$/g, '').replace(/\n+/g, ' ');
  if (!clean) return 'New Conversation';
  if (clean.length <= 40) return clean;
  const truncated = clean.slice(0, 37);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 15) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

export function subscribeToConversations(
  userId: string,
  onUpdate: (convs: Conversation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', userId, 'conversations');
  const q = query(colRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const convs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'New Conversation',
          lastMessage: data.lastMessage || undefined,
          lastMessageAt: data.lastMessageAt || undefined,
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || Timestamp.now()
        } as Conversation;
      });
      onUpdate(convs);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function createConversation(userId: string, title: string): Promise<string> {
  const colRef = collection(db, 'users', userId, 'conversations');
  const newDoc = doc(colRef);
  const id = newDoc.id;

  await setDoc(newDoc, {
    id,
    userId,
    title: title.trim() || 'New Conversation',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp()
  });

  return id;
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string
): Promise<void> {
  const convRef = doc(db, 'users', userId, 'conversations', conversationId);
  await updateDoc(convRef, {
    title: title.trim() || 'Untitled Conversation',
    updatedAt: serverTimestamp()
  });
}

export function subscribeToMessages(
  userId: string,
  conversationId: string,
  onUpdate: (msgs: Message[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const q = query(colRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          role: data.role,
          content: data.content,
          createdAt: data.createdAt || Timestamp.now()
        } as Message;
      });
      onUpdate(msgs);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function addMessage(
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant' | 'model',
  content: string
): Promise<string> {
  const convRef = doc(db, 'users', userId, 'conversations', conversationId);
  const msgRef = doc(collection(convRef, 'messages'));
  const id = msgRef.id;

  await setDoc(msgRef, {
    id,
    role,
    content,
    createdAt: serverTimestamp()
  });

  const preview = content.trim().slice(0, 80);
  await setDoc(
    convRef, 
    { 
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: preview
    }, 
    { merge: true }
  );

  return id;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const convRef = doc(db, 'users', userId, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');
  
  try {
    const messagesSnap = await getDocs(messagesRef);
    const deletePromises = messagesSnap.docs.map((m) => deleteDoc(m.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error clearing subcollection messages:', err);
  }

  await deleteDoc(convRef);
}
