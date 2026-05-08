import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getExecutiveAdvice(stats: any) {
  try {
    const prompt = `En tant qu'intelligence artificielle de RIBERJO (entreprise de sécurité et logistique), analyse ces statistiques et donne un conseil "exécutif" bref (max 100 mots) et percutant en français.
    Statistiques actuelles :
    - Tâches complétées : ${stats.completedTasks}
    - Rapports en attente : ${stats.pendingReports}
    - Niveau de stock global : ${stats.stockLevel}%
    - Alertes critiques : ${stats.alerts}
    
    Format: Texte pur, ton professionnel et direct.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text;
  } catch (err) {
    console.error('Gemini error:', err);
    return "Maintenez la vigilance opérationnelle et assurez-vous que tous les rapports critiques sont validés avant la fin du service.";
  }
}
