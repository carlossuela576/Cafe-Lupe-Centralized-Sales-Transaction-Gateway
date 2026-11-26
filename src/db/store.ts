/**
 * Cafe Lupe Relational Store & Data Engine (Revision 001)
 * Manages Master Transactions, 10 Outlet Child Tables, Live Session Timers,
 * Down-Payment Balances, Extensions, Concurrency Locks, QrPh Validation, and PHP/MySQL Code Generation.
 */

import {
  User,
  Outlet,
  ServicePreset,
  MasterTransaction,
  PickleballTransaction,
  HostelTransaction,
  GymTransaction,
  PoolTransaction,
  KtvTransaction,
  FnbTransaction,
  BilliardsTransaction,
  TableTennisTransaction,
  ParkingTransaction,
  EventsTransaction,
  GenericTransaction,
  CashConfirmation,
  VoidRequest,
  EditRequest,
  PaymentInstallment,
  AiAuditLog,
  ReconciliationBatch,
  CalendarEventRecord,
  CalendarEventCategory,
  TransactionStatus,
  PaymentArrangement,
  PaymentChannel,
  OutletSlug,
  UserRole,
} from '../types';

import {
  INITIAL_USERS,
  INITIAL_OUTLETS,
  INITIAL_SERVICES,
  INITIAL_TRANSACTIONS,
  INITIAL_PICKLEBALL_ROWS,
  INITIAL_HOSTEL_ROWS,
  INITIAL_GYM_ROWS,
  INITIAL_POOL_ROWS,
  INITIAL_KTV_ROWS,
  INITIAL_FNB_ROWS,
  INITIAL_BILLIARDS_ROWS,
  INITIAL_TABLETENNIS_ROWS,
  INITIAL_PARKING_ROWS,
  INITIAL_EVENTS_ROWS,
  INITIAL_CASH_CONFIRMATIONS,
  INITIAL_VOID_REQUESTS,
  INITIAL_INSTALLMENTS,
  INITIAL_CALENDAR_EVENTS,
} from './initialData';

const STORAGE_PREFIX = 'cafelupe_v3_rev002_';

export const TIMED_OUTLET_SLUGS: OutletSlug[] = ['billiards', 'pickleball', 'tabletennis', 'ktv'];

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiscountBreakdown(
  sellingPrice: number,
  discountApplied: boolean
): { discount: number; totalAmount: number } {
  const cleanSelling = Math.max(0, round2(sellingPrice));
  if (!discountApplied) {
    return { discount: 0, totalAmount: cleanSelling };
  }
  // Standard SC/PWD Discount Formula: Final Price = (Selling Price ÷ 1.12) × 0.80
  const finalPrice = round2((cleanSelling / 1.12) * 0.8);
  const discount = round2(Math.max(0, cleanSelling - finalPrice));
  return { discount, totalAmount: finalPrice };
}

