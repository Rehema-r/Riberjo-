import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLog } from '../types';

export const activityService = {
  async log(activity: Omit<ActivityLog, 'id' | 'createdAt'>) {
    try {
      await addDoc(collection(db, 'activities'), {
        ...activity,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }
};
