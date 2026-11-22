import React, { useState, useMemo } from 'react';
import {
  Outlet,
  PaymentArrangement,
  PaymentChannel,
  User,
  HostelRoomType,
  BilliardsPlace,
  KtvRoomChoice,
  KtvPackageType,
  ParkingVehicleType,
  GymServiceCategory,
  GymClientStatus,
} from '../../types';
import { store, calculateDiscountBreakdown, TIMED_OUTLET_SLUGS } from '../../db/store';
import { ChevronDown, Clock, Check } from 'lucide-react';

interface OutletTransactionFormProps {
  outlet: Outlet;
  user: User;
  onSuccess: (newTxId: string, channel: PaymentChannel, arrangement: PaymentArrangement) => void;
  onCancel: () => void;
}

const OUTLET_FORM_SUBTITLES: Record<string, string> = {
  pickleball: 'Hourly court rental (₱150/pax/hr) plus optional paddle & ball rentals',
  hostel: '12% VAT-inclusive room accommodations, no service charge',
  gym: 'Annual membership, monthly bundles, combat coaching & self-train sessions',
  pool: 'Complimentary for hotel guests; walk-ins ₱300 adult / ₱150 child',
  ktv: 'Rooms 1–4 with hourly billing (₱1,000/hr) or consumable packages',
  billiards: 'Hourly table rental with live session countdown timer',
  tabletennis: 'Upstairs ping-pong tables (₱250/hr) with live session timer',
  parking: '₱50 (4 wheels), ₱30 (2 wheels), free for checked-in hotel guests',
  events: 'Private functions, concerts and location shoots',
};

const HOSTEL_ROOM_RATES: Record<HostelRoomType, number> = {
  '2 Single Bed': 1680,
  'Queen Size Bed': 2800,
  'King Size Bed': 3136,
  'Suite Room - Overlooking': 4480,
};

const HOSTEL_AMENITIES = [
  'Swimming pool',
  'Billiards',
  'Table tennis',
  'Jacuzzi',
  'Sauna',
];

const KTV_PACKAGE_LABELS: Record<KtvPackageType, string> = {
  'Custom Hourly': 'Custom Hourly (₱1,000/hr)',
  'KTV 1 & 2 Package': 'KTV 1 & 2 - 3 hours (₱1,000/hr) + ₱5,000 consumable (10-15 pax)',
  'KTV Suite 4 Package': 'KTV Suite 4 - 3 hours (₱1,000/hr) + ₱15,000 consumable (20-25 pax)',
};

const GYM_ANNUAL_INCLUSIONS = [
  '1 Year Membership',
  'Free use of locker',
  'Can avail the monthly sessions',
  'Access of Swimming Pool',
];

const GYM_SESSION_INCLUSIONS = [
  'Coach/Trainer (1 hour)',
  'Circuit (Program by Coach)',
  'Free Use of Gym Equipment (After Training)',
  'Free use of Shower room',
  'Free Use of Locker',
];

type GymMonthlyOption = 'Monthly Unlimited' | '12 Sessions Boxing' | '12 Sessions Muay Thai';
type GymSessionProgram = 'Boxing' | 'Muay Thai';

function computeGymPricing(params: {
  category: GymServiceCategory;
  monthlyOption: GymMonthlyOption;
  sessionProgram: GymSessionProgram;
  clientStatus: GymClientStatus;
}): {
  price: number;
  planLabel: string;
  trainerProgram: string;
  inclusions: string[];
  serviceSummary: string;
} {
  const { category, monthlyOption, sessionProgram, clientStatus } = params;

  if (category === 'Annual Membership') {
    return {
      price: 1600,
      planLabel: 'Annual Membership',
      trainerProgram: 'Full Facility Access',
      inclusions: GYM_ANNUAL_INCLUSIONS,
      serviceSummary: 'Annual Membership (1 Year)',
    };
  }

  if (category === 'Monthly Package') {
    if (monthlyOption === 'Monthly Unlimited') {
      return {
        price: 3500,
        planLabel: 'Monthly Unlimited',
        trainerProgram: 'General Fitness Unlimited',
        inclusions: ['1 Month Unlimited Gym Access', 'Free use of locker'],
        serviceSummary: 'Monthly Package · Monthly Unlimited',
      };
    }
    if (monthlyOption === '12 Sessions Boxing') {
      return {
        price: 2000,
        planLabel: '12 Sessions Boxing (1 Month)',
        trainerProgram: 'Boxing',
        inclusions: GYM_SESSION_INCLUSIONS,
        serviceSummary: 'Monthly Package · 12 Sessions Boxing (1 Month)',
      };
    }
    return {
      price: 5000,
      planLabel: '12 Sessions Muay Thai (1 Month)',
      trainerProgram: 'Muay Thai',
      inclusions: GYM_SESSION_INCLUSIONS,
      serviceSummary: 'Monthly Package · 12 Sessions Muay Thai (1 Month)',
    };
  }

  if (category === 'Per-Session Training') {
    const isBoxing = sessionProgram === 'Boxing';
    const rateMap: Record<GymClientStatus, number> = isBoxing
      ? { Member: 200, 'Non-Member': 250, 'Student (Member)': 150, 'Student (Non-Member)': 200 }
      : { Member: 300, 'Non-Member': 400, 'Student (Member)': 300, 'Student (Non-Member)': 350 };
    return {
      price: rateMap[clientStatus],
      planLabel: `${sessionProgram} Session (${clientStatus})`,
      trainerProgram: sessionProgram,
      inclusions: GYM_SESSION_INCLUSIONS,
      serviceSummary: `Per-Session · ${sessionProgram} (${clientStatus})`,
    };
  }

  // Self-Train Session
  const selfRateMap: Record<GymClientStatus, number> = {
    Member: 100,
    'Non-Member': 150,
    'Student (Member)': 100,
    'Student (Non-Member)': 100,
  };
  return {
    price: selfRateMap[clientStatus],
    planLabel: `Self Train Session (${clientStatus})`,
    trainerProgram: 'Self Training',
    inclusions: ['Gym Floor Equipment Access', 'Free use of locker'],
    serviceSummary: `Self Train Session (${clientStatus})`,
  };
}

