import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';

export const notificationService = {
  /**
   * Sends a notification to a specific user via Firestore and optionally Email.
   */
  async notify(userId: string, title: string, message: string, type: 'critical' | 'info' = 'info') {
    try {
      // 1. Add to Firestore for in-app notification
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        read: false,
        type,
        createdAt: Date.now()
      });

      // 2. Trigger browser notification if possible
      await this.triggerBrowserNotification(title, message);

      // 3. Fetch user profile to check preferences and email
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const user = userSnap.data() as UserProfile;
        
        // Critical alerts always attempt email if user hasn't explicitly disabled them
        const sendEmail = type === 'critical' ? user.notificationPrefs?.criticalAlerts !== false : false;

        if (sendEmail && user.email) {
          console.log(`Triggering email notification for critical event: ${title}`);
          await this.sendEmail(user.email, `RIBERJO - ALERTE CRITIQUE : ${title}`, message);
        }
      }
    } catch (err) {
      console.error("Failed to notify user:", err);
    }
  },

  /**
   * Internal helper to trigger a browser notification
   */
  async triggerBrowserNotification(title: string, message: string) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message });
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {}
      } else if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  },

  /**
   * Internal helper to call the backend email API
   */
  async sendEmail(to: string, subject: string, body: string) {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body })
      });
      if (!response.ok) {
        throw new Error(`Email API responded with status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error("Email notification failed to send:", err);
    }
  },

  /**
   * Request permission for browser notifications
   */
  async requestPermission() {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  },

  /**
   * Notify about a new task
   */
  async notifyNewTask(userId: string, taskTitle: string) {
    // Check if user wants task notifications
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const user = userSnap.data() as UserProfile;
      if (user.notificationPrefs?.newTasks !== false) {
        await this.notify(userId, "Nouvelle Tâche Assignée", `On vous a assigné la tâche : ${taskTitle}`);
      }
    }
  },

  /**
   * Notify about report validation
   */
  async notifyReportValidation(userId: string, reportTitle: string, status: 'validated' | 'rejected') {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const user = userSnap.data() as UserProfile;
      if (user.notificationPrefs?.reportValidations !== false) {
        const statusText = status === 'validated' ? 'VALIDÉ' : 'REJETÉ';
        await this.notify(userId, `Rapport ${statusText}`, `Votre rapport "${reportTitle}" a été ${statusText.toLowerCase()}.`);
      }
    }
  },

  /**
   * Notify all users in a specific department
   */
  async notifyDepartment(departmentId: string, title: string, message: string, type: 'critical' | 'info' = 'info') {
    try {
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'users'), where('departmentId', '==', departmentId));
      const snap = await getDocs(q);
      const notifications = snap.docs.map(userDoc => {
        const user = userDoc.data() as UserProfile;
        if (user.notificationPrefs?.departmentUpdates !== false) {
          return this.notify(userDoc.id, title, message, type);
        }
        return Promise.resolve();
      });
      await Promise.all(notifications);
    } catch (err) {
      console.error(`Failed to notify department ${departmentId}:`, err);
    }
  },

  /**
   * Notify all users with a specific role
   */
  async notifyRole(role: string, title: string, message: string, type: 'critical' | 'info' = 'info') {
    try {
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'users'), where('role', '==', role));
      const snap = await getDocs(q);
      const notifications = snap.docs.map(userDoc => this.notify(userDoc.id, title, message, type));
      await Promise.all(notifications);
    } catch (err) {
      console.error(`Failed to notify role ${role}:`, err);
    }
  }
};
