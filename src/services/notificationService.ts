import { collection, addDoc, doc } from 'firebase/firestore';
import { db, getDocSafe } from '../lib/firebase';
import { UserProfile } from '../types';

export const notificationService = {
  /**
   * Sends a notification to a specific user via Firestore and optionally Email.
   */
  async notify(userId: string, title: string, message: string, type: 'critical' | 'info' | 'task' | 'report' = 'info') {
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
      const userSnap = await getDocSafe(userRef);
      
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
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, { body: message });
          } catch (err) {
            console.warn("Failed to construct Notification object:", err);
          }
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
          } catch (e) {}
        } else if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (error) {
            console.warn("Could not request notification permission in this environment:", error);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to trigger browser notification:", err);
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
    try {
      if ('Notification' in window) {
        return await Notification.requestPermission();
      }
    } catch (e) {
      console.warn("Notification.requestPermission failed:", e);
    }
    return 'denied';
  },

  /**
   * Notify about a new task
   */
  async notifyNewTask(userId: string, taskTitle: string) {
    // Check if user wants task notifications
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDocSafe(userRef);
    if (userSnap.exists()) {
      const user = userSnap.data() as UserProfile;
      if (user.notificationPrefs?.newTasks !== false) {
        await this.notify(userId, "Nouvelle Tâche Assignée", `On vous a assigné la tâche : ${taskTitle}`, 'task');
      }
    }
  },

  /**
   * Notify about report validation
   */
  async notifyReportValidation(userId: string, reportTitle: string, status: 'validated' | 'rejected' | 'pending_admin' | 'pending_dg' | 'pending_expert' | 'pending') {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDocSafe(userRef);
    if (userSnap.exists()) {
      const user = userSnap.data() as UserProfile;
      if (user.notificationPrefs?.reportValidations !== false) {
        let statusText = 'mis à jour';
        if (status === 'validated') statusText = 'VALIDÉ PAR LE DG';
        else if (status === 'rejected') statusText = 'REJETÉ';
        else if (status === 'pending_admin') statusText = 'APPROUVÉ PAR L\'EXPERT (Transmis à l\'Admin)';
        else if (status === 'pending_dg') statusText = 'APPROUVÉ PAR L\'ADMIN (Transmis au DG)';
        else if (status === 'pending_expert') statusText = 'SOUMIS (En attente Expert)';

        await this.notify(userId, `Rapport : ${statusText}`, `Votre rapport "${reportTitle}" a progressé : ${statusText.toLowerCase()}.`, 'report');
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
  },

  /**
   * Notify the Director General (DG) and Board Members
   */
  async notifyDG(title: string, message: string, type: 'critical' | 'info' = 'info') {
    try {
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'users'), where('role', 'in', ['SUPER_ADMIN', 'BOARD_MEMBER']));
      const snap = await getDocs(q);
      const notifications = snap.docs.map(userDoc => this.notify(userDoc.id, title, message, type));
      await Promise.all(notifications);
    } catch (err) {
      console.error('Failed to notify DG:', err);
    }
  },

  /**
   * Workflow Notification Step 1: New stock item proposal submitted by Logistics/User
   */
  async notifyStockProposal(itemTitle: string, proposerName: string) {
    const title = `📦 Nouvelle Proposition d'Article : ${itemTitle}`;
    const msg = `L'agent ${proposerName} (Logistique) a soumis l'article "${itemTitle}" pour ajout en stock/boutique. Transmis au Marketing pour étude de prix.`;
    // Notify Marketing Dept (04), DG, and Admins
    await this.notifyDepartment('04', title, msg, 'info');
    await this.notifyDG(title, msg, 'info');
    await this.notifyRole('ADMIN', title, msg, 'info');
  },

  /**
   * Workflow Notification Step 2: Marketing completes study and sets price
   */
  async notifyMarketingStudy(itemTitle: string, price: number, marketingName: string) {
    const title = `🏷️ Étude Marketing Terminée : ${itemTitle}`;
    const msg = `L'équipe Marketing (${marketingName}) a validé la fiche et fixé le prix de vente à $${price} pour "${itemTitle}". En attente de validation finale par le Chef/DG.`;
    await this.notifyDG(title, msg, 'info');
    await this.notifyDepartment('05', title, msg, 'info'); // Logistique
    await this.notifyRole('ADMIN', title, msg, 'info');
  },

  /**
   * Workflow Notification Step 3: Final decision (Approved or Rejected) by DG / Chef
   */
  async notifyStockApproval(itemTitle: string, approved: boolean, decisionBy: string, price?: number, reason?: string) {
    const title = approved ? `✅ ARTICLE PUBLIÉ EN BOUTIQUE : ${itemTitle}` : `❌ PROPOSITION REJETÉE : ${itemTitle}`;
    const msg = approved 
      ? `L'article "${itemTitle}" au prix de $${price} a été Officiellement Validé et Publié en Boutique par ${decisionBy}.`
      : `La proposition d'article "${itemTitle}" a été Rejetée par ${decisionBy}. Motif : ${reason || 'Non spécifié'}.`;

    await this.notifyDG(title, msg, approved ? 'info' : 'critical');
    await this.notifyDepartment('04', title, msg, 'info'); // Marketing
    await this.notifyDepartment('05', title, msg, 'info'); // Logistique
    await this.notifyRole('ADMIN', title, msg, 'info');
  }
};