export function calculateFnbScPwdDiscount(
  totalBill: number,
  discountApplied: boolean,
  totalPax: number,
  validIdCount: number
): { discount: number; totalAmount: number; clampedPax: number; clampedIds: number } {
  const cleanBill = Math.max(0, round2(totalBill));
  const clampedPax = Math.max(1, Math.floor(Number(totalPax) || 1));
  const clampedIds = Math.min(clampedPax, Math.max(0, Math.floor(Number(validIdCount) || 0)));
  if (!discountApplied || clampedIds === 0 || cleanBill === 0) {
    return { discount: 0, totalAmount: cleanBill, clampedPax, clampedIds };
  }
  // Revision 002 F&B Formula: Discount = ((Total Food bill / 1.12) / Total pax × Number of SC & PWD IDs) × 0.20
  const discount = round2(((cleanBill / 1.12) / clampedPax) * clampedIds * 0.2);
  const totalAmount = round2(Math.max(0, cleanBill - discount));
  return { discount, totalAmount, clampedPax, clampedIds };
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export class CafeLupeStore {
  private users: User[] = loadFromStorage('users', INITIAL_USERS);
  private outlets: Outlet[] = loadFromStorage('outlets', INITIAL_OUTLETS);
  private services: ServicePreset[] = loadFromStorage('services', INITIAL_SERVICES);
  private transactions: MasterTransaction[] = loadFromStorage('transactions', INITIAL_TRANSACTIONS);
  private installments: PaymentInstallment[] = loadFromStorage('installments', INITIAL_INSTALLMENTS);

  // 10 Child Tables
  private pickleballRows: PickleballTransaction[] = loadFromStorage('pickleball', INITIAL_PICKLEBALL_ROWS);
  private hostelRows: HostelTransaction[] = loadFromStorage('hostel', INITIAL_HOSTEL_ROWS);
  private gymRows: GymTransaction[] = loadFromStorage('gym', INITIAL_GYM_ROWS);
  private poolRows: PoolTransaction[] = loadFromStorage('pool', INITIAL_POOL_ROWS);
  private ktvRows: KtvTransaction[] = loadFromStorage('ktv', INITIAL_KTV_ROWS);
  private fnbRows: FnbTransaction[] = loadFromStorage('fnb', INITIAL_FNB_ROWS);
  private billiardsRows: BilliardsTransaction[] = loadFromStorage('billiards', INITIAL_BILLIARDS_ROWS);
  private tableTennisRows: TableTennisTransaction[] = loadFromStorage('tabletennis', INITIAL_TABLETENNIS_ROWS);
  private parkingRows: ParkingTransaction[] = loadFromStorage('parking', INITIAL_PARKING_ROWS);
  private eventsRows: EventsTransaction[] = loadFromStorage('events', INITIAL_EVENTS_ROWS);
  private genericRows: GenericTransaction[] = loadFromStorage('generic', []);

  // Governance Workflows & AI Audit Logs
  private cashConfirmations: CashConfirmation[] = loadFromStorage('cash_confirmations', INITIAL_CASH_CONFIRMATIONS);
  private voidRequests: VoidRequest[] = loadFromStorage('void_requests', INITIAL_VOID_REQUESTS);
  private editRequests: EditRequest[] = loadFromStorage('edit_requests', []);
  private aiAuditLogs: AiAuditLog[] = loadFromStorage('ai_audit_logs', []);
  private reconciliationBatches: ReconciliationBatch[] = loadFromStorage('reconciliation_batches', []);
  private calendarEvents: CalendarEventRecord[] = loadFromStorage('calendar_events', INITIAL_CALENDAR_EVENTS);

  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
        this.reloadAllFromStorage();
        this.listeners.forEach((l) => l());
      });
    }
  }

  private reloadAllFromStorage(): void {
    this.users = loadFromStorage('users', INITIAL_USERS);
    this.outlets = loadFromStorage('outlets', INITIAL_OUTLETS);
    this.services = loadFromStorage('services', INITIAL_SERVICES);
    this.transactions = loadFromStorage('transactions', INITIAL_TRANSACTIONS);
    this.installments = loadFromStorage('installments', INITIAL_INSTALLMENTS);
    this.pickleballRows = loadFromStorage('pickleball', INITIAL_PICKLEBALL_ROWS);
    this.hostelRows = loadFromStorage('hostel', INITIAL_HOSTEL_ROWS);
    this.gymRows = loadFromStorage('gym', INITIAL_GYM_ROWS);
    this.poolRows = loadFromStorage('pool', INITIAL_POOL_ROWS);
    this.ktvRows = loadFromStorage('ktv', INITIAL_KTV_ROWS);
    this.fnbRows = loadFromStorage('fnb', INITIAL_FNB_ROWS);
    this.billiardsRows = loadFromStorage('billiards', INITIAL_BILLIARDS_ROWS);
    this.tableTennisRows = loadFromStorage('tabletennis', INITIAL_TABLETENNIS_ROWS);
    this.parkingRows = loadFromStorage('parking', INITIAL_PARKING_ROWS);
    this.eventsRows = loadFromStorage('events', INITIAL_EVENTS_ROWS);
    this.genericRows = loadFromStorage('generic', []);
    this.cashConfirmations = loadFromStorage('cash_confirmations', INITIAL_CASH_CONFIRMATIONS);
    this.voidRequests = loadFromStorage('void_requests', INITIAL_VOID_REQUESTS);
    this.editRequests = loadFromStorage('edit_requests', []);
    this.aiAuditLogs = loadFromStorage('ai_audit_logs', []);
    this.reconciliationBatches = loadFromStorage('reconciliation_batches', []);
    this.calendarEvents = loadFromStorage('calendar_events', INITIAL_CALENDAR_EVENTS);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    saveToStorage('users', this.users);
    saveToStorage('outlets', this.outlets);
    saveToStorage('services', this.services);
    saveToStorage('transactions', this.transactions);
    saveToStorage('installments', this.installments);
    saveToStorage('pickleball', this.pickleballRows);
    saveToStorage('hostel', this.hostelRows);
    saveToStorage('gym', this.gymRows);
    saveToStorage('pool', this.poolRows);
    saveToStorage('ktv', this.ktvRows);
    saveToStorage('fnb', this.fnbRows);
    saveToStorage('billiards', this.billiardsRows);
    saveToStorage('tabletennis', this.tableTennisRows);
    saveToStorage('parking', this.parkingRows);
    saveToStorage('events', this.eventsRows);
    saveToStorage('generic', this.genericRows);
    saveToStorage('cash_confirmations', this.cashConfirmations);
    saveToStorage('void_requests', this.voidRequests);
    saveToStorage('edit_requests', this.editRequests);
    saveToStorage('ai_audit_logs', this.aiAuditLogs);
    saveToStorage('reconciliation_batches', this.reconciliationBatches);
    saveToStorage('calendar_events', this.calendarEvents);

    this.listeners.forEach((l) => l());
  }

  // --- Users & Auth ---
  private syncUsersFromStorage(): void {
    const latestUsers = loadFromStorage<User[]>('users', this.users);
    if (latestUsers && Array.isArray(latestUsers)) {
      this.users = latestUsers;
    }
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public findUserByEmail(email: string): User | null {
    this.syncUsersFromStorage();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    return this.users.find((u) => u.email.trim().toLowerCase() === normalized) || null;
  }

  public authenticate(email: string, pass: string): { user: User | null; error?: string } {
    this.syncUsersFromStorage();
    const user = this.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return { user: null, error: 'User with this email not found.' };
    }
    if (user.password && user.password !== pass) {
      return { user: null, error: 'Invalid password. Please check your credentials.' };
    }
    return { user };
  }

  public registerUser(
    name: string,
    email: string,
    pass: string,
    roleChoice: 'gym' | 'fnb' | 'accountant' | 'admin'
  ): User {
    this.syncUsersFromStorage();

    let role: User['role'] = 'staff';
    let outletId: string | null = null;
    let outletName = 'Front-Desk (All Outlets)';

    if (roleChoice === 'admin') {
      role = 'admin';
      outletId = null;
      outletName = 'Front-Desk (All Outlets)';
    } else if (roleChoice === 'accountant') {
      role = 'accountant';
      outletId = null;
      outletName = 'Accounting';
    } else if (roleChoice === 'gym') {
      role = 'staff';
      outletId = 'out-gym';
      outletName = 'Gym & Combat Training';
    } else {
      role = 'staff';
      outletId = 'out-fnb';
      outletName = 'Restaurant / Food & Beverage';
    }

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      email: email.trim(),
      password: pass,
      role,
      outletId,
      outletName,
      approvalStatus: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.users.unshift(newUser);
    this.notify();
    return newUser;
  }

  public updateUserApproval(userId: string, status: 'approved' | 'rejected'): void {
    this.syncUsersFromStorage();
    this.users = this.users.map((u) => (u.id === userId ? { ...u, approvalStatus: status } : u));
    this.notify();
  }

  // --- Outlets & Services ---
  public getOutlets(): Outlet[] {
    return [...this.outlets];
  }

  public getFrontDeskOutlets(): Outlet[] {
    return this.outlets.filter((o) => o.slug !== 'gym' && o.slug !== 'fnb');
  }

  public getOutletBySlug(slug: string): Outlet | undefined {
    return this.outlets.find((o) => o.slug === slug);
  }

  public getServices(outletId?: string): ServicePreset[] {
    if (!outletId) return [...this.services];
    return this.services.filter((s) => s.outletId === outletId && s.isActive);
  }

  public addOutlet(name: string, description: string, category: Outlet['category'], template?: string): Outlet {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') as OutletSlug;
    const newOutlet: Outlet = {
      id: `out-${Date.now()}`,
      slug,
      name,
      description,
      template: template || null,
      isActive: true,
      category,
    };
    this.outlets.push(newOutlet);
    this.notify();
    return newOutlet;
  }

  public addService(outletId: string, name: string, price: number, presetFields: Record<string, any> = {}): ServicePreset {
    const newService: ServicePreset = {
      id: `srv-${Date.now()}`,
      outletId,
      name,
      defaultPrice: price,
      presetFields,
      isActive: true,
    };
    this.services.push(newService);
    this.notify();
    return newService;
  }

  // --- Transactions (Master & Relational) ---
  public getTransactions(outletSlug?: OutletSlug): MasterTransaction[] {
    const sorted = [...this.transactions].sort(
      (a, b) => new Date(b.transactionDateTime).getTime() - new Date(a.transactionDateTime).getTime()
    );
    if (!outletSlug) return sorted;
    return sorted.filter((t) => t.outletSlug === outletSlug);
  }

  public getTransactionById(id: string): MasterTransaction | undefined {
    return this.transactions.find((t) => t.transactionID === id);
  }

  public getOutletChildData(table: string, childId: string): any {
    switch (table) {
      case 'pickleball_transactions':
        return this.pickleballRows.find((r) => r.pickleballID === childId);
      case 'hostel_transactions':
        return this.hostelRows.find((r) => r.hostelID === childId);
      case 'gym_transactions':
        return this.gymRows.find((r) => r.gymID === childId);
      case 'pool_transactions':
        return this.poolRows.find((r) => r.poolID === childId);
      case 'ktv_transactions':
        return this.ktvRows.find((r) => r.ktvID === childId);
      case 'fnb_transactions':
        return this.fnbRows.find((r) => r.fnbID === childId);
      case 'billiards_transactions':
        return this.billiardsRows.find((r) => r.billiardsID === childId);
      case 'tabletennis_transactions':
        return this.tableTennisRows.find((r) => r.tabletennisID === childId);
      case 'parking_transactions':
        return this.parkingRows.find((r) => r.parkingID === childId);
      case 'events_transactions':
        return this.eventsRows.find((r) => r.eventsID === childId);
      case 'generic_transactions':
        return this.genericRows.find((r) => r.genericID === childId);
      default:
        return null;
    }
  }

  // --- Concurrency & Edit Lockout (NFR4 - NFR6) ---
  public acquireLock(transactionId: string, userId: string, userName: string): { acquired: boolean; currentLockOwner?: string } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { acquired: false };

    const now = Date.now();
    if (tx.lockedBy && tx.lockedBy !== userId && tx.lockedAt) {
      const lockTime = new Date(tx.lockedAt).getTime();
      if ((now - lockTime) / 1000 < 120) {
        return { acquired: false, currentLockOwner: tx.lockedByName || 'Another clerk' };
      }
    }

    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId
        ? { ...t, lockedBy: userId, lockedByName: userName, lockedAt: new Date().toISOString() }
        : t
    );
    this.notify();
    return { acquired: true };
  }

  public releaseLock(transactionId: string, userId: string): void {
    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId && t.lockedBy === userId
        ? { ...t, lockedBy: null, lockedByName: null, lockedAt: null }
        : t
    );
    this.notify();
  }

  public getInstallments(transactionId?: string): PaymentInstallment[] {
    if (!transactionId) return [...this.installments];
    return this.installments.filter((i) => i.transactionId === transactionId);
  }

  public getPendingInstallment(transactionId: string): PaymentInstallment | undefined {
    return this.installments.find(
      (i) => i.transactionId === transactionId && i.status === 'pending'
    );
  }

  /**
   * Create Master Transaction + dedicated child table record + initial installment (Revision 002)
   */
  public createTransaction(params: {
    outletSlug: OutletSlug;
    outletName: string;
    outletService: string;
    customerName: string;
    employeeHandler: string;
    employeeId: string;
    cashReceivedBy?: string | null;
    transactionAmount: number;
    discountApplied?: boolean;
    paymentArrangement: PaymentArrangement;
    paymentChannel: PaymentChannel;
    downPaymentAmount?: number;
    hourlyRate?: number | null;
    timerDurationMinutes?: number | null;
    childTableData: Record<string, any>;
  }): MasterTransaction {
    const count = this.transactions.length + 1;
    const year = new Date().getFullYear();
    const transactionID = `TRX-${year}-${String(count).padStart(4, '0')}`;
    const discountApplied = Boolean(params.discountApplied);

    const { discount, totalAmount } =
      params.outletSlug === 'fnb'
        ? calculateFnbScPwdDiscount(
            params.transactionAmount,
            discountApplied,
            Number(params.childTableData?.totalPax || 1),
            Number(params.childTableData?.validIdCount || 0)
          )
        : calculateDiscountBreakdown(params.transactionAmount, discountApplied);

    const nowIso = new Date().toISOString();
    const isDownPaymentFlow = params.paymentArrangement === 'Down Payment' && totalAmount > 0;
    const plannedDownAmount = isDownPaymentFlow
      ? round2(Math.min(totalAmount, Math.max(0, Number(params.downPaymentAmount) || 0)))
      : totalAmount;

    // Revision 002 Down Payment Fix:
    // Both Cash and QRPh Down Payments start with amountPaid = 0 and require explicit initial payment confirmation first.
    // Full Payment Cash clears immediately (unless totalAmount === 0 which also clears immediately).
    const isPaidNow =
      totalAmount === 0 ||
      (!isDownPaymentFlow && params.paymentChannel === 'Cash');

    const amountPaid = isPaidNow ? totalAmount : 0;
    const balanceDue = round2(Math.max(0, totalAmount - amountPaid));
    const initialStatus: TransactionStatus = isPaidNow ? 'paid' : 'pending';
    const paidAt = isPaidNow ? nowIso : null;
    const qrToken =
      params.paymentChannel === 'QRPh' && !isPaidNow
        ? `QRPH-${year}-${params.outletSlug.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        : null;

    // Timer setup for timed outlets
    const isTimed = TIMED_OUTLET_SLUGS.includes(params.outletSlug);
    const timerMins = isTimed ? Math.max(1, Number(params.timerDurationMinutes) || 60) : null;
    const nowMs = Date.now();
    const timerStartedAt = timerMins ? new Date(nowMs).toISOString() : null;
    const timerEndsAt = timerMins ? new Date(nowMs + timerMins * 60_000).toISOString() : null;

    // Child Table Insert
    const childId = `cld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let childTable = `${params.outletSlug}_transactions`;

    switch (params.outletSlug) {
      case 'pickleball':
        childTable = 'pickleball_transactions';
        this.pickleballRows.unshift({
          pickleballID: childId,
          transactionId: transactionID,
          court: params.childTableData.court || 'Al Fresco (Ground Floor)',
          pax: Number(params.childTableData.pax) || 2,
          hours: Number(params.childTableData.hours) || 1,
          paddleRent: Number(params.childTableData.paddleRent) || 0,
          ballRent: Number(params.childTableData.ballRent) || 0,
        });
        break;

      case 'hostel':
        childTable = 'hostel_transactions';
        this.hostelRows.unshift({
          hostelID: childId,
          transactionId: transactionID,
          roomType: params.childTableData.roomType || '2 Single Bed',
          roomRatePerNight: Number(params.childTableData.roomRatePerNight) || 1680,
          bookingSource: params.childTableData.bookingSource || 'Walk-in',
          checkIn: params.childTableData.checkIn || new Date().toISOString().split('T')[0],
          checkOut: params.childTableData.checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          numberOfNights: Number(params.childTableData.numberOfNights) || 1,
          amenities: params.childTableData.amenities || 'Swimming pool',
          vatIncluded: true,
        });
        break;

      case 'gym':
        childTable = 'gym_transactions';
        this.gymRows.unshift({
          gymID: childId,
          transactionId: transactionID,
          age: Number(params.childTableData.age) || 24,
          membershipStart: params.childTableData.membershipStart || new Date().toISOString().split('T')[0],
          serviceCategory: params.childTableData.serviceCategory || 'Per-Session Training',
          membershipType: params.childTableData.membershipType || 'Member',
          plan: params.childTableData.plan || 'Boxing Session',
          clientStatus: params.childTableData.clientStatus || 'Member',
          trainerProgram: params.childTableData.trainerProgram || 'Boxing',
          inclusions: params.childTableData.inclusions || [],
        });
        break;

      case 'pool':
        childTable = 'pool_transactions';
        this.poolRows.unshift({
          poolID: childId,
          transactionId: transactionID,
          guestType: params.childTableData.guestType || 'Walk-in',
          adults: Number(params.childTableData.adults) || 0,
          children: Number(params.childTableData.children) || 0,
          isHostelGuest: params.childTableData.guestType === 'Hotel Guest',
          visitDay: params.childTableData.visitDay || 'Weekday',
        });
        break;

      case 'ktv':
        childTable = 'ktv_transactions';
        this.ktvRows.unshift({
          ktvID: childId,
          transactionId: transactionID,
          room: params.childTableData.room || 'Room 1',
          packageType: params.childTableData.packageType || 'Custom Hourly',
          packageConsumable: Number(params.childTableData.packageConsumable) || 0,
          pax: Number(params.childTableData.pax) || 6,
          hours: Number(params.childTableData.hours) || 1,
          hourlyRate: Number(params.childTableData.hourlyRate) || 1000,
          package: params.childTableData.package || 'Custom Hourly (₱1,000/hr)',
        });
        break;

      case 'fnb':
        childTable = 'fnb_transactions';
        this.fnbRows.unshift({
          fnbID: childId,
          transactionId: transactionID,
          auditedTo: params.childTableData.auditedTo || 'Walk-in Client',
          orderItems: params.childTableData.orderItems || [],
          receiptPrintedAt: params.childTableData.receiptPrintedAt || new Date().toISOString(),
          tableOrRoomNo: params.childTableData.tableOrRoomNo || 'Table 1',
          totalPax: Number(params.childTableData.totalPax || 1),
          validIdCount: Number(params.childTableData.validIdCount || 0),
        });
        break;

      case 'billiards':
        childTable = 'billiards_transactions';
        this.billiardsRows.unshift({
          billiardsID: childId,
          transactionId: transactionID,
          place: params.childTableData.place || 'Without Aircon (₱200/hr)',
          hourlyRate: Number(params.childTableData.hourlyRate) || 200,
          hours: Number(params.childTableData.hours) || 1,
        });
        break;

      case 'tabletennis':
        childTable = 'tabletennis_transactions';
        this.tableTennisRows.unshift({
          tabletennisID: childId,
          transactionId: transactionID,
          tableNo: params.childTableData.tableNo || 'Table 1',
          hourlyRate: 250,
          hours: Number(params.childTableData.hours) || 1,
        });
        break;

      case 'parking':
        childTable = 'parking_transactions';
        this.parkingRows.unshift({
          parkingID: childId,
          transactionId: transactionID,
          plateNumber: (params.childTableData.plateNumber || 'ABC-0000').toUpperCase(),
          vehicleType: params.childTableData.vehicleType || 'Car',
          customVehicleName: params.childTableData.customVehicleName || undefined,
          wheelCount: Number(params.childTableData.wheelCount) === 2 ? 2 : 4,
          parkingType: params.childTableData.parkingType || 'Day',
          isCheckedInGuest: Boolean(params.childTableData.isCheckedInGuest),
        });
        break;

      case 'events':
        childTable = 'events_transactions';
        this.eventsRows.unshift({
          eventsID: childId,
          transactionId: transactionID,
          eventType: params.childTableData.eventType || 'Pre-Christmas Party',
          eventDate: params.childTableData.eventDate || new Date().toISOString().split('T')[0],
          headcount: Number(params.childTableData.headcount) || 50,
          spaceReserved: params.childTableData.spaceReserved || 'Grand Function Terrace',
        });
        break;

      default:
        childTable = 'generic_transactions';
        this.genericRows.unshift({
          genericID: childId,
          transactionId: transactionID,
          notes: params.childTableData.notes || '',
          customDetails: params.childTableData,
        });
        break;
    }

    const resolvedReceiver =
      params.paymentChannel === 'Cash' ? (params.cashReceivedBy || params.employeeHandler) : null;

    const newTx: MasterTransaction = {
      transactionID,
      outletName: params.outletName,
      outletSlug: params.outletSlug,
      outletService: params.outletService,
      customerName: params.customerName,
      employeeHandler: params.employeeHandler,
      employeeId: params.employeeId,
      cashReceivedBy: resolvedReceiver,
      transactionAmount: round2(params.transactionAmount),
      discountApplied,
      discount,
      totalAmount,
      amountPaid,
      balanceDue,
      transactionStatus: initialStatus,
      transactionDateTime: nowIso,
      paymentArrangement: params.paymentArrangement,
      paymentChannel: params.paymentChannel,
      initialPaymentMode: params.paymentChannel,
      balancePaymentMode: null,
      outletRefTable: childTable,
      outletRefId: childId,
      qrToken,
      paidAt,
      hourlyRate: params.hourlyRate ?? null,
      timerDurationMinutes: timerMins,
      timerStartedAt,
      timerEndsAt,
      timerStoppedAt: null,
      timerAcknowledged: false,
      version: 1,
    };

    this.transactions.unshift(newTx);

    // Record Initial Payment Installment
    const initialInstallmentId = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (totalAmount > 0) {
      this.installments.unshift({
        installmentID: initialInstallmentId,
        transactionId: transactionID,
        phase: 'initial',
        paymentChannel: params.paymentChannel,
        amount: isDownPaymentFlow ? plannedDownAmount : totalAmount,
        status: isPaidNow ? 'confirmed' : 'pending',
        cashReceivedBy: resolvedReceiver,
        qrToken,
        paidAt: isPaidNow ? nowIso : null,
        createdAt: nowIso,
      });
    }

    // Only queue CashConfirmation immediately when Full Payment Cash is already collected.
    // Down Payment Cash queues CashConfirmation once the clerk confirms initial down payment collection.
    if (params.paymentChannel === 'Cash' && isPaidNow && amountPaid > 0) {
      this.cashConfirmations.unshift({
        id: `csh-${Date.now()}`,
        transactionId: transactionID,
        installmentId: initialInstallmentId,
        outletName: params.outletName,
        customerName: params.customerName,
        amount: amountPaid,
        cashReceivedBy: newTx.cashReceivedBy,
        status: 'pending_audit',
        createdAt: nowIso,
      });
    }

    this.notify();
    return newTx;
  }

  /**
   * Confirm Initial Down Payment (Cash or QRPh) - Revision 002 Two-Step Fix
   * Keeps transaction 'pending' with only the remaining balance left to pay.
   */
  public confirmInitialDownPayment(
    transactionId: string,
    cashReceivedBy?: string
  ): { success: boolean; transaction?: MasterTransaction; settledAmount: number } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { success: false, settledAmount: 0 };

    const pendingInit = this.installments.find(
      (i) => i.transactionId === transactionId && i.phase === 'initial' && i.status === 'pending'
    );
    if (!pendingInit) return { success: false, settledAmount: 0 };

    const nowIso = new Date().toISOString();
    const receiver =
      pendingInit.paymentChannel === 'Cash'
        ? cashReceivedBy?.trim() || pendingInit.cashReceivedBy || tx.cashReceivedBy || tx.employeeHandler
        : tx.cashReceivedBy;

    this.installments = this.installments.map((inst) =>
      inst.installmentID === pendingInit.installmentID
        ? { ...inst, status: 'confirmed', cashReceivedBy: receiver, paidAt: nowIso }
        : inst
    );

    const newPaid = round2(Math.min(tx.totalAmount, tx.amountPaid + pendingInit.amount));
    const newBalance = round2(Math.max(0, tx.totalAmount - newPaid));
    const isNowFullyPaid = newBalance <= 0;

    const updated: MasterTransaction = {
      ...tx,
      initialPaymentMode: pendingInit.paymentChannel,
      paymentChannel: pendingInit.paymentChannel,
      cashReceivedBy: receiver || tx.cashReceivedBy,
      amountPaid: newPaid,
      balanceDue: newBalance,
      transactionStatus: isNowFullyPaid ? 'paid' : 'pending',
      paidAt: isNowFullyPaid ? nowIso : null,
      version: tx.version + 1,
    };

    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId ? updated : t
    );

    if (pendingInit.paymentChannel === 'Cash' && pendingInit.amount > 0) {
      this.cashConfirmations.unshift({
        id: `csh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        transactionId: tx.transactionID,
        installmentId: pendingInit.installmentID,
        outletName: tx.outletName,
        customerName: tx.customerName,
        amount: pendingInit.amount,
        cashReceivedBy: receiver || tx.employeeHandler,
        status: 'pending_audit',
        createdAt: nowIso,
      });
    }

    this.notify();
    return { success: true, transaction: updated, settledAmount: pendingInit.amount };
  }

  /**
   * Edge Case: Customer cancels/refuses the initial down payment -> instant void (Revision 002)
   */
  public voidCancelledInitialPayment(transactionId: string): void {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return;

    this.installments = this.installments.map((inst) =>
      inst.transactionId === transactionId && inst.status === 'pending'
        ? { ...inst, status: 'voided' }
        : inst
    );

    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId
        ? {
            ...t,
            transactionStatus: 'void',
            amountPaid: 0,
            balanceDue: 0,
            timerEndsAt: null,
            timerAcknowledged: true,
            version: t.version + 1,
          }
        : t
    );
    this.notify();
  }

  /**
   * Pay remaining balance via Cash or QRPh with independent follow-up mode switching (Revision 002)
   */
  public payBalance(
    transactionId: string,
    channel: PaymentChannel,
    cashReceivedBy?: string
  ): { success: boolean; transaction?: MasterTransaction; installment?: PaymentInstallment } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { success: false };

    const nowIso = new Date().toISOString();
    const year = new Date().getFullYear();

    // Determine whether we are settling an unconfirmed initial installment or a follow-up balance
    const pendingInit = this.installments.find(
      (i) => i.transactionId === transactionId && i.phase === 'initial' && i.status === 'pending'
    );
    const isUnconfirmedInitialDown =
      Boolean(pendingInit) && tx.paymentArrangement === 'Down Payment' && tx.amountPaid === 0;

    const targetPhase: 'initial' | 'balance' = pendingInit ? pendingInit.phase : 'balance';
    const targetAmount = isUnconfirmedInitialDown
      ? pendingInit!.amount
      : tx.balanceDue > 0
      ? tx.balanceDue
      : tx.totalAmount;

    if (channel === 'Cash') {
      const receiver = cashReceivedBy?.trim() || tx.cashReceivedBy || tx.employeeHandler;

      // If settling an unconfirmed initial down payment in Cash, route through confirmInitialDownPayment
      if (isUnconfirmedInitialDown && pendingInit) {
        this.installments = this.installments.map((i) =>
          i.installmentID === pendingInit.installmentID
            ? { ...i, paymentChannel: 'Cash', cashReceivedBy: receiver }
            : i
        );
        const res = this.confirmInitialDownPayment(transactionId, receiver);
        return { success: res.success, transaction: res.transaction };
      }

      let targetInstId = pendingInit?.installmentID;
      if (pendingInit) {
        this.installments = this.installments.map((i) =>
          i.installmentID === pendingInit.installmentID
            ? {
                ...i,
                paymentChannel: 'Cash',
                amount: targetAmount,
                status: 'confirmed',
                cashReceivedBy: receiver,
                paidAt: nowIso,
              }
            : i
        );
      } else {
        targetInstId = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        this.installments.unshift({
          installmentID: targetInstId,
          transactionId: tx.transactionID,
          phase: 'balance',
          paymentChannel: 'Cash',
          amount: targetAmount,
          status: 'confirmed',
          cashReceivedBy: receiver,
          paidAt: nowIso,
          createdAt: nowIso,
        });
      }

      const updated: MasterTransaction = {
        ...tx,
        paymentChannel: 'Cash',
        initialPaymentMode: tx.initialPaymentMode || tx.paymentChannel,
        balancePaymentMode: targetPhase === 'balance' ? 'Cash' : tx.balancePaymentMode || null,
        cashReceivedBy: receiver,
        amountPaid: tx.totalAmount,
        balanceDue: 0,
        transactionStatus: 'paid',
        paidAt: nowIso,
        version: tx.version + 1,
      };
      this.transactions = this.transactions.map((t) =>
        t.transactionID === transactionId ? updated : t
      );

      if (targetAmount > 0) {
        this.cashConfirmations.unshift({
          id: `csh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          transactionId: tx.transactionID,
          installmentId: targetInstId,
          outletName: tx.outletName,
          customerName: tx.customerName,
          amount: targetAmount,
          cashReceivedBy: receiver,
          status: 'pending_audit',
          createdAt: nowIso,
        });
      }

      this.notify();
      return { success: true, transaction: updated };
    }

    // QRPh follow-up or mode switch: prepare/reuse pending installment for exact targetAmount
    const nextQrToken =
      tx.qrToken ||
      `QRPH-${year}-${tx.outletSlug.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const existingPendingBal = this.installments.find(
      (i) => i.transactionId === transactionId && i.status === 'pending'
    );

    let activeInstallment: PaymentInstallment;
    if (existingPendingBal) {
      activeInstallment = {
        ...existingPendingBal,
        paymentChannel: 'QRPh',
        amount: targetAmount,
        qrToken: nextQrToken,
      };
      this.installments = this.installments.map((i) =>
        i.installmentID === existingPendingBal.installmentID ? activeInstallment : i
      );
    } else {
      activeInstallment = {
        installmentID: `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        transactionId: tx.transactionID,
        phase: targetPhase,
        paymentChannel: 'QRPh',
        amount: targetAmount,
        status: 'pending',
        qrToken: nextQrToken,
        createdAt: nowIso,
      };
      this.installments.unshift(activeInstallment);
    }

    const updated: MasterTransaction = {
      ...tx,
      paymentChannel: 'QRPh',
      initialPaymentMode: tx.initialPaymentMode || tx.paymentChannel,
      qrToken: nextQrToken,
      version: tx.version + 1,
    };
    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId ? updated : t
    );
    this.notify();
    return { success: true, transaction: updated, installment: activeInstallment };
  }

  /**
   * Extend Timed Session & Recalculate Payable Balance (Revision 001)
   */
  public extendTimedTransaction(
    transactionId: string,
    additionalHours: number
  ): { success: boolean; transaction?: MasterTransaction; error?: string } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { success: false, error: 'Transaction not found.' };
    if (additionalHours <= 0) return { success: false, error: 'Extension hours must be greater than zero.' };

    const rate = tx.hourlyRate || 0;
    const addedSelling = round2(rate * additionalHours);
    const newSelling = round2(tx.transactionAmount + addedSelling);
    const { discount, totalAmount } = calculateDiscountBreakdown(newSelling, tx.discountApplied);
    const newBalance = round2(Math.max(0, totalAmount - tx.amountPaid));
    const addedMins = Math.round(additionalHours * 60);

    const currentEndsMs = tx.timerEndsAt ? new Date(tx.timerEndsAt).getTime() : Date.now();
    const baseMs = Math.max(Date.now(), currentEndsMs);
    const nextEndsAt = new Date(baseMs + addedMins * 60_000).toISOString();

    const updated: MasterTransaction = {
      ...tx,
      transactionAmount: newSelling,
      discount,
      totalAmount,
      balanceDue: newBalance,
      transactionStatus: newBalance > 0 ? 'pending' : tx.transactionStatus,
      timerDurationMinutes: (tx.timerDurationMinutes || 0) + addedMins,
      timerStartedAt: tx.timerStartedAt || new Date().toISOString(),
      timerEndsAt: nextEndsAt,
      timerAcknowledged: false,
      version: tx.version + 1,
    };

    // Update child table hours
    switch (tx.outletRefTable) {
      case 'billiards_transactions':
        this.billiardsRows = this.billiardsRows.map((r) =>
          r.billiardsID === tx.outletRefId ? { ...r, hours: r.hours + additionalHours } : r
        );
        break;
      case 'pickleball_transactions':
        this.pickleballRows = this.pickleballRows.map((r) =>
          r.pickleballID === tx.outletRefId ? { ...r, hours: r.hours + additionalHours } : r
        );
        break;
      case 'tabletennis_transactions':
        this.tableTennisRows = this.tableTennisRows.map((r) =>
          r.tabletennisID === tx.outletRefId ? { ...r, hours: r.hours + additionalHours } : r
        );
        break;
      case 'ktv_transactions':
        this.ktvRows = this.ktvRows.map((r) =>
          r.ktvID === tx.outletRefId ? { ...r, hours: r.hours + additionalHours } : r
        );
        break;
    }

    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId ? updated : t
    );
    this.notify();
    return { success: true, transaction: updated };
  }

  public acknowledgeTimer(transactionId: string): void {
    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId ? { ...t, timerAcknowledged: true } : t
    );
    this.notify();
  }

  public stopTimer(transactionId: string): void {
    const nowIso = new Date().toISOString();
    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId
        ? {
            ...t,
            timerStoppedAt: nowIso,
            timerEndsAt: nowIso,
            timerAcknowledged: true,
            version: t.version + 1,
          }
        : t
    );
    this.notify();
  }

  public updatePendingTransaction(
    transactionId: string,
    updates: Partial<MasterTransaction>,
    userId: string
  ): { success: boolean; error?: string } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { success: false, error: 'Transaction not found.' };
    if (tx.transactionStatus !== 'pending') {
      return { success: false, error: 'Only pending transactions can be edited by clerks.' };
    }
    if (tx.lockedBy && tx.lockedBy !== userId) {
      return { success: false, error: `Locked by ${tx.lockedByName || 'another user'}.` };
    }

    const newAmount = updates.transactionAmount !== undefined ? updates.transactionAmount : tx.transactionAmount;
    const discountApplied = updates.discountApplied !== undefined ? updates.discountApplied : tx.discountApplied;
    const { discount, totalAmount } =
      updates.discount !== undefined && updates.discountApplied === undefined
        ? { discount: updates.discount, totalAmount: round2(Math.max(0, newAmount - updates.discount)) }
        : calculateDiscountBreakdown(newAmount, discountApplied);

    const amountPaid = updates.amountPaid !== undefined ? updates.amountPaid : tx.amountPaid;
    const balanceDue = round2(Math.max(0, totalAmount - amountPaid));

    this.transactions = this.transactions.map((t) => {
      if (t.transactionID !== transactionId) return t;
      return {
        ...t,
        ...updates,
        transactionAmount: round2(newAmount),
        discountApplied,
        discount,
        totalAmount,
        amountPaid,
        balanceDue,
        version: t.version + 1,
        lockedBy: null,
        lockedByName: null,
        lockedAt: null,
      };
    });

    this.notify();
    return { success: true };
  }

  public markAsPaid(transactionId: string, employeeName: string): void {
    this.payBalance(transactionId, 'Cash', employeeName);
  }

  /**
   * QrPh Prototype Validation (NFR2 + Revision 002 Two-Step Down Payment Fix)
   */
  public validateQrPayment(transactionId: string): { success: boolean; message: string } {
    const tx = this.getTransactionById(transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };

    const pendingInst = this.getPendingInstallment(transactionId);

    // Case 1: Initial Down Payment via QRPh (only collects the initial down payment, leaves balanceDue pending)
    if (
      pendingInst &&
      pendingInst.phase === 'initial' &&
      tx.paymentArrangement === 'Down Payment' &&
      tx.amountPaid === 0
    ) {
      const res = this.confirmInitialDownPayment(transactionId);
      const remaining = res.transaction?.balanceDue ?? 0;
      return {
        success: true,
        message: `Initial QR Ph down payment of ₱${res.settledAmount.toLocaleString('en-PH', {
          minimumFractionDigits: 2,
        })} verified! Remaining balance: ₱${remaining.toLocaleString('en-PH', {
          minimumFractionDigits: 2,
        })}.`,
      };
    }

    // Case 2: Full Payment QRPh OR follow-up Remaining Balance QRPh
    const settledAmount = pendingInst
      ? pendingInst.amount
      : tx.balanceDue > 0
      ? tx.balanceDue
      : tx.totalAmount;
    const nowIso = new Date().toISOString();

    if (pendingInst) {
      this.installments = this.installments.map((i) =>
        i.installmentID === pendingInst.installmentID
          ? { ...i, status: 'confirmed', paidAt: nowIso }
          : i
      );
    } else if (settledAmount > 0) {
      this.installments.unshift({
        installmentID: `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        transactionId,
        phase: tx.paymentArrangement === 'Down Payment' ? 'balance' : 'initial',
        paymentChannel: 'QRPh',
        amount: settledAmount,
        status: 'confirmed',
        qrToken: tx.qrToken,
        paidAt: nowIso,
        createdAt: nowIso,
      });
    }

    this.transactions = this.transactions.map((t) =>
      t.transactionID === transactionId
        ? {
            ...t,
            paymentChannel: 'QRPh',
            balancePaymentMode:
              t.paymentArrangement === 'Down Payment' && t.amountPaid > 0
                ? 'QRPh'
                : t.balancePaymentMode || null,
            amountPaid: t.totalAmount,
            balanceDue: 0,
            transactionStatus: 'paid',
            paidAt: nowIso,
            version: t.version + 1,
          }
        : t
    );
    this.notify();
    return {
      success: true,
      message: `QR Ph payment of ₱${settledAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} verified successfully!`,
    };
  }

  // --- Workflows: Cash Confirmation (FR83) ---
  public getCashConfirmations(): CashConfirmation[] {
    return [...this.cashConfirmations];
  }

  public approveCashConfirmation(id: string, adminName: string): void {
    this.cashConfirmations = this.cashConfirmations.map((c) =>
      c.id === id ? { ...c, status: 'confirmed', approvedBy: adminName, approvedAt: new Date().toISOString() } : c
    );
    this.notify();
  }

  // --- Workflows: Void Requests ---
  public getVoidRequests(): VoidRequest[] {
    return [...this.voidRequests];
  }

  public createVoidRequest(
    transactionId: string,
    requestedBy: string,
    requestedByName: string,
    role: string,
    reason: string,
    note?: string
  ): VoidRequest {
    const tx = this.getTransactionById(transactionId);
    const newReq: VoidRequest = {
      id: `void-${Date.now()}`,
      transactionId,
      requestedBy,
      requestedByName,
      requestedByRole: role,
      outletName: tx ? tx.outletName : 'Outlet',
      amount: tx ? tx.totalAmount : 0,
      reason,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.voidRequests.unshift(newReq);
    this.notify();
    return newReq;
  }

  public decideVoidRequest(id: string, decision: 'approved' | 'rejected', adminName: string): void {
    const req = this.voidRequests.find((r) => r.id === id);
    if (!req) return;

    this.voidRequests = this.voidRequests.map((r) =>
      r.id === id ? { ...r, status: decision, decidedBy: adminName, decidedAt: new Date().toISOString() } : r
    );

    if (decision === 'approved') {
      this.transactions = this.transactions.map((t) =>
        t.transactionID === req.transactionId
          ? { ...t, transactionStatus: 'void', version: t.version + 1 }
          : t
      );
    }
    this.notify();
  }

  // --- Workflows: Edit Requests (Front-Desk / Clerks -> Accountant Approval) ---
  public getEditRequests(): EditRequest[] {
    return [...this.editRequests];
  }

  public createEditRequest(
    transactionId: string,
    requestedBy: string,
    requestedByName: string,
    changes: EditRequest['changes'],
    note: string,
    requestedByRole: UserRole = 'admin'
  ): EditRequest {
    const req: EditRequest = {
      id: `edit-${Date.now()}`,
      transactionId,
      requestedBy,
      requestedByName,
      requestedByRole,
      changes,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.editRequests.unshift(req);
    this.notify();
    return req;
  }

  public decideEditRequest(id: string, decision: 'approved' | 'rejected', accountantName: string): void {
    const req = this.editRequests.find((r) => r.id === id);
    if (!req) return;

    this.editRequests = this.editRequests.map((r) =>
      r.id === id ? { ...r, status: decision, decidedBy: accountantName, decidedAt: new Date().toISOString() } : r
    );

    if (decision === 'approved') {
      this.transactions = this.transactions.map((t) => {
        if (t.transactionID !== req.transactionId) return t;
        const newCustomer = req.changes.customerName !== undefined ? req.changes.customerName : t.customerName;
        const newStatus = req.changes.transactionStatus || t.transactionStatus;
        const newAmount = req.changes.transactionAmount !== undefined ? req.changes.transactionAmount : t.transactionAmount;
        const newDiscount = req.changes.discount !== undefined ? req.changes.discount : t.discount;
        const newTotal = req.changes.totalAmount !== undefined ? req.changes.totalAmount : round2(Math.max(0, newAmount - newDiscount));
        const newPaid = newStatus === 'paid' ? newTotal : Math.min(t.amountPaid, newTotal);
        return {
          ...t,
          customerName: newCustomer,
          transactionStatus: newStatus,
          transactionAmount: newAmount,
          discount: newDiscount,
          totalAmount: newTotal,
          amountPaid: newPaid,
          balanceDue: newStatus === 'void' ? 0 : round2(Math.max(0, newTotal - newPaid)),
          version: t.version + 1,
        };
      });
    }
    this.notify();
  }

  // --- Accountant Direct Privileges (Revision 002: Accountant edits require no approval) ---
  public accountantDirectUpdate(transactionId: string, updates: Partial<MasterTransaction>): void {
    this.transactions = this.transactions.map((t) => {
      if (t.transactionID !== transactionId) return t;
      const amount = updates.transactionAmount !== undefined ? updates.transactionAmount : t.transactionAmount;
      const discount = updates.discount !== undefined ? updates.discount : t.discount;
      const total = updates.totalAmount !== undefined ? updates.totalAmount : round2(Math.max(0, amount - discount));
      const status = updates.transactionStatus || t.transactionStatus;
      const paid = status === 'paid' ? total : Math.min(t.amountPaid, total);
      return {
        ...t,
        ...updates,
        transactionAmount: amount,
        discount,
        totalAmount: total,
        amountPaid: paid,
        balanceDue: status === 'void' ? 0 : round2(Math.max(0, total - paid)),
        version: t.version + 1,
      };
    });
    this.notify();
  }

  public adminDirectUpdate(transactionId: string, updates: Partial<MasterTransaction>): void {
    this.accountantDirectUpdate(transactionId, updates);
  }

  public adminDirectDelete(transactionId: string): void {
    this.transactions = this.transactions.filter((t) => t.transactionID !== transactionId);
    this.installments = this.installments.filter((i) => i.transactionId !== transactionId);
    this.cashConfirmations = this.cashConfirmations.filter((c) => c.transactionId !== transactionId);
    this.voidRequests = this.voidRequests.filter((v) => v.transactionId !== transactionId);
    this.notify();
  }

  // --- AI Audit & Bank Reconciliation Persistence (Revision 002) ---
  public getAiAuditLogs(): AiAuditLog[] {
    return [...this.aiAuditLogs];
  }

  public addAiAuditLog(log: Omit<AiAuditLog, 'auditID' | 'createdAt'>): AiAuditLog {
    const entry: AiAuditLog = {
      ...log,
      auditID: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    this.aiAuditLogs.unshift(entry);
    this.notify();
    return entry;
  }

  public getReconciliationBatches(outletId?: string): ReconciliationBatch[] {
    if (!outletId) return [...this.reconciliationBatches];
    return this.reconciliationBatches.filter((b) => b.outletId === outletId);
  }

  public addReconciliationBatch(batch: Omit<ReconciliationBatch, 'reconID' | 'createdAt'>): ReconciliationBatch {
    const entry: ReconciliationBatch = {
      ...batch,
      reconID: `REC-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    this.reconciliationBatches.unshift(entry);
    this.notify();
    return entry;
  }

  // --- Centralized Sync Calendar Events (Revision 003) ---
  public getCalendarEvents(outletSlug?: OutletSlug | 'all'): CalendarEventRecord[] {
    if (!outletSlug || outletSlug === 'all') return [...this.calendarEvents];
    return this.calendarEvents.filter((c) => c.outletSlug === outletSlug);
  }

  public addCalendarEvent(input: {
    outletSlug: OutletSlug;
    outletName: string;
    title: string;
    customerName: string;
    category: CalendarEventCategory;
    start: string;
    end?: string | null;
    allDay: boolean;
    notes?: string;
    createdBy: string;
  }): CalendarEventRecord {
    const entry: CalendarEventRecord = {
      calendarID: `cal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      outletSlug: input.outletSlug,
      outletName: input.outletName,
      title: input.title.trim(),
      customerName: input.customerName.trim(),
      category: input.category,
      start: input.start,
      end: input.end || null,
      allDay: input.allDay,
      notes: input.notes?.trim() || '',
      status: 'scheduled',
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    this.calendarEvents.unshift(entry);
    this.notify();
    return entry;
  }

  public updateCalendarEventStatus(
    calendarID: string,
    status: CalendarEventRecord['status']
  ): void {
    this.calendarEvents = this.calendarEvents.map((ev) =>
      ev.calendarID === calendarID ? { ...ev, status } : ev
    );
    this.notify();
  }

  public deleteCalendarEvent(calendarID: string): void {
    this.calendarEvents = this.calendarEvents.filter((ev) => ev.calendarID !== calendarID);
    this.notify();
  }

  public resetToFactory(): void {
    localStorage.clear();
    this.users = [...INITIAL_USERS];
    this.outlets = [...INITIAL_OUTLETS];
    this.services = [...INITIAL_SERVICES];
    this.transactions = [...INITIAL_TRANSACTIONS];
    this.installments = [...INITIAL_INSTALLMENTS];
    this.pickleballRows = [...INITIAL_PICKLEBALL_ROWS];
    this.hostelRows = [...INITIAL_HOSTEL_ROWS];
    this.gymRows = [...INITIAL_GYM_ROWS];
    this.poolRows = [...INITIAL_POOL_ROWS];
    this.ktvRows = [...INITIAL_KTV_ROWS];
    this.fnbRows = [...INITIAL_FNB_ROWS];
    this.billiardsRows = [...INITIAL_BILLIARDS_ROWS];
    this.tableTennisRows = [...INITIAL_TABLETENNIS_ROWS];
    this.parkingRows = [...INITIAL_PARKING_ROWS];
    this.eventsRows = [...INITIAL_EVENTS_ROWS];
    this.genericRows = [];
    this.cashConfirmations = [...INITIAL_CASH_CONFIRMATIONS];
    this.voidRequests = [...INITIAL_VOID_REQUESTS];
    this.editRequests = [];
    this.aiAuditLogs = [];
    this.reconciliationBatches = [];
    this.calendarEvents = [...INITIAL_CALENDAR_EVENTS];
    this.notify();
  }

  // --- Code Generators (Revision 002 Internal PHP & MySQL Schema Artifacts) ---
  public generateMySQLSchema(): string {
    return `-- =====================================================================
-- CAFE LUPE CENTRALIZED SALES REPORT AND TRANSACTION GATEWAY (REV 002)
-- Complete Production MySQL / MariaDB Schema
-- =====================================================================

CREATE DATABASE IF NOT EXISTS \`cafelupe_gateway\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`cafelupe_gateway\`;

-- 1. Retained Role/Outlet Users (Front-Desk Admin, Accountant, Gym, F&B POS)
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` VARCHAR(50) PRIMARY KEY,
  \`name\` VARCHAR(100) NOT NULL,
  \`email\` VARCHAR(150) NOT NULL UNIQUE,
  \`password\` VARCHAR(255) NOT NULL,
  \`role\` ENUM('staff', 'admin', 'accountant') NOT NULL DEFAULT 'staff',
  \`outlet_id\` VARCHAR(50) NULL,
  \`approval_status\` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Outlets Table
CREATE TABLE IF NOT EXISTS \`outlets\` (
  \`id\` VARCHAR(50) PRIMARY KEY,
  \`name\` VARCHAR(100) NOT NULL,
  \`slug\` VARCHAR(50) NOT NULL UNIQUE,
  \`template\` VARCHAR(50) NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 3. Master Transactions Ledger (Revision 002 Columns)
CREATE TABLE IF NOT EXISTS \`transactions\` (
  \`transactionID\` VARCHAR(50) PRIMARY KEY,
  \`outletName\` VARCHAR(100) NOT NULL,
  \`outletService\` VARCHAR(200) NOT NULL,
  \`customerName\` VARCHAR(150) NOT NULL,
  \`employeeHandler\` VARCHAR(100) NOT NULL,
  \`cashReceivedBy\` VARCHAR(100) NULL,
  \`transactionAmount\` DECIMAL(10, 2) NOT NULL,
  \`discountApplied\` TINYINT(1) NOT NULL DEFAULT 0,
  \`discount\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  \`totalAmount\` DECIMAL(10, 2) NOT NULL,
  \`amountPaid\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  \`balanceDue\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  \`transactionStatus\` ENUM('pending', 'paid', 'void') NOT NULL DEFAULT 'pending',
  \`transactionDateTime\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`paymentArrangement\` ENUM('Full Payment', 'Down Payment') NOT NULL,
  \`paymentChannel\` ENUM('Cash', 'QRPh') NOT NULL,
  \`initial_payment_mode\` ENUM('Cash', 'QRPh') NULL,
  \`balance_payment_mode\` ENUM('Cash', 'QRPh') NULL,
  \`outlet_ref_table\` VARCHAR(50) NOT NULL,
  \`outlet_ref_id\` VARCHAR(50) NOT NULL,
  \`qr_token\` VARCHAR(100) NULL,
  \`paid_at\` DATETIME NULL,
  \`hourlyRate\` DECIMAL(10, 2) NULL,
  \`timerDurationMinutes\` INT NULL,
  \`timerStartedAt\` DATETIME NULL,
  \`timerEndsAt\` DATETIME NULL,
  \`timer_stopped_at\` DATETIME NULL,
  \`timerAcknowledged\` TINYINT(1) NOT NULL DEFAULT 0,
  \`locked_by\` VARCHAR(50) NULL,
  \`locked_at\` DATETIME NULL,
  \`version\` INT UNSIGNED NOT NULL DEFAULT 1,
  INDEX \`idx_tx_datetime\` (\`transactionDateTime\`),
  INDEX \`idx_tx_status\` (\`transactionStatus\`)
) ENGINE=InnoDB;

-- 3B. Split Payment Installments Table (Revision 002)
CREATE TABLE IF NOT EXISTS \`payment_installments\` (
  \`installmentID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`phase\` ENUM('initial', 'balance') NOT NULL,
  \`payment_channel\` ENUM('Cash', 'QRPh') NOT NULL,
  \`amount\` DECIMAL(10, 2) NOT NULL,
  \`status\` ENUM('pending', 'confirmed', 'voided') NOT NULL DEFAULT 'pending',
  \`cash_received_by\` VARCHAR(100) NULL,
  \`qr_token\` VARCHAR(100) NULL,
  \`paid_at\` DATETIME NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3C. AI Audit Logs & Per-Outlet Bank Reconciliation Batches (Revision 002)
CREATE TABLE IF NOT EXISTS \`ai_audit_logs\` (
  \`auditID\` VARCHAR(50) PRIMARY KEY,
  \`audit_type\` ENUM('deposit_validation', 'financial_summary', 'forecast_plan', 'advisor_query') NOT NULL,
  \`target_date\` DATE NULL,
  \`system_total\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  \`extracted_total\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  \`discrepancy_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  \`match_status\` ENUM('matched', 'conflict', 'info') NOT NULL DEFAULT 'info',
  \`extracted_json\` JSON NULL,
  \`summary_text\` TEXT NULL,
  \`created_by\` VARCHAR(100) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`reconciliation_batches\` (
  \`reconID\` VARCHAR(50) PRIMARY KEY,
  \`outlet_id\` VARCHAR(50) NOT NULL,
  \`outlet_name\` VARCHAR(100) NOT NULL,
  \`start_date\` DATE NOT NULL,
  \`end_date\` DATE NOT NULL,
  \`statement_filename\` VARCHAR(255) NOT NULL,
  \`extracted_entries_json\` JSON NULL,
  \`comparison_results_json\` JSON NULL,
  \`overall_status\` ENUM('matched', 'conflict') NOT NULL,
  \`created_by\` VARCHAR(100) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`calendar_events\` (
  \`calendarID\` VARCHAR(50) PRIMARY KEY,
  \`outlet_slug\` VARCHAR(50) NOT NULL,
  \`outlet_name\` VARCHAR(100) NOT NULL,
  \`title\` VARCHAR(150) NOT NULL,
  \`customer_name\` VARCHAR(150) NOT NULL,
  \`category\` ENUM('Booking', 'Reservation', 'Tournament', 'Maintenance', 'Function') NOT NULL DEFAULT 'Booking',
  \`start_at\` DATETIME NOT NULL,
  \`end_at\` DATETIME NULL,
  \`all_day\` TINYINT(1) NOT NULL DEFAULT 0,
  \`notes\` TEXT NULL,
  \`status\` ENUM('scheduled', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  \`created_by\` VARCHAR(100) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Dedicated Outlet Child Tables (Revision 001)
CREATE TABLE IF NOT EXISTS \`billiards_transactions\` (
  \`billiardsID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`place\` ENUM('Without Aircon (₱200/hr)', 'With Aircon (₱400/hr)') NOT NULL,
  \`hourly_rate\` DECIMAL(10, 2) NOT NULL,
  \`hours\` INT NOT NULL DEFAULT 1,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`pickleball_transactions\` (
  \`pickleballID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`court\` ENUM('Al Fresco (Ground Floor)', 'Indoor (2nd Floor)') NOT NULL,
  \`pax\` INT NOT NULL DEFAULT 2,
  \`hours\` INT NOT NULL DEFAULT 1,
  \`paddle_rent\` INT NOT NULL DEFAULT 0,
  \`ball_rent\` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`tabletennis_transactions\` (
  \`tabletennisID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`table_no\` VARCHAR(20) NOT NULL,
  \`hourly_rate\` DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
  \`hours\` INT NOT NULL DEFAULT 1,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`ktv_transactions\` (
  \`ktvID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`room\` ENUM('Room 1', 'Room 2', 'Room 3', 'Room 4') NOT NULL,
  \`package_type\` ENUM('Custom Hourly', 'KTV 1 & 2 Package', 'KTV Suite 4 Package') NOT NULL,
  \`package_consumable\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  \`pax\` INT NOT NULL,
  \`hours\` INT NOT NULL DEFAULT 1,
  \`hourly_rate\` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
  \`package\` VARCHAR(150) NOT NULL,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`parking_transactions\` (
  \`parkingID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`plate_number\` VARCHAR(20) NOT NULL,
  \`vehicle_type\` ENUM('Car', 'Van', 'Truck', 'Tricycle', 'Motorcycle', 'Others') NOT NULL,
  \`custom_vehicle_name\` VARCHAR(100) NULL,
  \`wheel_count\` TINYINT NOT NULL DEFAULT 4,
  \`parking_type\` ENUM('Day', 'Night', 'Overnight') NOT NULL,
  \`is_checked_in_guest\` TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`pool_transactions\` (
  \`poolID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`guest_type\` ENUM('Walk-in', 'Hotel Guest') NOT NULL,
  \`adults\` INT NOT NULL DEFAULT 0,
  \`children\` INT NOT NULL DEFAULT 0,
  \`is_hostel_guest\` TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`hostel_transactions\` (
  \`hostelID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`room_type\` ENUM('2 Single Bed', 'King Size Bed', 'Queen Size Bed', 'Suite Room - Overlooking') NOT NULL,
  \`room_rate_per_night\` DECIMAL(10, 2) NOT NULL,
  \`booking_source\` ENUM('Walk-in', 'Agoda', 'Traveloka') NOT NULL DEFAULT 'Walk-in',
  \`check_in\` DATE NOT NULL,
  \`check_out\` DATE NOT NULL,
  \`number_of_nights\` INT NOT NULL DEFAULT 1,
  \`amenities\` VARCHAR(100) NULL,
  \`vat_included\` TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`gym_transactions\` (
  \`gymID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`age\` INT NOT NULL,
  \`membership_start\` DATE NOT NULL,
  \`service_category\` ENUM('Annual Membership', 'Monthly Package', 'Per-Session Training', 'Self-Train Session') NOT NULL,
  \`membership_type\` VARCHAR(60) NOT NULL,
  \`plan\` VARCHAR(100) NOT NULL,
  \`client_status\` VARCHAR(50) NOT NULL,
  \`trainer_program\` VARCHAR(100) NULL,
  \`inclusions\` JSON NULL,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`fnb_transactions\` (
  \`fnbID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`audited_to\` ENUM('Walk-in Client', 'Function Guest', 'KTV Room User') NOT NULL,
  \`table_or_room_no\` VARCHAR(50) NULL,
  \`order_items\` JSON NOT NULL,
  \`total_pax\` INT NOT NULL DEFAULT 1,
  \`valid_id_count\` INT NOT NULL DEFAULT 0,
  \`receipt_printed_at\` DATETIME NULL,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`events_transactions\` (
  \`eventsID\` VARCHAR(50) PRIMARY KEY,
  \`transaction_id\` VARCHAR(50) NOT NULL,
  \`event_type\` VARCHAR(100) NOT NULL,
  \`event_date\` DATE NOT NULL,
  \`headcount\` INT NOT NULL,
  \`space_reserved\` VARCHAR(120) NOT NULL,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`transactionID\`) ON DELETE CASCADE
) ENGINE=InnoDB;
`;
  }

  public generatePHPService(): string {
    return `<?php
/**
 * Cafe Lupe Centralized Sales Report and Transaction Gateway System (Revision 001)
 * Production PHP 8 Backend Service
 */

declare(strict_types=1);

namespace CafeLupe\\Services;

use PDO;
use Exception;

class TransactionService {
    public function __construct(private readonly PDO $db) {}

    public static function calculateDiscount(float $sellingPrice, bool $discountApplied): array {
        $clean = max(0.0, round($sellingPrice, 2));
        if (!$discountApplied) {
            return ['discount' => 0.0, 'totalAmount' => $clean];
        }
        $final = round(($clean / 1.12) * 0.80, 2);
        return ['discount' => round(max(0.0, $clean - $final), 2), 'totalAmount' => $final];
    }

    public function payBalance(string $transactionID, string $channel, ?string $cashReceivedBy = null): array {
        $stmt = $this->db->prepare("SELECT * FROM transactions WHERE transactionID = :id LIMIT 1");
        $stmt->execute([':id' => $transactionID]);
        $tx = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tx) {
            throw new Exception('Transaction not found.');
        }

        if ($channel === 'Cash') {
            $upd = $this->db->prepare(
                "UPDATE transactions SET paymentChannel = 'Cash', cashReceivedBy = :rx,
                 amountPaid = totalAmount, balanceDue = 0, transactionStatus = 'paid',
                 paid_at = NOW(), version = version + 1 WHERE transactionID = :id"
            );
            $upd->execute([':rx' => $cashReceivedBy ?? $tx['employeeHandler'], ':id' => $transactionID]);
            return ['status' => 'paid', 'balanceDue' => 0.0];
        }

        return ['status' => 'pending', 'qr_token' => $tx['qr_token']];
    }

    public function extendTimedSession(string $transactionID, int $additionalHours): array {
        $stmt = $this->db->prepare("SELECT * FROM transactions WHERE transactionID = :id LIMIT 1");
        $stmt->execute([':id' => $transactionID]);
        $tx = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tx) {
            throw new Exception('Transaction not found.');
        }

        $hourlyRate = (float)($tx['hourlyRate'] ?? 0);
        $newSelling = round((float)$tx['transactionAmount'] + ($hourlyRate * $additionalHours), 2);
        $pricing = self::calculateDiscount($newSelling, (bool)$tx['discountApplied']);
        $balanceDue = round(max(0.0, $pricing['totalAmount'] - (float)$tx['amountPaid']), 2);
        $nextStatus = $balanceDue > 0 ? 'pending' : $tx['transactionStatus'];

        $upd = $this->db->prepare(
            "UPDATE transactions SET transactionAmount = :amt, discount = :disc, totalAmount = :total,
             balanceDue = :bal, transactionStatus = :st,
             timerDurationMinutes = COALESCE(timerDurationMinutes, 0) + :mins,
             timerEndsAt = DATE_ADD(GREATEST(NOW(), COALESCE(timerEndsAt, NOW())), INTERVAL :hrs HOUR),
             timerAcknowledged = 0, version = version + 1 WHERE transactionID = :id"
        );
        $upd->execute([
            ':amt' => $newSelling,
            ':disc' => $pricing['discount'],
            ':total' => $pricing['totalAmount'],
            ':bal' => $balanceDue,
            ':st' => $nextStatus,
            ':mins' => $additionalHours * 60,
            ':hrs' => $additionalHours,
            ':id' => $transactionID,
        ]);

        return ['totalAmount' => $pricing['totalAmount'], 'balanceDue' => $balanceDue];
    }
}
`;
  }
}

export const store = new CafeLupeStore();
