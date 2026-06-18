export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPER_USER' | 'USER' | 'CLIENT';

export type ClientType = 'STANDARD' | 'PARTNER' | 'PREMIUM' | 'ORGANIZATION' | 'COOPERATIVE' | 'PARENT' | 'PATIENT';

export interface ClientProfile {
  id: string; // CLT-RBJ-000001
  fullName: string;
  phone: string;
  email: string;
  address: string;
  gender: 'M' | 'F';
  profession: string;
  nationality: string;
  photoUrl?: string;
  type: ClientType;
  qrCode: string;
  registrationDate: number;
  status: 'active' | 'pending' | 'suspended';
  passwordChanged: boolean;
  authUid?: string;
  referenceNumber: string;
  serviceAuthorizations: string[]; // ['agriculture', 'sante', 'education', 'commerce', 'logistique']
}

export interface ClientAppointment {
  id: string;
  clientId: string;
  clientName: string;
  serviceType: 'medical' | 'agronomical' | 'veterinary' | 'training' | 'logistics';
  specialistId?: string;
  specialistName?: string;
  date: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: number;
}

export interface ClientOrder {
  id: string;
  clientId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer' | 'manual';
  deliveryAddress?: string;
  trackingNumber?: string;
  createdAt: number;
}

export interface ClientServiceRequest {
  id: string;
  clientId: string;
  type: string; // 'soil_analysis', 'animal_emergency', etc.
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  response?: string;
  attachmentUrls?: string[];
  createdAt: number;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string;
  matricule: string;
  phone?: string;
  address?: string;
  gender?: 'M' | 'F';
  birthDate?: string;
  civilStatus?: string;
  recruitmentYear?: string;
  serviceId?: string;
  function?: string;
  status: 'active' | 'suspended';
  passwordChanged: boolean;
  createdAt: number;
  authUid?: string;
  notificationPrefs?: NotificationPrefs;
  contractUrl?: string;
  serviceCardUrl?: string;
  qrCode?: string;
  baseSalary?: number;
  avatarUrl?: string;
  password?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  checkIn?: number;
  checkOut?: number;
  clockIn?: string; 
  clockOut?: string;
  location?: {
    lat: number;
    lng: number;
  };
  isLate?: boolean;
  status: 'present' | 'absent' | 'leave' | 'late';
  notes?: string;
  departmentId?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  leaveType?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Payroll {
  id: string;
  userId: string;
  userName: string;
  month: number;
  year: number;
  period?: string; // Added to match component
  baseSalary: number;
  primes: number;
  bonuses?: number; // Added to match component
  deductions: number;
  netSalary: number;
  status: 'pending' | 'paid';
  pdfUrl?: string;
  paymentDate?: number; // Added to match component
  createdAt: number;
}

export interface AppDocument {
  id: string;
  title: string;
  type: 'contract' | 'report' | 'internal' | 'other';
  fileUrl: string;
  userId?: string;
  departmentId?: string;
  category: string;
  status: 'archived' | 'active';
  signed?: boolean;
  signatureUrl?: string;
  signedAt?: number;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number;
  startDate?: string; // Changed to string to match component usage (startsWith)
  type: 'meeting' | 'activity' | 'harvest' | 'holiday' | 'farm'; // Added 'farm'
  category?: 'meeting' | 'activity' | 'harvest' | 'holiday' | 'farm'; // Added 'farm'
  departmentId?: string;
  creatorId: string;
  participants: string[];
  meetingLink?: string;
  location?: string;
}

export interface NotificationPrefs {
  newTasks: boolean;
  reportValidations: boolean;
  criticalAlerts: boolean;
  mentions: boolean;
  departmentUpdates: boolean;
}

export interface AppSettings {
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
  defaultRegistrationRole: UserRole;
  allowSelfRegistration: boolean;
  updatedAt: number;
}

export interface RolePermission {
  role: string | UserRole;
  label: string;
  description: string;
  permissions: {
    manageUsers: boolean;
    manageDept: boolean;
    validateReports: boolean;
    manageAssets: boolean;
    manageProtocols: boolean;
    manageSettings: boolean;
    viewReports: boolean;
    createTasks: boolean;
    accessArchive: boolean;
  };
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  status: 'in_stock' | 'out_of_stock' | 'maintenance' | 'retired' | 'low'; // Added 'low'
  departmentId: string;
  location?: string;
  serialNumber?: string;
  purchasedAt?: number;
  lastMaintained?: number;
  unit?: string; // Added to match component
  quantity?: number; // Added to match component
  imageUrl?: string; // Added to match component
  description?: string; // Added to match component
  lastRefill?: number; // Added to match component
}

export interface Protocol {
  id: string;
  title: string;
  category: string;
  content: string;
  departmentId: string;
  authorId: string;
  createdAt: number;
  updatedAt: number;
  version: string;
}

export interface Chat {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'department';
  departmentId?: string;
  participants: string[];
  lastMessageId?: string;
  updatedAt: number;
}

export interface Message extends ChatMessage {}

export interface Comment {
  id: string;
  targetId: string; // ID of the report, task, etc.
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  directorId?: string;
  internalStructure?: string; // Added to match component
}

export interface FarmActivity {
  id: string;
  type: 'culture' | 'élevage' | 'vétérinaire';
  subType: string;
  title: string;
  description: string;
  quantity?: number;
  unit?: string;
  status: string;
  authorId: string;
  authorName?: string;
  createdAt: number;
}

export interface MedicalRecord {
  id: string;
  patientName: string;
  consultationType: string;
  diagnosis: string;
  treatment: string;
  medications: string[];
  practitionerId: string;
  practitionerName?: string;
  createdAt: number;
}

export interface FinanceTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  status: 'pending' | 'validated' | 'rejected';
  authorId: string;
  authorName?: string;
  validatedBy?: string;
  createdAt: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  location?: string;
  departmentId?: string;
  lastUpdatedBy: string;
  updatedAt: number;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out';
  quantity: number;
  description: string;
  departmentId: string;
  userId: string;
  userName: string;
  createdAt: number;
}

export interface SaleRecord {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
  clientName: string;
  sellerId: string;
  sellerName?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  chatId: string;
  departmentId?: string;
  type: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: number;
}

export interface Report {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'pending' | 'validated' | 'rejected';
  authorId: string;
  departmentId: string;
  validatorId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'pending_validation';
  priority?: 'low' | 'medium' | 'high';
  assigneeId: string;
  creatorId: string;
  departmentId: string;
  deadline?: number;
  category?: string;
  progress: number;
  subTasks: SubTask[];
  dependencies: string[];
  createdAt: number;
  completionReportText?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'critical' | 'info' | 'task' | 'report';
  createdAt: number;
  isCriticalAlert?: boolean;
  alertSeverity?: 'critical' | 'warning' | 'info';
  triggerSound?: boolean;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  userId: string;
  userName: string;
  details: string;
  targetId?: string;
  departmentId?: string;
  createdAt: number;
}
