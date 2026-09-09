import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const ACTIVE_STATUSES = ['placed', 'preparing', 'ready'];

const STATUS_META = {
  placed: {
    label: 'New Order',
    shortLabel: 'Placed',
    color: '#e53935',
    bg: '#fff1f1',
    border: '#ffb7b7',
    icon: '🧾',
    actionLabel: 'Start Preparing',
    next: 'preparing',
  },
  preparing: {
    label: 'Preparing',
    shortLabel: 'Preparing',
    color: '#f59e0b',
    bg: '#fff8e8',
    border: '#ffd98a',
    icon: '👨‍🍳',
    actionLabel: 'Mark Ready',
    next: 'ready',
  },
  ready: {
    label: 'Ready',
    shortLabel: 'Ready',
    color: '#16a34a',
    bg: '#ecfdf3',
    border: '#a7e8bd',
    icon: '✓',
    actionLabel: 'Complete Order',
    next: 'completed',
  },
};

function normalizeOrder(order) {
  return {
    ...order,
    id: order.id ?? order.order_id,
    order_id: order.order_id ?? order.id,
    table_number: Number(order.table_number),
    status: String(order.status || 'placed').toLowerCase(),
    items: Array.isArray(order.items) ? order.items : [],
  };
}

function getOrderTotal(order) {
  return order.items.reduce((sum, item) => {
    const price = Number(
      item.unit_price ??
        item.price ??
        item.current_menu_price ??
        0
    );

    return sum + price * Number(item.quantity || 0);
  }, 0);
}

function formatTime(value) {
  if (!value) return '--';

  return new Date(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return '--';

  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TableIcon({ active = false }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 58,
        height: 58,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? '#ffe5e5' : '#f1f3f5',
        color: active ? '#e53935' : '#343a40',
        fontSize: 32,
        lineHeight: 1,
      }}
    >
      ♜
    </div>
  );
}

function StatCard({ icon, label, value, helper, accent }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: '18px 20px',
        minHeight: 112,
        boxSizing: 'border-box',
        boxShadow: '0 2px 10px rgba(0,0,0,.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `${accent}16`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 21,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              color: '#68707a',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 800,
              color: accent,
            }}
          >
            {value}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          color: '#9aa1a9',
          fontSize: 12,
        }}
      >
        {helper}
      </div>
    </div>
  );
}

function OrderCard({ order, onUpdateStatus, updating }) {
  const meta =
    STATUS_META[order.status] || STATUS_META.placed;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${
          order.status === 'placed' ? '#ffb7b7' : '#e1e5e9'
        }`,
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: '#111827',
            }}
          >
            Order #{order.order_id}
          </div>

          <div
            style={{
              marginTop: 5,
              color: '#7b8490',
              fontSize: 12,
            }}
          >
            {formatDateTime(order.created_at)}
          </div>
        </div>

        <span
          style={{
            padding: '7px 11px',
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {meta.shortLabel}
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          border: '1px solid #e8ebee',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {order.items.map((item, index) => (
          <div
            key={item.order_item_id ?? `${item.menu_item_id}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 13px',
              borderBottom:
                index < order.items.length - 1
                  ? '1px solid #eef0f2'
                  : 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 750,
                  color: '#111827',
                  fontSize: 14,
                }}
              >
                {item.name}
              </div>

              <div
                style={{
                  marginTop: 3,
                  color: '#8a929b',
                  fontSize: 11,
                }}
              >
                {item.category || 'Menu item'}
              </div>

              {item.note && (
                <div
                  style={{
                    marginTop: 5,
                    color: '#b45309',
                    fontSize: 11,
                  }}
                >
                  Note: {item.note}
                </div>
              )}
            </div>

            <div
              style={{
                fontWeight: 800,
                color: '#111827',
                whiteSpace: 'nowrap',
              }}
            >
              × {item.quantity}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
        }}
      >
        <span
          style={{
            color: '#707985',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Order Total
        </span>

        <strong
          style={{
            color: '#111827',
            fontSize: 18,
          }}
        >
          ₹{getOrderTotal(order).toFixed(2)}
        </strong>
      </div>

      {meta.next && (
        <button
          onClick={() =>
            onUpdateStatus(order.order_id, meta.next)
          }
          disabled={updating === order.order_id}
          style={{
            width: '100%',
            marginTop: 14,
            border: 'none',
            borderRadius: 11,
            padding: '12px 14px',
            background: meta.color,
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor:
              updating === order.order_id
                ? 'wait'
                : 'pointer',
            opacity:
              updating === order.order_id ? 0.65 : 1,
          }}
        >
          {updating === order.order_id
            ? 'Updating...'
            : `${meta.icon}  ${meta.actionLabel}`}
        </button>
      )}
    </div>
  );
}

