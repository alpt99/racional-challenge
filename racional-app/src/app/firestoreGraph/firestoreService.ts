// Client-side Firestore setup shared across the Firestore graph page.
"use client";

import { getApps, initializeApp } from "firebase/app";
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize once in the client runtime.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Small helper to read all docs from a collection.
export async function fetchCollectionDocs(collectionPath: string) {
  const snapshot = await getDocs(collection(db, collectionPath));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Domain model for investment evolution entries.
export interface InvestmentEvolution {
  contributions: number;
  portfolioIndex: number;
  portfolioValue: number;
  date: Timestamp; // Firestore timestamp
  dailyReturn: number;
}

// Listen to a single document (realtime). Returns the unsubscribe function.
export function subscribeToDocument<T = unknown>(
  documentPath: string,
  onData: (data: (T & { id: string }) | null) => void,
  onError?: (error: Error) => void
) {
  const ref = doc(db, documentPath);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...(snap.data() as T) });
    },
    (err) => {
      if (onError) onError(err);
      else console.error(err);
    }
  );
}
