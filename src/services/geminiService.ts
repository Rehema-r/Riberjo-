import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getExecutiveAdvice(stats: any) {
  // Stabilize stats for cache key to prevent excessive calls on minor variations
  const stabilizedStats = {
    completedTasks: Math.round((stats.completedTasks || 0) / 10) * 10,
    pendingReports: Math.round((stats.pendingReports || 0) / 5) * 5,
    stockLevel: Math.round((stats.stockLevel || 0) / 10) * 10,
    alerts: Math.round((stats.alerts || 0) / 2) * 2
  };
  
  const cacheKey = `gemini_advice_stable_${JSON.stringify(stabilizedStats)}`;
  const cached = localStorage.getItem(cacheKey);
  
  // Check for recent quota error to avoid spamming
  const lastError = localStorage.getItem('gemini_last_error');
  if (lastError) {
    const { timestamp, code } = JSON.parse(lastError);
    // If it was a 429, wait at least 5 minutes before trying again
    if (code === 429 && Date.now() - timestamp < 300000) {
      return "Analyse en attente : Optimisation de la performance système. Maintenez les protocoles actuels.";
    }
  }

  if (cached) {
    const { advice, timestamp } = JSON.parse(cached);
    // Cache for 4 hours for stable stats
    if (Date.now() - timestamp < 14400000) {
      return advice;
    }
  }

  try {
    const prompt = `En tant qu'intelligence artificielle de RIBERJO (entreprise de sécurité et logistique), analyse ces statistiques et donne un conseil "exécutif" bref (max 100 mots) et percutant en français.
    Statistiques actuelles :
    - Tâches complétées : ${stats.completedTasks}
    - Rapports en attente : ${stats.pendingReports}
    - Niveau de stock global : ${stats.stockLevel}%
    - Alertes critiques : ${stats.alerts}
    
    Format: Texte pur, ton professionnel et direct.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const advice = response.text;
    
    if (!advice) throw new Error("No text returned from Gemini");

    // Save to cache
    localStorage.setItem(cacheKey, JSON.stringify({ advice, timestamp: Date.now() }));
    localStorage.removeItem('gemini_last_error');
    
    return advice;
  } catch (err: any) {
    console.error('Gemini error:', err);
    
    // Track 429 errors
    if (err.message?.includes('429') || err.status === 429) {
      localStorage.setItem('gemini_last_error', JSON.stringify({ 
        timestamp: Date.now(), 
        code: 429 
      }));
    }

    // Fallback message if quota exceeded or other error
    return "Maintenez la vigilance opérationnelle et assurez-vous que tous les rapports critiques sont validés avant la fin du service.";
  }
}
