import React, { useState, useMemo } from 'react';
import {
  User,
  PosOrderItem,
  PosMenuItem,
  PosMenuVariant,
  PaymentChannel,
  MasterTransaction,
  FnbTransaction,
} from '../../types';
import { store, calculateFnbScPwdDiscount } from '../../db/store';
import { INITIAL_POS_ITEMS } from '../../db/initialData';
import { QrPhModal } from '../common/QrPhModal';
import { Plus, Minus, Search } from 'lucide-react';

interface PosTerminalProps {
  user: User;
  onTransactionCreated: () => void;
  onBackToFnb: () => void;
}

const FOOD_CATEGORIES = [
  'All Day Breakfast',
  'Appetizer',
  'Pasta',
  'Main Course',
  'Mexican',
  'Pizza',
];

const DRINKS_CATEGORIES = [
  'Beers',
  'Cocktails',
  'Coffee | Chocolate | Tea',
  'Frappes',
  'Soft Drinks',
  'Shakes | Refreshers',
  'Others',
];

function getCartKey(itemId: string, variant?: string): string {
  return variant ? `${itemId}__${variant}` : itemId;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  user,
  onTransactionCreated,
  onBackToFnb,
}) => {
  const [sectionFilter, setSectionFilter] = useState<'All' | 'Food' | 'Drinks'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [variantItem, setVariantItem] = useState<PosMenuItem | null>(null);

  const [cart, setCart] = useState<PosOrderItem[]>([]);
  const [auditedTo, setAuditedTo] = useState<'Walk-in Client' | 'Function Guest' | 'KTV Room User'>('Walk-in Client');
  const [tableOrRoomNo, setTableOrRoomNo] = useState<string>('Table 4');
  const [customerName, setCustomerName] = useState<string>('');

  // Revision 002 F&B POS Payment Controls (Strictly Upfront Full Payment + SC/PWD Pax/IDs)
  const [discountApplied, setDiscountApplied] = useState<boolean>(false);
  const [totalPax, setTotalPax] = useState<number>(1);
  const [validIdCount, setValidIdCount] = useState<number>(1);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('Cash');
  const [cashReceivedBy, setCashReceivedBy] = useState<string>(user.name.split(' (')[0]);

  const [placedOrder, setPlacedOrder] = useState<{
    tx: MasterTransaction;
    fnb: FnbTransaction;
    orderNum: string;
  } | null>(null);
  const [showKitchenReceipt, setShowKitchenReceipt] = useState(false);
  const [activeQrTx, setActiveQrTx] = useState<MasterTransaction | null>(null);

  const nextOrderNumber = 1040 + store.getTransactions('fnb').length;

  const availableCategories = useMemo(() => {
    if (sectionFilter === 'Food') return ['All', ...FOOD_CATEGORIES];
    if (sectionFilter === 'Drinks') return ['All', ...DRINKS_CATEGORIES];
    return ['All', ...FOOD_CATEGORIES, ...DRINKS_CATEGORIES];
  }, [sectionFilter]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return INITIAL_POS_ITEMS.filter((item) => {
      const matchesSection = sectionFilter === 'All' || item.section === sectionFilter;
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesSection && matchesCategory && matchesSearch;
    });
  }, [sectionFilter, selectedCategory, searchQuery]);

  const addItemWithVariant = (item: PosMenuItem, chosenVariant?: PosMenuVariant) => {
    const unitPrice = chosenVariant ? chosenVariant.price : item.price;
    const variantLabel = chosenVariant?.label;
    const targetKey = getCartKey(item.id, variantLabel);

    setCart((prev) => {
      const existing = prev.find((i) => getCartKey(i.itemId, i.variant) === targetKey);
      if (existing) {
        return prev.map((i) =>
          getCartKey(i.itemId, i.variant) === targetKey
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
            : i
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          variant: variantLabel,
          price: unitPrice,
          quantity: 1,
          subtotal: unitPrice,
        },
      ];
    });
    setVariantItem(null);
  };

  const handleMenuClick = (item: PosMenuItem) => {
    if (item.variants && item.variants.length > 0) {
      setVariantItem(item);
      return;
    }
    addItemWithVariant(item);
  };

  const updateQuantity = (itemId: string, variant: string | undefined, delta: number) => {
    const targetKey = getCartKey(itemId, variant);
    setCart((prev) =>
      prev
        .map((i) => {
          if (getCartKey(i.itemId, i.variant) !== targetKey) return i;
          const newQ = i.quantity + delta;
          return { ...i, quantity: newQ, subtotal: newQ * i.price };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const sellingSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const { discount, totalAmount, clampedPax, clampedIds } = calculateFnbScPwdDiscount(
    sellingSubtotal,
    discountApplied,
    totalPax,
    validIdCount
  );

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;

    const serviceSummary = cart
      .map((i) => `${i.quantity}× ${i.name}${i.variant ? ` (${i.variant})` : ''}`)
      .join(', ')
      .slice(0, 96);

    const childData = {
      auditedTo,
      orderItems: cart,
      tableOrRoomNo,
      totalPax: clampedPax,
      validIdCount: discountApplied ? clampedIds : 0,
      receiptPrintedAt: new Date().toISOString(),
    };

    const newTx = store.createTransaction({
      outletSlug: 'fnb',
      outletName: 'Restaurant / Food & Beverage',
      outletService: serviceSummary,
      customerName:
        customerName.trim() ||
        `${tableOrRoomNo} (${auditedTo === 'Walk-in Client' ? 'Walk in' : auditedTo === 'Function Guest' ? 'Function' : 'KTV'})`,
      employeeHandler: user.name,
      employeeId: user.id,
      cashReceivedBy: paymentChannel === 'Cash' ? cashReceivedBy.trim() || user.name : null,
      transactionAmount: sellingSubtotal,
      discountApplied,
      paymentArrangement: 'Full Payment',
      paymentChannel,
      childTableData: childData,
    });

    const fnbChild = store.getOutletChildData('fnb_transactions', newTx.outletRefId);

    onTransactionCreated();
    setCart([]);
    setDiscountApplied(false);
    setTotalPax(1);
    setValidIdCount(1);
    setPlacedOrder({ tx: newTx, fnb: fnbChild, orderNum: `#${nextOrderNumber}` });

    if (paymentChannel === 'QRPh') {
      setActiveQrTx(newTx);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">Cafe Lupe POS</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Order #{nextOrderNumber} · syncs to F&amp;B and central database instantly
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToFnb}
          className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors cursor-pointer min-h-[40px]"
        >
          Back to F&amp;B
        </button>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Section + Category Bar + Menu Grid */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl p-5 border border-gray-200/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-1 self-start">
              {(['All', 'Food', 'Drinks'] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setSectionFilter(sec);
                    setSelectedCategory('All');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    sectionFilter === sec ? 'bg-[#FFE27A] text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  {sec === 'All' ? 'All Menu' : sec === 'Food' ? 'Cafe Lupe Menu' : 'Cafe Lupe Drinks'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu item..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A] w-full sm:w-52"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : 'bg-[#F7F7F7] text-gray-600 border-gray-200 hover:text-[#1A1A1A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const totalInCart = cart
                .filter((c) => c.itemId === item.id)
                .reduce((acc, c) => acc + c.quantity, 0);
              const priceLabel = item.variants
                ? `₱${Math.min(...item.variants.map((v) => v.price)).toLocaleString()}+`
                : `₱${item.price.toLocaleString()}`;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMenuClick(item)}
                  className="text-left p-3.5 rounded-2xl bg-[#F7F7F7]/80 hover:bg-[#FFE27A]/35 border border-gray-200/90 hover:border-[#1A1A1A]/30 transition-all cursor-pointer flex flex-col justify-between min-h-[100px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#1A1A1A] leading-snug block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">{item.category}</span>
                    </div>
                    {totalInCart > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#FFE27A] text-[#1A1A1A] text-[10px] font-extrabold tabular-nums shrink-0">
                        {totalInCart}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <span className="text-sm font-extrabold text-[#1A1A1A] tabular-nums">
                      {priceLabel}
                    </span>
                    {item.variants && (
                      <span className="text-[10px] font-semibold text-gray-500">
                        {item.variants.length} options
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Order Panel */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl p-5 border border-gray-200/90 space-y-4">
          <div className="text-sm font-bold text-[#1A1A1A]">Order #{nextOrderNumber}</div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Audit to</label>
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              {(['Walk-in Client', 'Function Guest', 'KTV Room User'] as const).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setAuditedTo(target)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    auditedTo === target ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  {target === 'Walk-in Client' ? 'Walk in' : target === 'Function Guest' ? 'Function' : 'KTV room'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Table / room</label>
              <input
                type="text"
                value={tableOrRoomNo}
                onChange={(e) => setTableOrRoomNo(e.target.value)}
                placeholder="Table 4"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Customer (optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest name"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
              />
            </div>
          </div>

          {/* Cart Items */}
          <div className="border-t border-b border-gray-100 py-3 space-y-2.5 max-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-5 text-center text-xs text-gray-400">
                Select menu items on the left to build this order.
              </div>
            ) : (
              cart.map((item) => {
                const key = getCartKey(item.itemId, item.variant);
                return (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="inline-flex items-center border border-gray-200 rounded-lg bg-gray-50 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.itemId, item.variant, -1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] cursor-pointer"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.itemId, item.variant, 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] cursor-pointer"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-medium text-[#1A1A1A] truncate">
                        {item.name}
                        {item.variant ? ` (${item.variant})` : ''}
                      </span>
                    </div>
                    <span className="font-bold text-[#1A1A1A] tabular-nums shrink-0">
                      ₱{item.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Discount & Payment Controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Discount (20% SC/PWD)
              </label>
              <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setDiscountApplied(false)}
                  className={`flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    !discountApplied ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountApplied(true);
                    if (validIdCount < 1) setValidIdCount(1);
                  }}
                  className={`flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    discountApplied ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Payment channel
              </label>
              <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                {(['Cash', 'QRPh'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPaymentChannel(ch)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      paymentChannel === ch ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                    }`}
                  >
                    {ch === 'QRPh' ? 'QR Ph' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {discountApplied && (
            <div className="p-3 rounded-xl bg-[#F7F7F7] border border-gray-200 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Total pax *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={totalPax}
                    onChange={(e) => {
                      const nextPax = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setTotalPax(nextPax);
                      if (validIdCount > nextPax) setValidIdCount(nextPax);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Valid SC/PWD IDs *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={clampedPax}
                    value={validIdCount}
                    onChange={(e) =>
                      setValidIdCount(
                        Math.min(clampedPax, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-bold tabular-nums"
                  />
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                Formula: ((₱{sellingSubtotal.toFixed(2)} ÷ 1.12) ÷ {clampedPax} pax × {clampedIds}{' '}
                {clampedIds === 1 ? 'ID' : 'IDs'}) × 0.20 = -₱{discount.toFixed(2)}
              </div>
            </div>
          )}

          {paymentChannel === 'Cash' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Payment cash received by *
              </label>
              <input
                type="text"
                value={cashReceivedBy}
                onChange={(e) => setCashReceivedBy(e.target.value)}
                placeholder="Staff name"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
              />
            </div>
          )}

          {/* #FFE27A Total Box */}
          <div className="rounded-2xl p-4 bg-[#FFE27A] text-[#1A1A1A]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1A1A1A]/75">
              <span>Total payable (Upfront Full Payment)</span>
              {discountApplied && (
                <span className="tabular-nums">Discount: -₱{discount.toFixed(2)}</span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-0.5">
              ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-semibold text-[#1A1A1A]/75 mt-1 tabular-nums">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
              {discountApplied ? ` · ${clampedIds}/${clampedPax} SC/PWD pax` : ''}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={cart.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              Place order
            </button>
            <button
              type="button"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 min-h-[40px]"
            >
              Clear order
            </button>
          </div>
        </div>
      </div>

      {/* Variant Selector Modal */}
      {variantItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1A1A]">{variantItem.name}</h3>
                <p className="text-xs text-gray-500">{variantItem.category} · Select option</p>
              </div>
              <button
                type="button"
                onClick={() => setVariantItem(null)}
                className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {variantItem.variants?.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => addItemWithVariant(variantItem, v)}
                  className="w-full px-4 py-3 rounded-xl bg-[#F7F7F7] hover:bg-[#FFE27A] border border-gray-200 flex items-center justify-between text-xs font-bold text-[#1A1A1A] cursor-pointer transition-colors"
                >
                  <span>{v.label}</span>
                  <span className="tabular-nums">₱{v.price.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order Placed Confirmation Modal */}
      {placedOrder && !showKitchenReceipt && !activeQrTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 border border-gray-200 shadow-2xl text-center">
            <div className="text-xs font-semibold text-gray-500">Order placed</div>
            <div className="text-2xl font-extrabold text-[#1A1A1A] tabular-nums mt-1">
              {placedOrder.orderNum} · ₱
              {placedOrder.tx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1.5 mb-6">
              Synced to central database ({placedOrder.tx.transactionID})
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPlacedOrder(null)}
                className="py-2.5 px-3 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 cursor-pointer min-h-[42px]"
              >
                New order
              </button>
              <button
                type="button"
                onClick={() => setShowKitchenReceipt(true)}
                className="py-2.5 px-3 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs cursor-pointer min-h-[42px]"
              >
                Print kitchen receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kitchen Receipt Modal */}
      {placedOrder && showKitchenReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl">
            <div className="text-center pb-4 border-b border-dashed border-gray-300">
              <div className="text-xs font-bold tracking-widest uppercase text-[#1A1A1A]">
                KITCHEN RECEIPT
              </div>
              <div className="text-xs text-gray-500 mt-1 font-mono">
                Order {placedOrder.orderNum} · {placedOrder.fnb?.auditedTo || 'Walk in'} ·{' '}
                {new Date(placedOrder.tx.transactionDateTime).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {placedOrder.fnb?.tableOrRoomNo || 'Table 4'} · {placedOrder.tx.transactionID}
              </div>
            </div>

            <div className="py-4 space-y-2 font-mono text-xs text-[#1A1A1A] border-b border-dashed border-gray-300">
              {(placedOrder.fnb?.orderItems || []).map((item, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span>
                    {item.quantity} × {item.name}
                    {item.variant ? ` (${item.variant})` : ''}
                  </span>
                  <span className="tabular-nums shrink-0">₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              {placedOrder.tx.discountApplied && (
                <div className="flex justify-between text-gray-600">
                  <span>20% SC/PWD DISCOUNT</span>
                  <span className="tabular-nums">-₱{placedOrder.tx.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                <span>TOTAL PAYABLE</span>
                <span className="tabular-nums">₱{placedOrder.tx.totalAmount.toFixed(2)}</span>
              </div>
              {placedOrder.tx.balanceDue > 0 && (
                <div className="flex justify-between text-[#FF5252] font-bold">
                  <span>BALANCE DUE</span>
                  <span className="tabular-nums">₱{placedOrder.tx.balanceDue.toFixed(2)}</span>
                </div>
              )}
              {placedOrder.tx.cashReceivedBy && (
                <div className="text-[11px] text-gray-500 pt-1">
                  Cash Received By: {placedOrder.tx.cashReceivedBy}
                </div>
              )}
            </div>

            <div className="pt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 cursor-pointer min-h-[42px]"
              >
                Print slip
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowKitchenReceipt(false);
                  setPlacedOrder(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs cursor-pointer min-h-[42px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Ph Modal if QR Ph channel selected */}
      {activeQrTx && (
        <QrPhModal
          transaction={activeQrTx}
          onClose={() => setActiveQrTx(null)}
          onSuccess={() => onTransactionCreated()}
        />
      )}
    </div>
  );
};