export const OutletTransactionForm: React.FC<OutletTransactionFormProps> = ({
  outlet,
  user,
  onSuccess,
  onCancel,
}) => {
  const eventPresets = outlet.slug === 'events' ? store.getServices(outlet.id) : [];

  const [customerName, setCustomerName] = useState('');
  const [discountApplied, setDiscountApplied] = useState<boolean>(false);
  const [paymentArrangement, setPaymentArrangement] = useState<PaymentArrangement>('Full Payment');
  const [downPaymentAmount, setDownPaymentAmount] = useState<number>(0);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('QRPh');
  const [cashReceivedBy, setCashReceivedBy] = useState<string>(user.name.split(' (')[0]);

  // Timed outlet countdown timer (minutes)
  const isTimedOutlet = TIMED_OUTLET_SLUGS.includes(outlet.slug);
  const [timerMinutes, setTimerMinutes] = useState<number>(outlet.slug === 'ktv' ? 180 : 60);

  // 1. Billiards
  const [billiardsPlace, setBilliardsPlace] = useState<BilliardsPlace>('Without Aircon (₱200/hr)');
  const [billiardsHours, setBilliardsHours] = useState<number>(1);

  // 2. Pickleball
  const [court, setCourt] = useState<'Al Fresco (Ground Floor)' | 'Indoor (2nd Floor)'>('Al Fresco (Ground Floor)');
  const [pax, setPax] = useState<number>(2);
  const [pickleHours, setPickleHours] = useState<number>(1);
  const [paddleRent, setPaddleRent] = useState<number>(2);
  const [ballRent, setBallRent] = useState<number>(1);

  // 3. Table Tennis
  const [ttTable, setTtTable] = useState<'Table 1' | 'Table 2' | 'Table 3'>('Table 1');
  const [ttHours, setTtHours] = useState<number>(1);

  // 4. Parking
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<ParkingVehicleType>('Car');
  const [customVehicleName, setCustomVehicleName] = useState<string>('');
  const [customWheels, setCustomWheels] = useState<2 | 4>(4);
  const [parkingType, setParkingType] = useState<'Day' | 'Night' | 'Overnight'>('Day');
  const [isCheckedInGuest, setIsCheckedInGuest] = useState<boolean>(false);

  // 5. KTV
  const [ktvRoom, setKtvRoom] = useState<KtvRoomChoice>('Room 1');
  const [ktvPackageType, setKtvPackageType] = useState<KtvPackageType>('KTV 1 & 2 Package');
  const [ktvPax, setKtvPax] = useState<number>(12);
  const [ktvHours, setKtvHours] = useState<number>(3);

  // 6. Swimming Pool
  const [poolGuestType, setPoolGuestType] = useState<'Walk-in' | 'Hotel Guest'>('Walk-in');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(1);
  const [visitDay, setVisitDay] = useState<string>('Wednesday');

  // 7. Hostel
  const [roomType, setRoomType] = useState<HostelRoomType>('2 Single Bed');
  const [bookingSource, setBookingSource] = useState<'Walk-in' | 'Agoda' | 'Traveloka'>('Walk-in');
  const [checkIn, setCheckIn] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checkOut, setCheckOut] = useState<string>(new Date(Date.now() + 86400_000).toISOString().split('T')[0]);
  const [amenities, setAmenities] = useState<string>('Swimming pool');

  // 8. Events (unchanged form behavior)
  const [selectedEventPresetId, setSelectedEventPresetId] = useState<string>(eventPresets[0]?.id || '');
  const [eventServiceName, setEventServiceName] = useState<string>(
    eventPresets[0]?.name || 'Pre-Christmas / Year-End Party Hall'
  );
  const [eventType, setEventType] = useState<string>('Pre-Christmas Party');
  const [eventDate, setEventDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [headcount, setHeadcount] = useState<number>(60);
  const [spaceReserved, setSpaceReserved] = useState<string>('Grand Function Terrace');
  const [eventsAmount, setEventsAmount] = useState<number>(eventPresets[0]?.defaultPrice || 25000);

  // 9. Gym (Optimal Cascaded Form)
  const [age, setAge] = useState<number>(24);
  const [membershipStart, setMembershipStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [gymCategory, setGymCategory] = useState<GymServiceCategory>('Per-Session Training');
  const [gymMonthlyOption, setGymMonthlyOption] = useState<GymMonthlyOption>('Monthly Unlimited');
  const [gymSessionProgram, setGymSessionProgram] = useState<GymSessionProgram>('Boxing');
  const [gymClientStatus, setGymClientStatus] = useState<GymClientStatus>('Member');

  const autoDateTime = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Compute hostel nights dynamically from check-in & check-out
  const numberOfNights = useMemo(() => {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
    return Math.max(1, Math.round((end - start) / 86400_000));
  }, [checkIn, checkOut]);

  // Gym Pricing Derivation
  const gymPricing = useMemo(
    () =>
      computeGymPricing({
        category: gymCategory,
        monthlyOption: gymMonthlyOption,
        sessionProgram: gymSessionProgram,
        clientStatus: gymClientStatus,
      }),
    [gymCategory, gymMonthlyOption, gymSessionProgram, gymClientStatus]
  );

  // Real-time Selling Price, Service Label, and Hourly Rate derivation
  const computed = useMemo(() => {
    switch (outlet.slug) {
      case 'billiards': {
        const hourlyRate = billiardsPlace.includes('400') ? 400 : 200;
        const hrs = Math.max(1, billiardsHours);
        return {
          sellingPrice: hourlyRate * hrs,
          hourlyRate,
          serviceLabel: `${billiardsPlace} · ${hrs} ${hrs === 1 ? 'Hour' : 'Hours'}`,
        };
      }
      case 'pickleball': {
        const p = Math.max(1, pax);
        const h = Math.max(1, pickleHours);
        const hourlyRate = 150 * p;
        const sellingPrice = hourlyRate * h + Math.max(0, paddleRent) * 100 + Math.max(0, ballRent) * 50;
        return {
          sellingPrice,
          hourlyRate,
          serviceLabel: `${court} · ${p} Pax · ${h}h (${paddleRent} Paddles, ${ballRent} Balls)`,
        };
      }
      case 'tabletennis': {
        const hourlyRate = 250;
        const hrs = Math.max(1, ttHours);
        return {
          sellingPrice: hourlyRate * hrs,
          hourlyRate,
          serviceLabel: `${ttTable} · ${hrs} ${hrs === 1 ? 'Hour' : 'Hours'} (₱250/hr)`,
        };
      }
      case 'parking': {
        const wheels: 2 | 4 =
          vehicleType === 'Others'
            ? customWheels
            : vehicleType === 'Motorcycle' || vehicleType === 'Tricycle'
            ? 2
            : 4;
        const fee = isCheckedInGuest ? 0 : wheels === 4 ? 50 : 30;
        const vehicleDisplay =
          vehicleType === 'Others' ? customVehicleName.trim() || 'Other Vehicle' : vehicleType;
        return {
          sellingPrice: fee,
          hourlyRate: null,
          wheels,
          serviceLabel: isCheckedInGuest
            ? `${vehicleDisplay} (${wheels} wheels) · Checked-in Guest (Free)`
            : `${vehicleDisplay} (${wheels} wheels) · ${parkingType} Parking`,
        };
      }
      case 'ktv': {
        const hrs = Math.max(1, ktvHours);
        const hourlyRate = 1000;
        const consumable =
          ktvPackageType === 'KTV 1 & 2 Package'
            ? 5000
            : ktvPackageType === 'KTV Suite 4 Package'
            ? 15000
            : 0;
        const sellingPrice = consumable + hourlyRate * hrs;
        return {
          sellingPrice,
          hourlyRate,
          consumable,
          serviceLabel: `${ktvRoom} · ${ktvPackageType} (${hrs}h · ${ktvPax} pax)`,
        };
      }
      case 'pool': {
        const sellingPrice =
          poolGuestType === 'Hotel Guest' ? 0 : Math.max(0, adults) * 300 + Math.max(0, children) * 150;
        return {
          sellingPrice,
          hourlyRate: null,
          serviceLabel:
            poolGuestType === 'Hotel Guest'
              ? 'Hotel Guest Pool Access (Complimentary)'
              : `Walk-in Pool (${adults} Adults, ${children} Children)`,
        };
      }
      case 'hostel': {
        const rate = HOSTEL_ROOM_RATES[roomType];
        const sellingPrice = rate * numberOfNights;
        return {
          sellingPrice,
          hourlyRate: null,
          rate,
          serviceLabel: `${roomType} · ${numberOfNights} ${numberOfNights === 1 ? 'Night' : 'Nights'} (${bookingSource})`,
        };
      }
      case 'gym': {
        return {
          sellingPrice: gymPricing.price,
          hourlyRate: null,
          serviceLabel: gymPricing.serviceSummary,
        };
      }
      case 'events': {
        return {
          sellingPrice: Math.max(0, eventsAmount),
          hourlyRate: null,
          serviceLabel: eventServiceName || eventType,
        };
      }
      default: {
        return {
          sellingPrice: Math.max(0, eventsAmount),
          hourlyRate: null,
          serviceLabel: `${outlet.name} Service`,
        };
      }
    }
  }, [
    outlet.slug,
    outlet.name,
    billiardsPlace,
    billiardsHours,
    court,
    pax,
    pickleHours,
    paddleRent,
    ballRent,
    ttTable,
    ttHours,
    vehicleType,
    customVehicleName,
    customWheels,
    parkingType,
    isCheckedInGuest,
    ktvRoom,
    ktvPackageType,
    ktvPax,
    ktvHours,
    poolGuestType,
    adults,
    children,
    roomType,
    numberOfNights,
    bookingSource,
    gymPricing,
    eventsAmount,
    eventServiceName,
    eventType,
  ]);

  const { discount, totalAmount } = calculateDiscountBreakdown(computed.sellingPrice, discountApplied);

  const clampedDownPayment =
    paymentArrangement === 'Down Payment'
      ? Math.min(totalAmount, Math.max(0, downPaymentAmount))
      : paymentChannel === 'Cash'
      ? totalAmount
      : 0;

  const balanceDue = Math.max(0, Math.round((totalAmount - clampedDownPayment) * 100) / 100);
  const willBePaidImmediately =
    totalAmount === 0 || (paymentChannel === 'Cash' && paymentArrangement === 'Full Payment');

  const handleApplyEventPreset = (presetId: string) => {
    setSelectedEventPresetId(presetId);
    const found = eventPresets.find((p) => p.id === presetId);
    if (!found) return;
    setEventServiceName(found.name);
    setEventsAmount(found.defaultPrice);
    if (found.presetFields?.eventType) setEventType(found.presetFields.eventType);
    if (found.presetFields?.headcount) setHeadcount(found.presetFields.headcount);
    if (found.presetFields?.spaceReserved) setSpaceReserved(found.presetFields.spaceReserved);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let childData: Record<string, any> = {};
    switch (outlet.slug) {
      case 'billiards':
        childData = {
          place: billiardsPlace,
          hourlyRate: computed.hourlyRate,
          hours: Math.max(1, billiardsHours),
        };
        break;
      case 'pickleball':
        childData = {
          court,
          pax: Math.max(1, pax),
          hours: Math.max(1, pickleHours),
          paddleRent: Math.max(0, paddleRent),
          ballRent: Math.max(0, ballRent),
        };
        break;
      case 'tabletennis':
        childData = {
          tableNo: ttTable,
          hourlyRate: 250,
          hours: Math.max(1, ttHours),
        };
        break;
      case 'parking':
        childData = {
          plateNumber: plateNumber.trim().toUpperCase() || 'UNREGISTERED',
          vehicleType,
          customVehicleName: vehicleType === 'Others' ? customVehicleName.trim() : undefined,
          wheelCount: (computed as any).wheels || 4,
          parkingType,
          isCheckedInGuest,
        };
        break;
      case 'ktv':
        childData = {
          room: ktvRoom,
          packageType: ktvPackageType,
          packageConsumable: (computed as any).consumable || 0,
          pax: Math.max(1, ktvPax),
          hours: Math.max(1, ktvHours),
          hourlyRate: 1000,
          package: KTV_PACKAGE_LABELS[ktvPackageType],
        };
        break;
      case 'pool':
        childData = {
          guestType: poolGuestType,
          adults: poolGuestType === 'Hotel Guest' ? adults : Math.max(0, adults),
          children: poolGuestType === 'Hotel Guest' ? children : Math.max(0, children),
          isHostelGuest: poolGuestType === 'Hotel Guest',
          visitDay,
        };
        break;
      case 'hostel':
        childData = {
          roomType,
          roomRatePerNight: (computed as any).rate || 1680,
          bookingSource,
          checkIn,
          checkOut,
          numberOfNights,
          amenities,
          vatIncluded: true,
        };
        break;
      case 'gym':
        childData = {
          age,
          membershipStart,
          serviceCategory: gymCategory,
          membershipType: gymClientStatus,
          plan: gymPricing.planLabel,
          clientStatus: gymClientStatus,
          trainerProgram: gymPricing.trainerProgram,
          inclusions: gymPricing.inclusions,
        };
        break;
      case 'events':
        childData = {
          eventType,
          eventDate,
          headcount,
          spaceReserved,
        };
        break;
      default:
        childData = { notes: `${outlet.name} entry` };
        break;
    }

    const createdTx = store.createTransaction({
      outletSlug: outlet.slug,
      outletName: outlet.name,
      outletService: computed.serviceLabel,
      customerName:
        outlet.slug === 'parking'
          ? plateNumber.trim().toUpperCase() || 'Walk-in Vehicle'
          : customerName.trim() || 'Walk-in Guest',
      employeeHandler: user.name,
      employeeId: user.id,
      cashReceivedBy: paymentChannel === 'Cash' ? cashReceivedBy.trim() || user.name : null,
      transactionAmount: computed.sellingPrice,
      discountApplied,
      paymentArrangement,
      paymentChannel,
      downPaymentAmount: paymentArrangement === 'Down Payment' ? clampedDownPayment : undefined,
      hourlyRate: computed.hourlyRate,
      timerDurationMinutes: isTimedOutlet ? Math.max(1, timerMinutes) : null,
      childTableData: childData,
    });

    onSuccess(createdTx.transactionID, paymentChannel, paymentArrangement);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Page Title Row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
            Create transaction
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {OUTLET_FORM_SUBTITLES[outlet.slug] || `New ${outlet.name} transaction`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors cursor-pointer min-h-[40px]"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Card: Transaction details */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-gray-200/90 space-y-5">
          <h2 className="text-sm font-bold text-[#1A1A1A]">Transaction details</h2>

          {/* Events-only Preset Dropdown (Forms remain unchanged for Events) */}
          {outlet.slug === 'events' && eventPresets.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Preset service
              </label>
              <div className="relative">
                <select
                  value={selectedEventPresetId}
                  onChange={(e) => handleApplyEventPreset(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium text-[#1A1A1A] bg-white appearance-none pr-9 focus:border-[#1A1A1A] outline-none cursor-pointer"
                >
                  {eventPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₱{p.defaultPrice.toLocaleString()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Row 1: Customer Name or Plate Number + Primary Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {outlet.slug === 'parking' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Vehicle plate number *
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono text-[#1A1A1A] uppercase outline-none focus:border-[#1A1A1A]"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Customer name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Maria Santos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  required
                />
              </div>
            )}

            {/* Outlet-Specific Primary Selector */}
            {outlet.slug === 'billiards' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Place</label>
                <select
                  value={billiardsPlace}
                  onChange={(e) => setBilliardsPlace(e.target.value as BilliardsPlace)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Without Aircon (₱200/hr)">200 per hour (without aircon)</option>
                  <option value="With Aircon (₱400/hr)">400 per hour (with aircon)</option>
                </select>
              </div>
            )}

            {outlet.slug === 'pickleball' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Court</label>
                <select
                  value={court}
                  onChange={(e) => setCourt(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Al Fresco (Ground Floor)">Al fresco · Ground floor</option>
                  <option value="Indoor (2nd Floor)">Indoor · 2nd floor</option>
                </select>
              </div>
            )}

            {outlet.slug === 'tabletennis' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Table</label>
                <select
                  value={ttTable}
                  onChange={(e) => setTtTable(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Table 1">Table 1 (₱250/hr)</option>
                  <option value="Table 2">Table 2 (₱250/hr)</option>
                  <option value="Table 3">Table 3 (₱250/hr)</option>
                </select>
              </div>
            )}

            {outlet.slug === 'parking' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vehicle type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as ParkingVehicleType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Car">Car (4 wheels · ₱50)</option>
                  <option value="Van">Van (4 wheels · ₱50)</option>
                  <option value="Truck">Truck (4 wheels · ₱50)</option>
                  <option value="Tricycle">Tricycle (2 wheels · ₱30)</option>
                  <option value="Motorcycle">Motorcycle (2 wheels · ₱30)</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            )}

            {outlet.slug === 'ktv' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Room</label>
                <select
                  value={ktvRoom}
                  onChange={(e) => setKtvRoom(e.target.value as KtvRoomChoice)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Room 1">Room 1</option>
                  <option value="Room 2">Room 2</option>
                  <option value="Room 3">Room 3</option>
                  <option value="Room 4">Room 4</option>
                </select>
              </div>
            )}

            {outlet.slug === 'pool' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Guest type</label>
                <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                  {(['Walk-in', 'Hotel Guest'] as const).map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setPoolGuestType(gt)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        poolGuestType === gt ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      {gt === 'Hotel Guest' ? 'Hotel guest (free)' : 'Walk-in'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {outlet.slug === 'hostel' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Room type</label>
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value as HostelRoomType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="2 Single Bed">2 Single Bed (₱1,680 / night)</option>
                  <option value="Queen Size Bed">Queen Size Bed (₱2,800 / night)</option>
                  <option value="King Size Bed">King Size Bed (₱3,136 / night)</option>
                  <option value="Suite Room - Overlooking">Suite Room - Overlooking (₱4,480 / night)</option>
                </select>
              </div>
            )}

            {outlet.slug === 'gym' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Age</label>
                <input
                  type="number"
                  min="10"
                  max="95"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] tabular-nums outline-none"
                />
              </div>
            )}

            {outlet.slug === 'events' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Event type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="Corporate Event">Corporate event</option>
                  <option value="Pre-Christmas Party">Pre-Christmas party</option>
                  <option value="Concert">Concert</option>
                  <option value="TV Show Location">TV show location</option>
                  <option value="Indie Film Shoot">Indie film shoot</option>
                  <option value="Commercial Shoot">Commercial shoot</option>
                </select>
              </div>
            )}
          </div>

          {/* Outlet-Specific Rows */}
          {outlet.slug === 'billiards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Hours</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={billiardsHours}
                  onChange={(e) => {
                    const h = Math.max(1, Number(e.target.value));
                    setBilliardsHours(h);
                    setTimerMinutes(h * 60);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Countdown timer (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono font-bold tabular-nums"
                />
              </div>
            </div>
          )}

          {outlet.slug === 'pickleball' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Pax (₱150/hr)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={pax}
                    onChange={(e) => setPax(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={pickleHours}
                    onChange={(e) => {
                      const h = Math.max(1, Number(e.target.value));
                      setPickleHours(h);
                      setTimerMinutes(h * 60);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Paddle rent (₱100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paddleRent}
                    onChange={(e) => setPaddleRent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Ball rent (₱50)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ballRent}
                    onChange={(e) => setBallRent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="sm:w-1/2">
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Countdown timer (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold tabular-nums"
                />
              </div>
            </div>
          )}

          {outlet.slug === 'tabletennis' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Hours (₱250/hr)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={ttHours}
                  onChange={(e) => {
                    const h = Math.max(1, Number(e.target.value));
                    setTtHours(h);
                    setTimerMinutes(h * 60);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Countdown timer (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono font-bold tabular-nums"
                />
              </div>
            </div>
          )}

          {outlet.slug === 'parking' && (
            <div className="space-y-4">
              {vehicleType === 'Others' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F7F7] border border-gray-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Vehicle name *
                    </label>
                    <input
                      type="text"
                      value={customVehicleName}
                      onChange={(e) => setCustomVehicleName(e.target.value)}
                      placeholder="e.g. Electric Trike / ATV"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs text-[#1A1A1A] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Number of wheels
                    </label>
                    <select
                      value={customWheels}
                      onChange={(e) => setCustomWheels(Number(e.target.value) === 2 ? 2 : 4)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs text-[#1A1A1A] outline-none"
                    >
                      <option value={2}>2 Wheels (₱30)</option>
                      <option value={4}>4 Wheels (₱50)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Parking type</label>
                  <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                    {(['Day', 'Night', 'Overnight'] as const).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setParkingType(pt)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          parkingType === pt ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Client status</label>
                  <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setIsCheckedInGuest(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        !isCheckedInGuest ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      Outsider
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCheckedInGuest(true)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        isCheckedInGuest ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      Checked in (₱0.00)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {outlet.slug === 'ktv' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Package</label>
                <select
                  value={ktvPackageType}
                  onChange={(e) => {
                    const pkg = e.target.value as KtvPackageType;
                    setKtvPackageType(pkg);
                    if (pkg === 'KTV 1 & 2 Package') {
                      setKtvHours(3);
                      setKtvPax(12);
                      setTimerMinutes(180);
                    } else if (pkg === 'KTV Suite 4 Package') {
                      setKtvHours(3);
                      setKtvPax(22);
                      setTimerMinutes(180);
                    } else {
                      setKtvHours(1);
                      setTimerMinutes(60);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] bg-white outline-none"
                >
                  <option value="KTV 1 & 2 Package">
                    KTV 1 &amp; 2 - 3 hours (1000 pesos per hour) + 5000 pesos consumable 10-15 pax
                  </option>
                  <option value="KTV Suite 4 Package">
                    KTV suite 4 - 3 hours (1000 pesos per hour) + 15000 consumable 20-25 pax
                  </option>
                  <option value="Custom Hourly">Custom hourly reservation (₱1,000/hr)</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pax</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={ktvPax}
                    onChange={(e) => setKtvPax(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Hours (₱1,000/hr)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={ktvHours}
                    onChange={(e) => {
                      const h = Math.max(1, Number(e.target.value));
                      setKtvHours(h);
                      setTimerMinutes(h * 60);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Timer (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {outlet.slug === 'pool' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Adults (₱300/head)</label>
                <input
                  type="number"
                  min="0"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Children (₱150/head)</label>
                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Visit day</label>
                <select
                  value={visitDay}
                  onChange={(e) => setVisitDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Weekend (Hotel Guest)">Weekend (Hotel Guest)</option>
                </select>
              </div>
            </div>
          )}

          {outlet.slug === 'hostel' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Booking source</label>
                  <select
                    value={bookingSource}
                    onChange={(e) => setBookingSource(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                  >
                    <option value="Walk-in">Walk in</option>
                    <option value="Agoda">Agoda</option>
                    <option value="Traveloka">Traveloka</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Check-in date</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Check-out date</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Amenities (customer record only, ₱0 impact)
                  </label>
                  <select
                    value={amenities}
                    onChange={(e) => setAmenities(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                  >
                    {HOSTEL_AMENITIES.map((am) => (
                      <option key={am} value={am}>
                        {am}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#F7F7F7] border border-gray-200 text-[11px] text-gray-600 flex items-center justify-between">
                  <span>{numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'} · Inclusive of 12% VAT</span>
                  <span className="font-bold text-[#1A1A1A]">No service charge</span>
                </div>
              </div>
            </div>
          )}

          {outlet.slug === 'gym' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Service category</label>
                  <select
                    value={gymCategory}
                    onChange={(e) => setGymCategory(e.target.value as GymServiceCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white font-semibold"
                  >
                    <option value="Annual Membership">Annual Membership (₱1,600)</option>
                    <option value="Monthly Package">Monthly Packages</option>
                    <option value="Per-Session Training">Per-Session Training</option>
                    <option value="Self-Train Session">Self Train Session</option>
                  </select>
                </div>

                {gymCategory === 'Monthly Package' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly package</label>
                    <select
                      value={gymMonthlyOption}
                      onChange={(e) => setGymMonthlyOption(e.target.value as GymMonthlyOption)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                    >
                      <option value="Monthly Unlimited">Monthly Unlimited (₱3,500)</option>
                      <option value="12 Sessions Boxing">12 Sessions Boxing (₱2,000)</option>
                      <option value="12 Sessions Muay Thai">12 Sessions Muay Thai (₱5,000)</option>
                    </select>
                  </div>
                )}

                {gymCategory === 'Per-Session Training' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Combat program</label>
                    <select
                      value={gymSessionProgram}
                      onChange={(e) => setGymSessionProgram(e.target.value as GymSessionProgram)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                    >
                      <option value="Boxing">Boxing Session</option>
                      <option value="Muay Thai">Muay Thai Session</option>
                    </select>
                  </div>
                )}

                {(gymCategory === 'Per-Session Training' || gymCategory === 'Self-Train Session') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Client status</label>
                    <select
                      value={gymClientStatus}
                      onChange={(e) => setGymClientStatus(e.target.value as GymClientStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white"
                    >
                      <option value="Member">Member</option>
                      <option value="Non-Member">Non-Member</option>
                      <option value="Student (Member)">Student (Member)</option>
                      {gymCategory === 'Per-Session Training' && (
                        <option value="Student (Non-Member)">Student (Non-Member)</option>
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Membership start</label>
                  <input
                    type="date"
                    value={membershipStart}
                    onChange={(e) => setMembershipStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
              </div>

              {/* Inclusions Readout */}
              <div className="p-3.5 rounded-xl bg-[#F7F7F7] border border-gray-200/80">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Included in {gymPricing.planLabel}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {gymPricing.inclusions.map((inc) => (
                    <span key={inc} className="inline-flex items-center gap-1 text-xs text-[#1A1A1A] font-medium">
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      {inc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {outlet.slug === 'events' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Event date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Headcount</label>
                <input
                  type="number"
                  min="1"
                  value={headcount}
                  onChange={(e) => setHeadcount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Space reserved</label>
                <input
                  type="text"
                  value={spaceReserved}
                  onChange={(e) => setSpaceReserved(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                />
              </div>
            </div>
          )}

          {/* Universal Discount (Yes / No) + Payment Arrangement (Full / Down Payment) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Discount (20% SC/PWD · ÷ 1.12 × 0.80)
              </label>
              <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDiscountApplied(false)}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    !discountApplied ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountApplied(true)}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    discountApplied ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Payment arrangement
              </label>
              <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 w-full sm:w-auto">
                {(['Full Payment', 'Down Payment'] as const).map((arr) => (
                  <button
                    key={arr}
                    type="button"
                    onClick={() => {
                      setPaymentArrangement(arr);
                      if (arr === 'Down Payment' && downPaymentAmount === 0 && totalAmount > 0) {
                        setDownPaymentAmount(Math.round(totalAmount * 0.5));
                      }
                    }}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      paymentArrangement === arr ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                    }`}
                  >
                    {arr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Down Payment Custom Amount Input */}
          {paymentArrangement === 'Down Payment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F7F7F7] border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Down payment amount (₱) *
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  step="any"
                  value={downPaymentAmount}
                  onChange={(e) => setDownPaymentAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-[#1A1A1A] tabular-nums outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Remaining balance due
                </label>
                <div className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-extrabold text-[#1A1A1A] tabular-nums">
                  ₱{balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Payment Channel & Cash Received By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Payment channel
              </label>
              <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPaymentChannel('QRPh')}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    paymentChannel === 'QRPh' ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  QR Ph
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentChannel('Cash')}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    paymentChannel === 'Cash' ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Cash
                </button>
              </div>
            </div>

            {paymentChannel === 'Cash' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Payment cash received by *
                </label>
                <input
                  type="text"
                  value={cashReceivedBy}
                  onChange={(e) => setCashReceivedBy(e.target.value)}
                  placeholder="Staff full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Date &amp; time (auto)
                </label>
                <input
                  type="text"
                  value={autoDateTime}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600 cursor-default"
                />
              </div>
            )}
          </div>

          {/* Read-only Date/Time & Price row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {paymentChannel === 'Cash' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Date &amp; time (auto)
                </label>
                <input
                  type="text"
                  value={autoDateTime}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600 cursor-default"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {outlet.slug === 'events' ? 'Selling price (₱)' : 'Calculated selling price (₱)'}
              </label>
              {outlet.slug === 'events' || outlet.slug === 'custom' ? (
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={eventsAmount}
                  onChange={(e) => setEventsAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-[#1A1A1A] tabular-nums outline-none focus:border-[#1A1A1A]"
                  required
                />
              ) : (
                <input
                  type="text"
                  value={`₱${computed.sellingPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-[#1A1A1A] tabular-nums cursor-default"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Real-time Summary */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-gray-200/90 space-y-4">
          <h2 className="text-sm font-bold text-[#1A1A1A]">Summary</h2>

          <div className="space-y-2.5 text-xs pt-1 border-b border-gray-100 pb-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-gray-600 leading-snug">{computed.serviceLabel}</span>
              <span className="font-semibold text-[#1A1A1A] tabular-nums shrink-0">
                ₱{computed.sellingPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Discount ({discountApplied ? 'Yes · VAT-exempt 20%' : 'No'})</span>
              <span className="font-semibold text-[#1A1A1A] tabular-nums">
                -₱{discount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {paymentArrangement === 'Down Payment' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Down payment</span>
                  <span className="font-semibold text-[#1A1A1A] tabular-nums">
                    ₱{clampedDownPayment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Balance due</span>
                  <span className="font-bold text-[#FF5252] tabular-nums">
                    ₱{balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Handler</span>
              <span className="font-medium text-gray-800 truncate max-w-[140px]">
                {user.name.split(' (')[0]}
              </span>
            </div>
            {paymentChannel === 'Cash' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Cash received by</span>
                <span className="font-medium text-gray-800 truncate max-w-[140px]">
                  {cashReceivedBy || '—'}
                </span>
              </div>
            )}
            {isTimedOutlet && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Session timer</span>
                <span className="font-mono font-bold text-[#1A1A1A] tabular-nums">
                  {timerMinutes} mins
                </span>
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4 bg-[#FFE27A] text-[#1A1A1A]">
            <div className="text-xs font-semibold text-[#1A1A1A]/75">Total payable</div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-0.5">
              ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-semibold text-[#1A1A1A]/75 mt-1">
              {willBePaidImmediately
                ? 'Marked Paid on save'
                : paymentArrangement === 'Down Payment'
                ? 'Initial down payment prompt opens on save'
                : 'Marked Pending until scanned'}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
          >
            Save transaction
          </button>

          <p className="text-[11px] text-gray-500 leading-relaxed text-center">
            {isTimedOutlet
              ? 'Session countdown timer starts immediately upon confirmation.'
              : 'QR Ph generates a scannable slip; Cash logs receiver for audit.'}
          </p>
        </div>
      </form>
    </div>
  );
};
