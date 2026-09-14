import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const ACTIVE_STATUSES = new Set(['placed', 'preparing', 'ready']);
const BILLABLE_STATUSES = new Set(['completed', 'delivered', 'served']);

const STATUS_LABELS = {
  placed: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Served',
  delivered: 'Served',
  served: 'Served',
  cancelled: 'Cancelled',
};

const STATUS_ORDER = ['placed', 'preparing', 'ready', 'completed'];

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status) {
  switch (status) {
    case 'placed':
      return 'new';
    case 'preparing':
      return 'preparing';
    case 'ready':
      return 'ready';
    case 'completed':
    case 'delivered':
    case 'served':
      return 'completed';
    default:
      return 'neutral';
  }
}

function nextStatus(status) {
  const index = STATUS_ORDER.indexOf(status);
  if (index < 0 || index >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[index + 1];
}

function normalizeOrders(list) {
  if (!Array.isArray(list)) return [];

  return list.map((order) => ({
    ...order,
    order_id: order.order_id ?? order.id,
    table_number: Number(order.table_number),
    items: Array.isArray(order.items) ? order.items : [],
  }));
}

export default function StaffDashboard({ restaurantId }) {
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);

  const [selectedTableNumber, setSelectedTableNumber] = useState(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [placingOrder, setPlacingOrder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [restaurantRes, tablesRes, menuRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/restaurants/${restaurantId}`),
        fetch(`${API_BASE}/tables/${restaurantId}`),
        fetch(`${API_BASE}/menu/${restaurantId}`),
        fetch(`${API_BASE}/bills/restaurant/${restaurantId}/unbilled-orders`),
      ]);

      const [restaurantData, tablesData, menuData, ordersData] = await Promise.all([
        restaurantRes.json(),
        tablesRes.json(),
        menuRes.json(),
        ordersRes.json(),
      ]);

      if (!restaurantRes.ok) {
        throw new Error(restaurantData?.error || 'Failed to load restaurant.');
      }
      if (!tablesRes.ok) {
        throw new Error(tablesData?.error || 'Failed to load tables.');
      }
      if (!menuRes.ok) {
        throw new Error(menuData?.error || 'Failed to load menu.');
      }
      if (!ordersRes.ok) {
        throw new Error(ordersData?.error || 'Failed to load orders.');
      }

      const loadedTables = Array.isArray(tablesData) ? tablesData : [];

      setRestaurant(restaurantData || null);
      setTables(loadedTables);
      setMenu(Array.isArray(menuData) ? menuData : []);
      setOrders(normalizeOrders(ordersData));

      setSelectedTableNumber((current) => {
        if (current != null && loadedTables.some(
          (table) => Number(table.table_number) === Number(current)
        )) {
          return current;
        }

        return loadedTables.length
          ? Number(loadedTables[0].table_number)
          : null;
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load staff data.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_kitchen', restaurantId);
      socket.emit('join_restaurant', restaurantId);
    });

    socket.on('new_order', (newOrder) => {
      if (Number(newOrder?.restaurant_id) !== Number(restaurantId)) return;

      setOrders((prev) => {
        const normalized = normalizeOrders([newOrder])[0];
        if (!normalized?.order_id) return prev;

        const existing = prev.some(
          (order) => Number(order.order_id) === Number(normalized.order_id)
        );

        if (existing) {
          return prev.map((order) =>
            Number(order.order_id) === Number(normalized.order_id)
              ? { ...order, ...normalized }
              : order
          );
        }

        return [...prev, normalized];
      });
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders((prev) =>
        prev.map((order) =>
          Number(order.order_id) === Number(updatedOrder?.order_id)
            ? { ...order, ...updatedOrder }
            : order
        )
      );
    });

    socket.on('bill_generated', (billEvent) => {
      if (Number(billEvent?.restaurant_id) !== Number(restaurantId) &&
          billEvent?.restaurant_id != null) {
        return;
      }

      const billedIds = new Set(
        (billEvent?.order_ids || []).map(Number)
      );

      if (!billedIds.size) return;

      setOrders((prev) =>
        prev.filter((order) => !billedIds.has(Number(order.order_id)))
      );

      setMessage(
        `Bill #${billEvent.bill_number || billEvent.bill_id} generated successfully.`
      );
    });

    socket.on('menu_item_added', (item) => {
      setMenu((prev) =>
        prev.some((entry) => entry.id === item.id)
          ? prev
          : [...prev, item]
      );
    });

    socket.on('menu_item_updated', (item) => {
      setMenu((prev) =>
        prev.map((entry) => (entry.id === item.id ? item : entry))
      );
    });

    socket.on('menu_item_deleted', (item) => {
      setMenu((prev) =>
        prev.filter((entry) => entry.id !== item.id)
      );

      setCart((prev) =>
        prev.filter((entry) => entry.menu_item_id !== item.id)
      );
    });

    return () => socket.disconnect();
  }, [restaurantId]);

  const tableMap = useMemo(() => {
    const map = new Map();
    tables.forEach((table) => {
      map.set(Number(table.table_number), table);
    });
    return map;
  }, [tables]);

  // Only these orders are shown as active work for the waiter.
  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ACTIVE_STATUSES.has(String(order.status).toLowerCase())
      ),
    [orders]
  );

  // Finished but not yet billed orders are hidden from the order cards,
  // but remain available for the table-level Generate Bill action.
  const billableOrders = useMemo(
    () =>
      orders.filter((order) =>
        BILLABLE_STATUSES.has(String(order.status).toLowerCase())
      ),
    [orders]
  );

  const selectedActiveOrders = useMemo(() => {
    if (selectedTableNumber == null) return [];

    return activeOrders
      .filter(
        (order) =>
          Number(order.table_number) === Number(selectedTableNumber)
      )
      .sort(
        (a, b) =>
          new Date(a.created_at || 0) -
          new Date(b.created_at || 0)
      );
  }, [activeOrders, selectedTableNumber]);

  const selectedBillableOrders = useMemo(() => {
    if (selectedTableNumber == null) return [];

    return billableOrders
      .filter(
        (order) =>
          Number(order.table_number) === Number(selectedTableNumber)
      )
      .sort(
        (a, b) =>
          new Date(a.created_at || 0) -
          new Date(b.created_at || 0)
      );
  }, [billableOrders, selectedTableNumber]);

  const selectedUnbilledOrders = useMemo(() => {
    if (selectedTableNumber == null) return [];

    return orders.filter(
      (order) =>
        Number(order.table_number) === Number(selectedTableNumber)
    );
  }, [orders, selectedTableNumber]);

  const tableSummary = useMemo(() => {
    const summary = new Map();

    tables.forEach((table) => {
      const tableNumber = Number(table.table_number);

      const tableActiveOrders = activeOrders.filter(
        (order) => Number(order.table_number) === tableNumber
      );

      const tableBillableOrders = billableOrders.filter(
        (order) => Number(order.table_number) === tableNumber
      );

      const itemCount = tableActiveOrders.reduce(
        (sum, order) =>
          sum +
          (order.items || []).reduce(
            (itemSum, item) =>
              itemSum + Number(item.quantity || 0),
            0
          ),
        0
      );

      summary.set(tableNumber, {
        orderCount: tableActiveOrders.length,
        itemCount,
        billableCount: tableBillableOrders.length,
      });
    });

    return summary;
  }, [activeOrders, billableOrders, tables]);

  const categories = useMemo(() => {
    const values = new Set(
      menu
        .filter((item) => item.is_available !== false)
        .map((item) => item.category)
        .filter(Boolean)
    );

    return [
      'All',
      ...Array.from(values).sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();

    return menu
      .filter((item) => item.is_available !== false)
      .filter(
        (item) =>
          category === 'All' ||
          item.category === category
      )
      .filter(
        (item) =>
          !query ||
          `${item.name} ${item.description || ''}`
            .toLowerCase()
            .includes(query)
      )
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
  }, [menu, category, menuSearch]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find(
        (entry) => entry.menu_item_id === item.id
      );

      if (existing) {
        return prev.map((entry) =>
          entry.menu_item_id === item.id
            ? {
                ...entry,
                quantity: entry.quantity + 1,
              }
            : entry
        );
      }

      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: 1,
          note: '',
        },
      ];
    });
  };

  const changeCartQuantity = (menuItemId, delta) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.menu_item_id === menuItemId
            ? {
                ...entry,
                quantity: entry.quantity + delta,
              }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const placeStaffOrder = async () => {
    if (
      selectedTableNumber == null ||
      cart.length === 0
    ) {
      return;
    }

    setPlacingOrder(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_BASE}/orders/restaurant/${restaurantId}/table/${selectedTableNumber}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: cart.map((item) => ({
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              note: item.note || undefined,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to place order.'
        );
      }

      const normalized = normalizeOrders([data])[0];

      setOrders((prev) => {
        const exists = prev.some(
          (order) =>
            Number(order.order_id) ===
            Number(normalized.order_id)
        );

        return exists
          ? prev
          : [...prev, normalized];
      });

      setCart([]);
      setShowOrderModal(false);
      setMessage(
        `Order #${normalized.order_id} placed for Table ${selectedTableNumber}.`
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to place order.'
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  const updateOrderStatus = async (order) => {
    const status = nextStatus(order.status);
    if (!status) return;

    setUpdatingOrderId(order.order_id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_BASE}/orders/${order.order_id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to update order status.'
        );
      }

      setOrders((prev) =>
        prev.map((entry) =>
          Number(entry.order_id) === Number(order.order_id)
            ? { ...entry, ...data }
            : entry
        )
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to update order status.'
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const generateCombinedBill = async () => {
    if (selectedTableNumber == null) return;

    if (!selectedBillableOrders.length) {
      setError(
        'There are no finished, unbilled orders for this table.'
      );
      return;
    }

    if (selectedActiveOrders.length > 0) {
      setError(
        'Finish serving all active orders before generating the bill.'
      );
      return;
    }

    setGeneratingBill(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_BASE}/bills/restaurant/${restaurantId}/table/${selectedTableNumber}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to generate combined bill.'
        );
      }

      const orderIds = new Set(
        (data?.orders || []).map((order) => Number(order.id))
      );

      // Also remove any IDs sent by the server response, if available.
      selectedBillableOrders.forEach((order) => {
        orderIds.add(Number(order.order_id));
      });

      setOrders((prev) =>
        prev.filter(
          (order) =>
            !orderIds.has(Number(order.order_id))
        )
      );

      setMessage(
        `Bill #${data?.bill_number || data?.bill_id} generated for Table ${selectedTableNumber}. The billed orders were removed from the Staff Panel.`
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to generate combined bill.'
      );
    } finally {
      setGeneratingBill(false);
    }
  };

  return (
    <div className="staff-shell">
      <style>{`
        .staff-shell{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .staff-topbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #e7eaf0;padding:14px 18px;display:flex;justify-content:space-between;gap:14px;align-items:center}
        .staff-brand{display:flex;align-items:center;gap:12px}.staff-brand-mark{width:40px;height:40px;border-radius:12px;background:#172033;color:#fff;display:grid;place-items:center;font-size:20px}.staff-brand h1{margin:0;font-size:17px}.staff-brand p{margin:3px 0 0;color:#778097;font-size:12px}.staff-live{display:flex;align-items:center;gap:8px;font-size:12px;color:#667085}.staff-live-dot{width:8px;height:8px;border-radius:50%;background:#2fb344;box-shadow:0 0 0 4px rgba(47,179,68,.12)}
        .staff-content{max-width:1450px;margin:0 auto;padding:18px}.staff-alert{margin-bottom:14px;padding:11px 12px;border-radius:11px;font-size:12px}.staff-alert.error{background:#fff0f0;color:#a33030;border:1px solid #f5d2d2}.staff-alert.success{background:#eefaf1;color:#2a743d;border:1px solid #d4ecd9}
        .staff-layout{display:grid;grid-template-columns:1.05fr 1.55fr;gap:18px}.staff-panel{background:#fff;border:1px solid #e7eaf0;border-radius:18px;box-shadow:0 6px 24px rgba(25,35,55,.05);overflow:hidden}
        .staff-panel-head{padding:16px 18px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:10px}.staff-panel-head h2{font-size:15px;margin:0}.staff-panel-head span{font-size:12px;color:#7a8497}.staff-table-grid{padding:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
        .staff-table{border:1px solid #e1e5ec;border-radius:15px;background:#fbfcfe;padding:14px;text-align:left;cursor:pointer;transition:.18s}.staff-table:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(25,35,55,.07)}.staff-table.active{border-color:#172033;box-shadow:0 0 0 2px rgba(23,32,51,.08);background:#fff}.staff-table-num{font-size:18px;font-weight:800}.staff-table-meta{font-size:11px;color:#7b8494;margin-top:3px}.staff-table-badge{display:inline-flex;margin-top:11px;padding:5px 8px;border-radius:999px;background:#eef2f7;font-size:10px;font-weight:700}.staff-table-badge.busy{background:#fff0df;color:#a55d00}.staff-table-badge.bill{background:#eaf8ef;color:#238243}
        .staff-side-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid #edf0f4}.staff-selected-table{font-size:18px;font-weight:850}.staff-selected-sub{font-size:11px;color:#80899a;margin-top:3px}.staff-side-body{padding:16px}.staff-table-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.staff-mini-stat{border:1px solid #e7eaf0;border-radius:13px;padding:12px}.staff-mini-stat strong{display:block;font-size:17px}.staff-mini-stat span{font-size:10px;color:#7b8494}
        .staff-bill-ready{margin:0 0 14px;border:1px solid #d9ebdf;background:#f3fbf5;border-radius:13px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.staff-bill-ready strong{font-size:12px}.staff-bill-ready span{display:block;margin-top:3px;font-size:11px;color:#667085}.staff-orders{display:flex;flex-direction:column;gap:12px;max-height:640px;overflow:auto}.staff-empty{padding:34px 18px;text-align:center;color:#7d8798;font-size:13px}.staff-order-card{border:1px solid #e2e6ee;border-radius:16px;padding:14px;background:#fff}.staff-order-top{display:flex;justify-content:space-between;gap:10px}.staff-order-title{font-size:14px;font-weight:800}.staff-order-time{font-size:11px;color:#8a93a2;margin-top:3px}.staff-status{display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:800}.staff-status.new{background:#eef4ff;color:#285aa8}.staff-status.preparing{background:#fff4df;color:#9b6204}.staff-status.ready{background:#eaf8ef;color:#238243}.staff-status.completed,.staff-status.neutral{background:#edf0f4;color:#606978}.staff-items{margin:13px 0;border-top:1px solid #edf0f4;padding-top:10px;display:flex;flex-direction:column;gap:7px}.staff-item-row{display:flex;justify-content:space-between;gap:12px;font-size:12px}.staff-item-name{font-weight:650}.staff-item-qty{color:#7c8595}.staff-item-note{font-size:11px;color:#8a93a2;margin-left:18px;margin-top:-3px}
        .staff-actions{display:flex;gap:8px;flex-wrap:wrap}.staff-btn{border:none;border-radius:10px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}.staff-btn.primary{background:#172033;color:#fff}.staff-btn.light{background:#eef1f5;color:#202938}.staff-btn.success{background:#e7f7eb;color:#27733c}.staff-btn:disabled{opacity:.5;cursor:not-allowed}
        .staff-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}.staff-modal{background:#fff;width:min(1060px,100%);max-height:90vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(15,23,42,.25)}.staff-modal-head{padding:15px 18px;border-bottom:1px solid #edf0f4;display:flex;justify-content:space-between;align-items:center}.staff-modal-head h3{margin:0;font-size:15px}.staff-close{border:none;background:#f0f2f5;width:30px;height:30px;border-radius:9px;cursor:pointer}.staff-modal-body{padding:16px;overflow:auto}.staff-menu-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.staff-menu-card{border:1px solid #e2e6ee;border-radius:14px;padding:11px;display:flex;flex-direction:column;gap:8px}.staff-menu-card h4{margin:0;font-size:12px}.staff-menu-card p{margin:0;color:#7b8494;font-size:10px;line-height:1.4}.staff-menu-price{font-weight:850}.staff-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}.staff-input{height:38px;border:1px solid #dfe4ec;border-radius:10px;padding:0 11px;outline:none;flex:1;min-width:180px}.staff-select{height:38px;border:1px solid #dfe4ec;border-radius:10px;padding:0 10px;background:#fff}.staff-cart{margin-top:16px;border-top:1px solid #edf0f4;padding-top:14px}.staff-cart-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:8px 0}.staff-qty{display:flex;align-items:center;gap:8px}.staff-qty button{border:none;background:#edf0f4;border-radius:7px;width:26px;height:26px;cursor:pointer}.staff-modal-foot{padding:14px 18px;border-top:1px solid #edf0f4;display:flex;justify-content:space-between;align-items:center;gap:10px}.staff-total{font-weight:850}
        @media(max-width:1000px){.staff-layout{grid-template-columns:1fr}.staff-table-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.staff-menu-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.staff-content{padding:12px}.staff-table-grid{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px}.staff-table-summary{grid-template-columns:1fr 1fr 1fr}.staff-menu-grid{grid-template-columns:1fr}.staff-topbar{padding:12px}.staff-brand p{display:none}.staff-layout{gap:12px}.staff-panel-head,.staff-side-head{padding:13px}.staff-side-body{padding:12px}.staff-bill-ready{align-items:flex-start;flex-direction:column}}
      `}</style>

      <header className="staff-topbar">
        <div className="staff-brand">
          <div className="staff-brand-mark">🍽</div>
          <div>
            <h1>{restaurant?.name || 'Restaurant Staff'}</h1>
            <p>Waiter service panel</p>
          </div>
        </div>

        <div className="staff-live">
          <span className="staff-live-dot" />
          Live
        </div>
      </header>

      <main className="staff-content">
        {message && (
          <div className="staff-alert success">
            {message}
          </div>
        )}

        {error && (
          <div className="staff-alert error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="staff-panel">
            <div className="staff-empty">Loading staff panel…</div>
          </div>
        ) : (
          <div className="staff-layout">
            <section className="staff-panel">
              <div className="staff-panel-head">
                <div>
                  <h2>Tables</h2>
                  <span>Select a table to serve it</span>
                </div>
                <span>
                  {activeOrders.length} active orders
                </span>
              </div>

              <div className="staff-table-grid">
                {tables.length === 0 ? (
                  <div className="staff-empty">
                    No tables found.
                  </div>
                ) : (
                  tables.map((table) => {
                    const tableNumber = Number(table.table_number);
                    const summary =
                      tableSummary.get(tableNumber) || {
                        orderCount: 0,
                        itemCount: 0,
                        billableCount: 0,
                      };

                    const isSelected =
                      Number(selectedTableNumber) === tableNumber;

                    return (
                      <button
                        key={table.id || tableNumber}
                        type="button"
                        className={`staff-table ${
                          isSelected ? 'active' : ''
                        }`}
                        onClick={() => {
                          setSelectedTableNumber(tableNumber);
                          setError('');
                        }}
                      >
                        <div className="staff-table-num">
                          Table {tableNumber}
                        </div>

                        <div className="staff-table-meta">
                          {summary.itemCount} active items
                        </div>

                        {summary.orderCount > 0 ? (
                          <span className="staff-table-badge busy">
                            {summary.orderCount} active order
                            {summary.orderCount === 1 ? '' : 's'}
                          </span>
                        ) : summary.billableCount > 0 ? (
                          <span className="staff-table-badge bill">
                            {summary.billableCount} ready for bill
                          </span>
                        ) : (
                          <span className="staff-table-badge">
                            Available
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="staff-panel">
              {selectedTableNumber == null ? (
                <div className="staff-empty">
                  Select a table to begin.
                </div>
              ) : (
                <>
                  <div className="staff-side-head">
                    <div>
                      <div className="staff-selected-table">
                        Table {selectedTableNumber}
                      </div>
                      <div className="staff-selected-sub">
                        Active service orders for this table
                      </div>
                    </div>

                    <div className="staff-actions">
                      <button
                        className="staff-btn light"
                        type="button"
                        onClick={() => setShowOrderModal(true)}
                      >
                        ＋ New Order
                      </button>

                      <button
                        className="staff-btn primary"
                        type="button"
                        disabled={
                          generatingBill ||
                          selectedBillableOrders.length === 0 ||
                          selectedActiveOrders.length > 0
                        }
                        onClick={generateCombinedBill}
                      >
                        {generatingBill
                          ? 'Generating…'
                          : 'Generate Bill'}
                      </button>
                    </div>
                  </div>

                  <div className="staff-side-body">
                    <div className="staff-table-summary">
                      <div className="staff-mini-stat">
                        <strong>{selectedActiveOrders.length}</strong>
                        <span>Active Orders</span>
                      </div>

                      <div className="staff-mini-stat">
                        <strong>
                          {selectedBillableOrders.length}
                        </strong>
                        <span>Ready for Bill</span>
                      </div>

                      <div className="staff-mini-stat">
                        <strong>
                          {selectedUnbilledOrders.length}
                        </strong>
                        <span>Unbilled Total</span>
                      </div>
                    </div>

                    {selectedBillableOrders.length > 0 && (
                      <div className="staff-bill-ready">
                        <div>
                          <strong>
                            {selectedBillableOrders.length} finished order
                            {selectedBillableOrders.length === 1 ? '' : 's'} ready for billing
                          </strong>
                          <span>
                            Finished orders are hidden from the active order list. Generate Bill will combine them into one bill.
                          </span>
                        </div>

                        <button
                          className="staff-btn success"
                          type="button"
                          disabled={
                            generatingBill ||
                            selectedActiveOrders.length > 0
                          }
                          onClick={generateCombinedBill}
                        >
                          {generatingBill
                            ? 'Generating…'
                            : 'Generate Bill'}
                        </button>
                      </div>
                    )}

                    <div className="staff-orders">
                      {selectedActiveOrders.length === 0 ? (
                        <div className="staff-empty">
                          {selectedBillableOrders.length > 0
                            ? 'No active orders. The finished orders above are ready to be billed.'
                            : 'No active orders for this table. Use “New Order” to place one.'}
                        </div>
                      ) : (
                        selectedActiveOrders.map((order) => {
                          const advance = nextStatus(order.status);
                          const isUpdating =
                            Number(updatingOrderId) ===
                            Number(order.order_id);

                          return (
                            <article
                              className="staff-order-card"
                              key={order.order_id}
                            >
                              <div className="staff-order-top">
                                <div>
                                  <div className="staff-order-title">
                                    Order #{order.order_id}
                                  </div>
                                  <div className="staff-order-time">
                                    {formatTime(order.created_at)} · Table {order.table_number}
                                  </div>
                                </div>

                                <span
                                  className={`staff-status ${statusTone(
                                    order.status
                                  )}`}
                                >
                                  {STATUS_LABELS[order.status] || order.status}
                                </span>
                              </div>

                              <div className="staff-items">
                                {(order.items || []).map((item) => (
                                  <div
                                    key={
                                      item.order_item_id ||
                                      `${order.order_id}-${item.menu_item_id}`
                                    }
                                  >
                                    <div className="staff-item-row">
                                      <span className="staff-item-name">
                                        {item.name}
                                      </span>
                                      <span className="staff-item-qty">
                                        × {item.quantity}
                                      </span>
                                    </div>

                                    {item.note && (
                                      <div className="staff-item-note">
                                        Note: {item.note}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {advance && (
                                <div className="staff-actions">
                                  <button
                                    className="staff-btn light"
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      updateOrderStatus(order)
                                    }
                                  >
                                    {isUpdating
                                      ? 'Updating…'
                                      : `Mark ${STATUS_LABELS[advance] || advance}`}
                                  </button>
                                </div>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {showOrderModal && selectedTableNumber != null && (
        <div
          className="staff-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowOrderModal(false);
            }
          }}
        >
          <div className="staff-modal">
            <div className="staff-modal-head">
              <h3>
                New Order · Table {selectedTableNumber}
              </h3>

              <button
                className="staff-close"
                type="button"
                onClick={() => setShowOrderModal(false)}
              >
                ×
              </button>
            </div>

            <div className="staff-modal-body">
              <div className="staff-toolbar">
                <input
                  className="staff-input"
                  placeholder="Search menu…"
                  value={menuSearch}
                  onChange={(event) =>
                    setMenuSearch(event.target.value)
                  }
                />

                <select
                  className="staff-select"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value)
                  }
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="staff-menu-grid">
                {filteredMenu.length === 0 ? (
                  <div className="staff-empty">
                    No available menu items found.
                  </div>
                ) : (
                  filteredMenu.map((item) => (
                    <div
                      className="staff-menu-card"
                      key={item.id}
                    >
                      <h4>{item.name}</h4>

                      {item.description && (
                        <p>{item.description}</p>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 'auto',
                        }}
                      >
                        <span className="staff-menu-price">
                          {money(item.price)}
                        </span>

                        <button
                          className="staff-btn primary"
                          type="button"
                          onClick={() => addToCart(item)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="staff-cart">
                <strong style={{ fontSize: 13 }}>
                  Current Order
                </strong>

                {cart.length === 0 ? (
                  <div
                    style={{
                      color: '#818a99',
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    Add items from the menu.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      className="staff-cart-row"
                      key={item.menu_item_id}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: '#818a99',
                          }}
                        >
                          {money(item.price)}
                        </div>
                      </div>

                      <div className="staff-qty">
                        <button
                          type="button"
                          onClick={() =>
                            changeCartQuantity(
                              item.menu_item_id,
                              -1
                            )
                          }
                        >
                          −
                        </button>

                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            changeCartQuantity(
                              item.menu_item_id,
                              1
                            )
                          }
                        >
                          +
                        </button>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {money(
                          item.price * item.quantity
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="staff-modal-foot">
              <div className="staff-total">
                Total:{' '}
                {money(
                  cart.reduce(
                    (sum, item) =>
                      sum + item.price * item.quantity,
                    0
                  )
                )}
              </div>

              <button
                className="staff-btn primary"
                type="button"
                disabled={
                  placingOrder || cart.length === 0
                }
                onClick={placeStaffOrder}
              >
                {placingOrder
                  ? 'Placing…'
                  : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