export default function KitchenDashboard({
  restaurantId,
}) {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [sortMode, setSortMode] = useState('active');
  const [updatingOrderId, setUpdatingOrderId] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadKitchenData = async () => {
    try {
      setError('');

      const [tableResult, restaurantResult, orderResult] =
        await Promise.all([
          api.getTables(restaurantId),
          api.getRestaurant(restaurantId),
          fetch(
            `${API_BASE}/orders/kitchen/${restaurantId}`
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(
                `Kitchen orders request failed (${response.status})`
              );
            }

            return response.json();
          }),
        ]);

      setTables(
        Array.isArray(tableResult) ? tableResult : []
      );

      setRestaurant(
        restaurantResult?.error
          ? null
          : restaurantResult
      );

      setOrders(
        Array.isArray(orderResult)
          ? orderResult.map(normalizeOrder)
          : []
      );
    } catch (err) {
      console.error(err);
      setError(
        'Failed to load kitchen data. Check that the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKitchenData();

    const socket = io(
      import.meta.env.VITE_SOCKET_URL ||
        'http://localhost:4000'
    );

    socket.emit('join_kitchen', restaurantId);

    const handleNewOrder = (newOrder) => {
      const normalized = normalizeOrder(newOrder);

      setOrders((prev) => {
        const exists = prev.some(
          (order) =>
            Number(order.order_id) ===
            Number(normalized.order_id)
        );

        if (exists) {
          return prev.map((order) =>
            Number(order.order_id) ===
            Number(normalized.order_id)
              ? normalized
              : order
          );
        }

        return [...prev, normalized];
      });
    };

    const handleStatusUpdate = (statusUpdate) => {
      setOrders((prev) =>
        prev
          .map((order) =>
            Number(order.order_id) ===
            Number(
              statusUpdate.order_id ?? statusUpdate.id
            )
              ? {
                  ...order,
                  status: String(
                    statusUpdate.status
                  ).toLowerCase(),
                }
              : order
          )
          .filter((order) =>
            ACTIVE_STATUSES.includes(order.status)
          )
      );
    };

    socket.on('new_order', handleNewOrder);
    socket.on(
      'order_status_updated',
      handleStatusUpdate
    );

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off(
        'order_status_updated',
        handleStatusUpdate
      );
      socket.disconnect();
    };
  }, [restaurantId]);

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      ),
    [orders]
  );

  const tableMap = useMemo(() => {
    const map = new Map();

    tables.forEach((table) => {
      map.set(Number(table.table_number), {
        ...table,
        table_number: Number(table.table_number),
        orders: [],
      });
    });

    activeOrders.forEach((order) => {
      const number = Number(order.table_number);

      if (!map.has(number)) {
        map.set(number, {
          id: `generated-${number}`,
          table_number: number,
          orders: [],
        });
      }

      map.get(number).orders.push(order);
    });

    return Array.from(map.values());
  }, [tables, activeOrders]);

  const orderedTables = useMemo(() => {
    const result = [...tableMap];

    if (sortMode === 'active') {
      result.sort((a, b) => {
        const activeDiff =
          b.orders.length - a.orders.length;

        if (activeDiff !== 0) {
          return activeDiff;
        }

        const aLatest = a.orders.length
          ? Math.max(
              ...a.orders.map((order) =>
                new Date(order.created_at).getTime()
              )
            )
          : 0;

        const bLatest = b.orders.length
          ? Math.max(
              ...b.orders.map((order) =>
                new Date(order.created_at).getTime()
              )
            )
          : 0;

        return bLatest - aLatest;
      });
    } else {
      result.sort(
        (a, b) => a.table_number - b.table_number
      );
    }

    return result;
  }, [tableMap, sortMode]);

  const selectedTableData = selectedTable
    ? orderedTables.find(
        (table) =>
          Number(table.table_number) ===
          Number(selectedTable)
      )
    : null;

  const placedCount = activeOrders.filter(
    (order) => order.status === 'placed'
  ).length;

  const preparingCount = activeOrders.filter(
    (order) => order.status === 'preparing'
  ).length;

  const readyCount = activeOrders.filter(
    (order) => order.status === 'ready'
  ).length;

  const updateOrderStatus = async (
    orderId,
    status
  ) => {
    try {
      setUpdatingOrderId(orderId);
      setError('');

      const response = await fetch(
        `${API_BASE}/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Failed to update order status.'
        );
      }

      setOrders((prev) =>
        prev
          .map((order) =>
            Number(order.order_id) === Number(orderId)
              ? {
                  ...order,
                  status,
                }
              : order
          )
          .filter((order) =>
            ACTIVE_STATUSES.includes(order.status)
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

  const getTableStatus = (table) => {
    if (!table.orders.length) return 'empty';

    const hasPlaced = table.orders.some(
      (order) => order.status === 'placed'
    );

    if (hasPlaced) return 'placed';

    const hasPreparing = table.orders.some(
      (order) => order.status === 'preparing'
    );

    if (hasPreparing) return 'preparing';

    return 'ready';
  };

  const getTableLastOrder = (table) => {
    if (!table.orders.length) return null;

    return table.orders.reduce(
      (latest, order) => {
        if (!latest) return order;

        return new Date(order.created_at) >
          new Date(latest.created_at)
          ? order
          : latest;
      },
      null
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, #f8f9fa 0%, #f1f3f5 100%)',
        color: '#111827',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        button, select { font: inherit; }
        .kitchen-shell { min-height: 100vh; }
        .kitchen-header {
          min-height: 84px;
          background: #1f1f1f;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 32px;
        }
        .kitchen-content {
          padding: 28px 32px 48px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }
        .table-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .table-card {
          min-height: 205px;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .table-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,.08);
        }
        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .28);
          z-index: 50;
        }
        .order-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(460px, 94vw);
          background: #f7f8fa;
          z-index: 51;
          box-shadow: -14px 0 45px rgba(0,0,0,.18);
          overflow-y: auto;
        }
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .table-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .kitchen-header {
            padding: 16px 18px;
            align-items: flex-start;
          }
          .kitchen-content { padding: 20px 16px 36px; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .table-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 480px) {
          .stats-grid, .table-grid { grid-template-columns: 1fr; }
          .table-card { min-height: 180px; }
        }
      `}</style>

      <header className="kitchen-header">
        <div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              color: '#a7adb5',
              fontWeight: 700,
            }}
          >
            {restaurant?.name || 'RESTAURANT'}
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 850,
              marginTop: 2,
            }}
          >
            Kitchen Dashboard
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            color: '#d4d7db',
            fontSize: 13,
          }}
        >
          <span>
            Restaurant #{restaurantId}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#22c55e',
              }}
            />
            Online
          </span>
        </div>
      </header>

      <main className="kitchen-content">
        {error && (
          <div
            style={{
              marginBottom: 18,
              padding: '12px 14px',
              borderRadius: 12,
              background: '#fff1f2',
              color: '#b91c1c',
              border: '1px solid #fecdd3',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            icon="🔔"
            label="Active Orders"
            value={activeOrders.length}
            helper="Currently in kitchen"
            accent="#e53935"
          />

          <StatCard
            icon="🧾"
            label="Placed"
            value={placedCount}
            helper="Waiting to start"
            accent="#2563eb"
          />

          <StatCard
            icon="👨‍🍳"
            label="Preparing"
            value={preparingCount}
            helper="Currently cooking"
            accent="#f59e0b"
          />

          <StatCard
            icon="✓"
            label="Ready"
            value={readyCount}
            helper="Ready to serve"
            accent="#16a34a"
          />

          <StatCard
            icon="♜"
            label="Total Tables"
            value={tableMap.length}
            helper={`${tableMap.filter((t) => t.orders.length).length} with active orders`}
            accent="#4b5563"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginTop: 30,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 850,
              }}
            >
              Tables
            </h2>

            <div
              style={{
                marginTop: 6,
                color: '#7b8490',
                fontSize: 13,
              }}
            >
              Click a table to view its active orders.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                color: '#5f6873',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#e53935',
                    marginRight: 5,
                  }}
                />
                New Order
              </span>

              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    marginRight: 5,
                  }}
                />
                Preparing
              </span>

              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#16a34a',
                    marginRight: 5,
                  }}
                />
                Ready
              </span>

              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#9ca3af',
                    marginRight: 5,
                  }}
                />
                No Orders
              </span>
            </div>

            <select
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value)
              }
              style={{
                border: '1px solid #d8dde2',
                borderRadius: 10,
                padding: '9px 12px',
                background: '#fff',
                color: '#374151',
                fontSize: 13,
                fontWeight: 650,
              }}
            >
              <option value="active">
                Active first
              </option>
              <option value="number">
                Table number
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 40,
              textAlign: 'center',
              color: '#6b7280',
            }}
          >
            Loading kitchen...
          </div>
        ) : orderedTables.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 50,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 44,
                marginBottom: 10,
              }}
            >
              ♜
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              No tables found
            </div>
            <div
              style={{
                color: '#7b8490',
                marginTop: 6,
                fontSize: 13,
              }}
            >
              Create tables from the Admin Dashboard.
            </div>
          </div>
        ) : (
          <div className="table-grid">
            {orderedTables.map((table) => {
              const status = getTableStatus(table);
              const active = table.orders.length > 0;
              const meta =
                status === 'empty'
                  ? null
                  : STATUS_META[status];

              const lastOrder =
                getTableLastOrder(table);

              return (
                <button
                  key={table.id ?? table.table_number}
                  className="table-card"
                  onClick={() =>
                    setSelectedTable(
                      Number(table.table_number)
                    )
                  }
                  style={{
                    border:
                      status === 'placed'
                        ? '2px solid #ff6b6b'
                        : status === 'preparing'
                        ? '2px solid #f5b13b'
                        : status === 'ready'
                        ? '2px solid #43b86b'
                        : '1px solid #dfe3e7',
                    borderRadius: 17,
                    padding: 20,
                    background:
                      status === 'placed'
                        ? '#fff3f3'
                        : status === 'preparing'
                        ? '#fff9ed'
                        : status === 'ready'
                        ? '#f0fcf4'
                        : '#fff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    position: 'relative',
                    color: '#111827',
                    boxShadow: active
                      ? '0 5px 18px rgba(0,0,0,.07)'
                      : '0 2px 8px rgba(0,0,0,.03)',
                  }}
                >
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 31,
                        height: 31,
                        borderRadius: '50%',
                        background:
                          meta?.color || '#6b7280',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      {table.orders.length}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <TableIcon active={active} />
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      fontSize: 19,
                      fontWeight: 850,
                    }}
                  >
                    Table {table.table_number}
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      color:
                        active
                          ? meta?.color || '#374151'
                          : '#59636e',
                      fontSize: 13,
                      fontWeight: active ? 750 : 500,
                    }}
                  >
                    {active
                      ? `${table.orders.length} active ${
                          table.orders.length === 1
                            ? 'order'
                            : 'orders'
                        }`
                      : 'No active orders'}
                  </div>

                  {lastOrder && (
                    <div
                      style={{
                        marginTop: 9,
                        color: '#8a929c',
                        fontSize: 11,
                      }}
                    >
                      Last order:{' '}
                      {formatTime(lastOrder.created_at)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selectedTableData && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setSelectedTable(null)}
          />

          <aside className="order-drawer">
            <div
              style={{
                background: '#202020',
                color: '#fff',
                padding: '24px 22px 20px',
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 27,
                      fontWeight: 850,
                    }}
                  >
                    Table {selectedTableData.table_number}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      color: '#c4c7ca',
                      fontSize: 13,
                    }}
                  >
                    {selectedTableData.orders.length}{' '}
                    active{' '}
                    {selectedTableData.orders.length === 1
                      ? 'order'
                      : 'orders'}
                  </div>

                  {getTableLastOrder(
                    selectedTableData
                  ) && (
                    <div
                      style={{
                        marginTop: 4,
                        color: '#aeb2b7',
                        fontSize: 12,
                      }}
                    >
                      Last order:{' '}
                      {formatTime(
                        getTableLastOrder(
                          selectedTableData
                        ).created_at
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedTable(null)}
                  aria-label="Close"
                  style={{
                    width: 38,
                    height: 38,
                    border: 'none',
                    borderRadius: 10,
                    background: '#333',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 24,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 18,
              }}
            >
              {selectedTableData.orders.map(
                (order) => (
                  <div
                    key={order.order_id}
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <OrderCard
                      order={order}
                      onUpdateStatus={
                        updateOrderStatus
                      }
                      updating={updatingOrderId}
                    />
                  </div>
                )
              )}

              {selectedTableData.orders.length === 0 && (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: 30,
                    textAlign: 'center',
                    color: '#737b85',
                  }}
                >
                  No active orders for this table.
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
