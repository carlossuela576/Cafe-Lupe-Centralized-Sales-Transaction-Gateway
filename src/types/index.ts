/**
 * Cafe Lupe Centralized Sales Report and Transaction Gateway System
 * Data Models & Schemas (Revision 001)
 */

export type UserRole = 'staff' | 'admin' | 'accountant';
export type UserApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  outletId: string | null; // null for Front-Desk (admin) & Accountant
  outletName?: string;
  approvalStatus: UserApprovalStatus;
  createdAt: string;
}

export type TransactionStatus = 'pending' | 'paid' | 'void';
export type PaymentArrangement = 'Full Payment' | 'Down Payment';
export type PaymentChannel = 'Cash' | 'QRPh';

export type OutletSlug =
  | 'pickleball'
  | 'hostel'
  | 'gym'
  | 'pool'
  | 'ktv'
  | 'fnb'
  | 'billiards'
  | 'tabletennis'
  | 'parking'
  | 'events'
  | 'custom';

export interface Outlet {
  id: string;
  slug: OutletSlug;
  name: string;
  description: string;
  template?: string | null;
  isActive: boolean;
  category: 'sports' | 'hospitality' | 'entertainment' | 'dining' | 'general';
}

export interface ServicePreset {
  id: string;
  outletId: string;
  name: string;
  defaultPrice: number;
  category?: string;
  presetFields: Record<string, any>;
  isActive: boolean;
}

// Master Unified Transaction Record (R1, NFR7-NFR9, Rev 001)
export interface MasterTransaction {
  transactionID: string;
  outletName: string;
  outletSlug: OutletSlug;
  outletService: string;
  customerName: string;
  employeeHandler: string;
  employeeId: string;
  cashReceivedBy?: string | null;

  transactionAmount: number; // Selling price before discount
  discountApplied: boolean;
  discount: number;
  totalAmount: number; // Final amount payable
  amountPaid: number;
  balanceDue: number;

  transactionStatus: TransactionStatus;
  transactionDateTime: string;
  paymentArrangement: PaymentArrangement;
  paymentChannel: PaymentChannel;
  initialPaymentMode?: PaymentChannel | null;
  balancePaymentMode?: PaymentChannel | null;

  // Relational pointers
  outletRefTable: string;
  outletRefId: string;

  // QR Ph & Payment validation
  qrToken?: string | null;
  paidAt?: string | null;

  // Live Countdown Timer & Hourly Rate Extension (Rev 001 + Rev 002)
  hourlyRate?: number | null;
  timerDurationMinutes?: number | null;
  timerStartedAt?: string | null;
  timerEndsAt?: string | null;
  timerStoppedAt?: string | null;
  timerAcknowledged?: boolean;

  // Concurrency & Lockout (NFR4-NFR6)
  lockedBy?: string | null;
  lockedByName?: string | null;
  lockedAt?: string | null;
  version: number;
}

// 1. Pickleball
export interface PickleballTransaction {
  pickleballID: string;
  transactionId: string;
  court: 'Al Fresco (Ground Floor)' | 'Indoor (2nd Floor)';
  pax: number;
  hours: number;
  paddleRent: number;
  ballRent: number;
}

// 2. Hostel
export type HostelRoomType =
  | '2 Single Bed'
  | 'King Size Bed'
  | 'Queen Size Bed'
  | 'Suite Room - Overlooking';

export interface HostelTransaction {
  hostelID: string;
  transactionId: string;
  roomType: HostelRoomType;
  roomRatePerNight: number;
  bookingSource: 'Walk-in' | 'Agoda' | 'Traveloka';
  checkIn: string;
  checkOut: string;
  numberOfNights: number;
  amenities: string;
  vatIncluded: boolean;
}

// 3. Gym
export type GymServiceCategory =
  | 'Annual Membership'
  | 'Monthly Package'
  | 'Per-Session Training'
  | 'Self-Train Session';

export type GymClientStatus =
  | 'Member'
  | 'Non-Member'
  | 'Student (Member)'
  | 'Student (Non-Member)';

export interface GymTransaction {
  gymID: string;
  transactionId: string;
  age: number;
  membershipStart: string;
  serviceCategory: GymServiceCategory;
  membershipType: string;
  plan: string;
  clientStatus: GymClientStatus;
  trainerProgram: string;
  inclusions: string[];
}

// 4. Swimming Pool
export interface PoolTransaction {
  poolID: string;
  transactionId: string;
  guestType: 'Walk-in' | 'Hotel Guest';
  adults: number;
  children: number;
  isHostelGuest: boolean;
  visitDay: string;
}

// 5. KTV Video Rooms
export type KtvRoomChoice = 'Room 1' | 'Room 2' | 'Room 3' | 'Room 4';
export type KtvPackageType = 'Custom Hourly' | 'KTV 1 & 2 Package' | 'KTV Suite 4 Package';

