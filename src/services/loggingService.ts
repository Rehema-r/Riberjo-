import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface ActivityLogInput {
  type: string;
  userId: string;
  userName: string;
  details: string;
  targetId?: string;
  departmentId?: string;
}

export const logActivity = async (input: ActivityLogInput) => {
  try {
    await addDoc(collection(db, 'activities'), {
      ...input,
      createdAt: Date.now()
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};
