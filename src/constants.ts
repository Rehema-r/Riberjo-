export const DEPARTMENTS = [
  { id: '01', name: 'Ferme', code: 'FE', description: 'Planification agricole, gestion élevage et rendement.' },
  { id: '02', name: 'Santé', code: 'SA', description: 'Gestion médicale, soins et rapports sanitaires.' },
  { id: '03', name: 'RH', code: 'RH', description: 'Recrutement, gestion présence et contrats.' },
  { id: '04', name: 'Finance', code: 'FI', description: 'Contrôle budgétaire, validation dépenses et recettes.' },
  { id: '05', name: 'Logistique', code: 'LO', description: 'Gestion stock, matériel et inventaire.' },
  { id: '06', name: 'Marketing & Vente', code: 'MV', description: 'Stratégie commerciale, analyse ventes et clients.' },
];

export const SERVICE_CODES: Record<string, string> = {
  'SUPER_ADMIN': 'SD',
  'ADMIN': 'AD',
  'SUPER_USER': 'SU',
  'USER': 'US',
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
  const dd = deptId || '00';
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
 * Logic: RBJ@Nom+Year
 * Example: RBJ@Musa2026
 */
export function generatePassword(name: string, year: string = '2026'): string {
  const firstName = name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
  return `RBJ@${firstName}${year}`;
}

/**
 * Fixed Format for Clients: RBJ@Client2026
 */
export function generateClientPassword(): string {
  return "RBJ@Client2026";
}