export interface KtvTransaction {
  ktvID: string;
  transactionId: string;
  room: KtvRoomChoice;
  packageType: KtvPackageType;
  packageConsumable: number;
  pax: number;
  hours: number;
  hourlyRate: number;
  package: string;
}

// 6. Food & Beverage / POS
export interface PosMenuVariant {
  label: string;
  price: number;
}

export interface PosMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  section: 'Food' | 'Drinks';
  variants?: PosMenuVariant[];
}

export interface PosOrderItem {
  itemId: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface FnbTransaction {
  fnbID: string;
  transactionId: string;
  auditedTo: 'Walk-in Client' | 'Function Guest' | 'KTV Room User';
  orderItems: PosOrderItem[];
  receiptPrintedAt?: string | null;
  tableOrRoomNo?: string;
  totalPax?: number;
  validIdCount?: number;
}

// 7. Billiards
export type BilliardsPlace = 'Without Aircon (₱200/hr)' | 'With Aircon (₱400/hr)';

export interface BilliardsTransaction {
  billiardsID: string;
  transactionId: string;
  place: BilliardsPlace;
  hourlyRate: number;
  hours: number;
}

// 8. Table Tennis
export interface TableTennisTransaction {
  tabletennisID: string;
  transactionId: string;
  tableNo: 'Table 1' | 'Table 2' | 'Table 3';
  hourlyRate: number;
  hours: number;
}

// 9. Parking Lot
export type ParkingVehicleType =
  | 'Car'
  | 'Van'
  | 'Truck'
  | 'Tricycle'
  | 'Motorcycle'
  | 'Others';

export interface ParkingTransaction {
  parkingID: string;
  transactionId: string;
  plateNumber: string;
  vehicleType: ParkingVehicleType;
  customVehicleName?: string;
  wheelCount: 2 | 4;
  parkingType: 'Day' | 'Night' | 'Overnight';
  isCheckedInGuest: boolean;
}

// 10. Events & Location Rentals
export interface EventsTransaction {
  eventsID: string;
  transactionId: string;
  eventType:
    | 'Pre-Christmas Party'
    | 'Corporate Event'
    | 'Concert'
    | 'TV Show Location'
    | 'Indie Film Shoot'
    | 'Commercial Shoot'
    | 'Private Birthday/Celebration';
  eventDate: string;
  headcount: number;
  spaceReserved: string;
}

// Generic Template for Dynamic Outlets (FR88)
export interface GenericTransaction {
  genericID: string;
  transactionId: string;
  notes: string;
  customDetails: Record<string, any>;
}

// Workflows & Audit
export interface VoidRequest {
  id: string;
  transactionId: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  outletName: string;
  amount: number;
  reason: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface EditRequest {
  id: string;
  transactionId: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole?: UserRole;
  changes: {
    customerName?: string;
    transactionStatus?: TransactionStatus;
    transactionAmount?: number;
    discount?: number;
    totalAmount?: number;
    notes?: string;
  };
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface CashConfirmation {
  id: string;
  transactionId: string;
  installmentId?: string | null;
  outletName: string;
  customerName: string;
  amount: number;
  cashReceivedBy?: string | null;
  status: 'pending_audit' | 'confirmed';
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

// Normalized Split Payment Installments (Revision 002)
export interface PaymentInstallment {
  installmentID: string;
  transactionId: string;
  phase: 'initial' | 'balance';
  paymentChannel: PaymentChannel;
  amount: number;
  status: 'pending' | 'confirmed' | 'voided';
  cashReceivedBy?: string | null;
  qrToken?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

// AI Audit & Bank Reconciliation Persistence (Revision 002)
export interface AiAuditLog {
  auditID: string;
  auditType: 'deposit_validation' | 'financial_summary' | 'forecast_plan' | 'advisor_query';
  targetDate?: string | null;
  systemTotal: number;
  extractedTotal: number;
  discrepancyAmount: number;
  matchStatus: 'matched' | 'conflict' | 'info';
  extractedJson: Record<string, any>;
  summaryText: string;
  createdBy: string;
  createdAt: string;
}

export interface ReconciliationEntryComparison {
  referenceId: string;
  date: string;
  description: string;
  systemAmount: number | null;
  statementAmount: number | null;
  status: 'matched' | 'conflict';
  reason: string;
}

export interface ReconciliationBatch {
  reconID: string;
  outletId: string;
  outletName: string;
  startDate: string;
  endDate: string;
  statementFilename: string;
  extractedEntriesJson: Array<Record<string, any>>;
  comparisonResultsJson: ReconciliationEntryComparison[];
  overallStatus: 'matched' | 'conflict';
  summaryNote?: string;
  statementTotal?: number;
  systemTotal?: number;
  createdBy: string;
  createdAt: string;
}

