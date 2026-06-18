export const DEPARTMENTS = [
  { id: '01', name: 'Ferme & Agriculture', code: 'FE', description: 'Production agricole, élevage et machinerie.' },
  { id: '02', name: 'Santé & Médical', code: 'SA', description: 'Services de soins, pharmacie et analyses.' },
  { id: '03', name: 'Ressources Humaines', code: 'RH', description: 'Gestion du personnel, paie et social.' },
  { id: '04', name: 'Finance & Comptabilité', code: 'FI', description: 'Trésorerie, audit et fiscalité.' },
  { id: '05', name: 'Logistique & Transport', code: 'LO', description: 'Approvisionnement et gestion de la flotte.' },
  { id: '06', name: 'Marketing & Ventes', code: 'MV', description: 'Communication et relations clients.' },
];

/**
 * Detailed Service IDs mapping
 * Used to categorize units within departments
 */
export const SERVICES_LIST = [
  // Ferme
  { id: '01', deptId: '01', name: 'Agronomie & Cultures' },
  { id: '02', deptId: '01', name: 'Élevage & Production Animale' },
  { id: '03', deptId: '01', name: 'Maintenance Machinerie' },
  // Santé
  { id: '01', deptId: '02', name: 'Médecine Générale' },
  { id: '02', deptId: '02', name: 'Pharmacie Centrale' },
  { id: '03', deptId: '02', name: 'Laboratoire Biologique' },
  // RH
  { id: '01', deptId: '03', name: 'Administration & Contrats' },
  { id: '02', deptId: '03', name: 'Paie & Avantages' },
  { id: '03', deptId: '03', name: 'Formation & Carrière' },
  // Finance
  { id: '01', deptId: '04', name: 'Comptabilité Générale' },
  { id: '02', deptId: '04', name: 'Caisse & Trésorerie' },
  { id: '03', deptId: '04', name: 'Contrôle Interne' },
  // Logistique
  { id: '01', deptId: '05', name: 'Entreposage & Stocks' },
  { id: '02', deptId: '05', name: 'Transport & Flotte' },
  { id: '03', deptId: '05', name: 'Achats & Marchés' },
  // Marketing
  { id: '01', deptId: '06', name: 'Ventes & Distribution' },
  { id: '02', deptId: '06', name: 'Communication & Design' },
  { id: '03', deptId: '06', name: 'Études de Marché' },
];

export const SERVICE_CODES: Record<string, string> = {
  'SUPER_ADMIN': 'SD', // Siège / Direction
  'ADMIN': 'AD',        // Administration
  'SUPER_USER': 'SU',   // Supervision
  'USER': 'US',        // Exécution / Travailleur
};

/**
 * Structure: AA/RBJ-SS-DD-PPP
 * AA: Year (26)
 * RBJ: Company Code
 * SS: Service Code (SD, AD, SU, US)
 * DD: Dept ID (01, 02, ...)
 * PPP: Personal Sequence (001)
 */
export function generateMatricule(
  year: number,
  role: string,
  deptId: string,
  sequence: number
): string {
  const yy = (year || new Date().getFullYear()).toString().slice(-2);
  const ss = SERVICE_CODES[role] || 'US';
  const dd = deptId === 'all' ? 'AL' : (deptId || '00');
  const ppp = (sequence || 0).toString().padStart(3, '0');
  
  return `${yy}/RBJ-${ss}-${dd}-${ppp}`;
}

/**
 * Format: CLT-RBJ-000001
 */
export function generateClientId(sequence: number): string {
  const pppppp = (sequence || 0).toString().padStart(6, '0');
  return `CLT-RBJ-${pppppp}`;
}

/**
 * Logic: RBJ@Nom+Year (accents stripped)
 * Example: RBJ@Musa2026, RBJ@Rene2026
 */
export function generatePassword(name: string, year: string = '2026'): string {
  if (!name) return `RBJ@Agent${year}`;
  
  let firstName = name.trim().split(' ')[0];
  // Strip French active accents safely
  firstName = firstName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '');
    
  if (firstName.length > 0) {
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  } else {
    firstName = "Agent";
  }
  
  return `RBJ@${firstName}${year}`;
}

/**
 * Fixed Format for Clients: RBJ@Client2026
 */
export function generateClientPassword(): string {
  return "RBJ@Client2026";
}
