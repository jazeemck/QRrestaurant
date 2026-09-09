import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';

// --------------------------------------------------
// ORDER STATUS CARD
// --------------------------------------------------

function OrderStatusCard({ order }) {
  const steps = [
    {
      key: 'placed',
      label: 'Order Placed',
    },
    {
      key: 'preparing',
      label: 'Preparing',
    },
    {
      key: 'ready',
      label: 'Ready',
    },
    {
      key: 'completed',
      label: 'Completed',
    },
  ];

  const statusOrder = [
    'placed',
    'preparing',
    'ready',
    'completed',
  ];

  // Cancelled order
  if (order.status === 'cancelled') {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: 14,
          padding: 18,
          marginBottom: 12,
          border: '1px solid #e5e5e5',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong
            style={{
              fontSize: 17,
            }}
          >
            Order #{order.order_id}
          </strong>

          <span
            style={{
              color: '#c62828',
              fontSize: 13,
              fontWeight: 'bold',
            }}
          >
            Cancelled
          </span>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: '#ffebee',
            color: '#c62828',
            fontSize: 14,
          }}
        >
          This order has been cancelled.
        </div>
      </div>
    );
  }

  const currentIndex = statusOrder.indexOf(
    order.status
  );

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
        border: '1px solid #e5e5e5',
      }}
    >
      {/* Order header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <strong
          style={{
            fontSize: 17,
          }}
        >
          Order #{order.order_id}
        </strong>

        <span
          style={{
            padding: '5px 9px',
            borderRadius: 20,
            background: '#f1f1f1',
            color: '#555',
            fontSize: 12,
            fontWeight: 'bold',
            textTransform: 'capitalize',
          }}
        >
          {order.status}
        </span>
      </div>

      {/* Order items */}
      {order.items && order.items.length > 0 && (
        <div
          style={{
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid #eee',
          }}
        >
          {order.items.map((item) => (
            <div
              key={item.order_item_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '5px 0',
                fontSize: 14,
              }}
            >
              <span>
                {item.name} × {item.quantity}
              </span>

              <strong>
                ₹
                {Number(item.price) *
                  item.quantity}
              </strong>
            </div>
          ))}
        </div>
      )}

      {/* Status timeline */}
      <div>
        {steps.map((step, index) => {
          const stepIndex =
            statusOrder.indexOf(step.key);

          const isCompleted =
            stepIndex < currentIndex;

          const isCurrent =
            stepIndex === currentIndex;

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              {/* Timeline circle + line */}
              <div
                style={{
                  width: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background:
                      isCompleted || isCurrent
                        ? '#222'
                        : '#eee',
                    color:
                      isCompleted || isCurrent
                        ? 'white'
                        : '#999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}
                >
                  {isCompleted
                    ? '✓'
                    : index + 1}
                </div>

                {index < steps.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 30,
                      background:
                        isCompleted
                          ? '#222'
                          : '#eee',
                    }}
                  />
                )}
              </div>

              {/* Status text */}
              <div
                style={{
                  paddingLeft: 10,
                  paddingTop: 1,
                  paddingBottom:
                    index < steps.length - 1
                      ? 8
                      : 0,
                }}
              >
                <div
                  style={{
                    fontWeight:
                      isCurrent || isCompleted
                        ? 'bold'
                        : 'normal',
                    color:
                      isCurrent
                        ? '#222'
                        : isCompleted
                        ? '#555'
                        : '#999',
                  }}
                >
                  {step.label}
                </div>

                {isCurrent && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#777',
                      marginTop: 2,
                    }}
                  >
                    {step.key === 'placed' &&
                      'Your order has been received.'}

                    {step.key === 'preparing' &&
                      'The kitchen is preparing your food.'}

                    {step.key === 'ready' &&
                      'Your order is ready.'}

                    {step.key === 'completed' &&
                      'Enjoy your meal!'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------
// CUSTOMER MENU
// --------------------------------------------------

export default function CustomerMenu({
  restaurantId,
  tableId,
}) {
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] =
    useState('All');
  const [showCart, setShowCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --------------------------------------------------
  // CUSTOMER ORDER VISIBILITY
  // --------------------------------------------------
  // Only show orders that are still active in the kitchen.
  // Completed/delivered orders are historical and should not
  // appear as if they are still being tracked.
  const isActiveCustomerOrder = (order) => {
    const status = String(order?.status || '').toLowerCase();

    return ['placed', 'preparing', 'ready'].includes(status);
  };

  // --------------------------------------------------
  // LOAD MENU + ORDERS + SOCKET
  // --------------------------------------------------

  useEffect(() => {
    // Load restaurant branding/settings
    api.getRestaurant(restaurantId).then((result) => {
      if (result && !result.error) {
        setRestaurant(result);
      }
    });

    // Load menu
    api.getMenu(restaurantId).then((result) => {
      if (Array.isArray(result)) {
        setMenu(result);
      }
    });

    // Load existing active orders
    api
      .getTableOrders(restaurantId, tableId)
      .then((result) => {
        if (Array.isArray(result)) {
          setOrders(
            result.filter(isActiveCustomerOrder)
          );
        }
      });

    const socket = io(
      import.meta.env.VITE_SOCKET_URL ||
        'http://localhost:4000'
    );

    // Join restaurant room for menu updates
    socket.emit(
      'join_restaurant',
      restaurantId
    );

    // Join table room for order updates
    socket.emit('join_table', tableId);

    // ------------------------------------------------
    // MENU ITEM ADDED
    // ------------------------------------------------

    socket.on(
      'menu_item_added',
      (newItem) => {
        setMenu((prev) => {
          const alreadyExists = prev.some(
            (item) =>
              item.id === newItem.id
          );

          if (alreadyExists) {
            return prev;
          }

          return [...prev, newItem].sort(
            (a, b) => {
              const categoryCompare =
                (a.category || '').localeCompare(
                  b.category || ''
                );

              if (categoryCompare !== 0) {
                return categoryCompare;
              }

              return a.name.localeCompare(
                b.name
              );
            }
          );
        });
      }
    );

    // ------------------------------------------------
    // MENU ITEM UPDATED
    // ------------------------------------------------

    socket.on(
      'menu_item_updated',
      (updatedItem) => {
        setMenu((prev) =>
          prev.map((item) =>
            item.id === updatedItem.id
              ? updatedItem
              : item
          )
        );

        setCart((prev) =>
          prev.map((cartItem) =>
            cartItem.menu_item_id ===
            updatedItem.id
              ? {
                  ...cartItem,
                  name: updatedItem.name,
                  price: updatedItem.price,
                }
              : cartItem
          )
        );
      }
    );

    // ------------------------------------------------
    // MENU ITEM DELETED
    // ------------------------------------------------

    socket.on(
      'menu_item_deleted',
      (deletedItem) => {
        setMenu((prev) =>
          prev.filter(
            (item) =>
              item.id !== deletedItem.id
          )
        );

        setCart((prev) =>
          prev.filter(
            (item) =>
              item.menu_item_id !==
              deletedItem.id
          )
        );
      }
    );

    // ------------------------------------------------
    // NEW ORDER CREATED
    // ------------------------------------------------

    socket.on(
      'order_created',
      (newOrder) => {
        if (!isActiveCustomerOrder(newOrder)) {
          return;
        }

        setOrders((prev) => {
          const alreadyExists = prev.some(
            (order) =>
              order.order_id ===
              newOrder.order_id
          );

          if (alreadyExists) {
            return prev;
          }

          return [...prev, newOrder];
        });
      }
    );

    // ------------------------------------------------
    // ORDER STATUS UPDATED
    // ------------------------------------------------

    socket.on(
      'order_status_updated',
      (updatedOrder) => {
        setOrders((prev) => {
          // Find the exact order by order_id.
          // A status change for Order #27 must never
          // change Order #26.
          const matchingOrder = prev.find(
            (order) =>
              order.order_id ===
              updatedOrder.order_id
          );

          if (!matchingOrder) {
            // If this is an active order that was not in
            // the current state yet, add it.
            if (
              isActiveCustomerOrder(updatedOrder)
            ) {
              return [...prev, updatedOrder];
            }

            return prev;
          }

          // Completed/delivered orders are no longer
          // active customer orders.
          if (
            !isActiveCustomerOrder(updatedOrder)
          ) {
            return prev.filter(
              (order) =>
                order.order_id !==
                updatedOrder.order_id
            );
          }

          // Update ONLY the matching order.
          return prev.map((order) =>
            order.order_id ===
            updatedOrder.order_id
              ? {
                  ...order,
                  ...updatedOrder,
                }
              : order
          );
        });
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [restaurantId, tableId]);

  // --------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------

  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        menu
          .map((item) => item.category)
          .filter(Boolean)
      ),
    ];

    return ['All', ...uniqueCategories];
  }, [menu]);

  // --------------------------------------------------
  // GROUP MENU
  // --------------------------------------------------

  const groupedMenu = useMemo(() => {
    const groups = {};

    menu.forEach((item) => {
      const category =
        item.category || 'Other';

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(item);
    });

    return groups;
  }, [menu]);

  const visibleCategories =
    selectedCategory === 'All'
      ? Object.keys(groupedMenu)
      : Object.keys(groupedMenu).filter(
          (category) =>
            category === selectedCategory
        );

  // --------------------------------------------------
  // CART HELPERS
  // --------------------------------------------------

  const getItemQuantity = (
    menuItemId
  ) => {
    const cartItem = cart.find(
      (item) =>
        item.menu_item_id === menuItemId
    );

    return cartItem
      ? cartItem.quantity
      : 0;
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find(
        (c) =>
          c.menu_item_id === item.id
      );

      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id
            ? {
                ...c,
                quantity:
                  c.quantity + 1,
              }
            : c
        );
      }

      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          note: '',
        },
      ];
    });
  };

  const removeFromCart = (
    menuItemId
  ) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.menu_item_id ===
          menuItemId
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  };

  const removeItemCompletely = (
    menuItemId
  ) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          item.menu_item_id !==
          menuItemId
      )
    );
  };

  const updateNote = (
    menuItemId,
    note
  ) => {
    setCart((prev) =>
      prev.map((item) =>
        item.menu_item_id ===
        menuItemId
          ? {
              ...item,
              note,
            }
          : item
      )
    );
  };

  // --------------------------------------------------
  // PLACE ORDER
  // --------------------------------------------------

  const submitOrder = async () => {
    if (!cart.length) {
      return;
    }

    const result =
      await api.placeOrder(
        restaurantId,
        tableId,
        cart
      );

    if (result.error) {
      console.error(
        result.error
      );
      return;
    }

    // The backend returns the exact
    // newly-created order.
    if (isActiveCustomerOrder(result)) {
      setOrders((prev) => {
        const alreadyExists = prev.some(
          (order) =>
            order.order_id ===
            result.order_id
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, result];
      });
    }

    setCart([]);
    setShowCart(false);
  };

  // --------------------------------------------------
  // CALL STAFF
  // --------------------------------------------------

  const handleCallStaff = async () => {
    const result =
      await api.callStaff(
        restaurantId,
        tableId
      );

    if (result.error) {
      console.error(
        result.error
      );
      return;
    }

    console.log(
      `Staff called for Table ${tableId}`
    );
  };

  // --------------------------------------------------
  // CART TOTALS
  // --------------------------------------------------

  const total = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price) *
        item.quantity,
    0
  );

  const totalItems = cart.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  // --------------------------------------------------
  // PREMIUM UI
  // --------------------------------------------------

  const brandColor = restaurant?.primary_color || '#0F5A4F';

  const hexToRgb = (hex) => {
    const clean = String(hex || '').replace('#', '');

    if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
      return null;
    }

    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  };

  const brandRgb = hexToRgb(brandColor) || {
    r: 15,
    g: 90,
    b: 79,
  };

  const brandTint = `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, 0.045)`;
  const brandSoft = `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, 0.10)`;
  const brandGlow = `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, 0.18)`;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredGroupedMenu = useMemo(() => {
    const result = {};

    Object.entries(groupedMenu).forEach(
      ([category, items]) => {
        const filtered = normalizedSearch
          ? items.filter((item) => {
              const haystack = [
                item.name,
                item.description,
                item.category,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              return haystack.includes(normalizedSearch);
            })
          : items;

        if (filtered.length > 0) {
          result[category] = filtered;
        }
      }
    );

    return result;
  }, [groupedMenu, normalizedSearch]);

  const displayedCategories = Object.keys(filteredGroupedMenu).filter(
    (category) =>
      selectedCategory === 'All' ||
      category === selectedCategory
  );

  const visibleItemCount = displayedCategories.reduce(
    (count, category) =>
      count + filteredGroupedMenu[category].length,
    0
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `
              radial-gradient(circle at 88% 12%, ${brandSoft}, transparent 22%),
              linear-gradient(180deg, #f7f8f1 0%, ${brandTint} 48%, #f8f8f5 100%)
        `,
        color: '#171C1A',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        paddingBottom: cart.length > 0 ? 105 : 40,
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #F7F8F7;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .premium-shell {
          width: 100%;
        }

        /* -------------------------------------------
           HERO
        ------------------------------------------- */

        .premium-hero {
          position: relative;
          width: 100%;
          height: clamp(180px, 20vw, 250px);
          overflow: hidden;
          background: #173C36;
        }

        .premium-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          transform: scale(1.015);
        }

        .premium-hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              rgba(0,0,0,.04) 0%,
              rgba(0,0,0,.02) 42%,
              rgba(0,0,0,.42) 100%
            );
        }

        .premium-hero-fallback {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              circle at 20% 20%,
              rgba(255,255,255,.08),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              #123F37,
              #102B27
            );
        }

        /* -------------------------------------------
           BRAND CARD
        ------------------------------------------- */

        .premium-brand {
          position: relative;
          z-index: 5;
          background: white;
          border-radius: 0 0 14px 14px;
          box-shadow: 0 7px 20px rgba(20,40,35,.08);
        }

        .premium-brand-inner {
          width: min(1000px, calc(100% - 48px));
          margin: 0 auto;
          padding: 0 0 13px;
        }

        .premium-logo-wrap {
          width: 94px;
          height: 94px;
          margin-top: -47px;
          position: relative;
        }

        .premium-logo {
          width: 94px;
          height: 94px;
          display: block;
          object-fit: cover;
          border-radius: 17px;
          border: 3px solid white;
          background: white;
          box-shadow:
            0 10px 25px rgba(0,0,0,.17),
            0 2px 5px rgba(0,0,0,.06);
        }

        .premium-brand-main {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-top: 7px;
        }

        .premium-brand-name {
          margin: 0;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -.4px;
          font-weight: 850;
          font-family: Georgia, 'Times New Roman', serif;
        }

        .premium-brand-description {
          margin-top: 3px;
          max-width: 720px;
          color: #68706D;
          font-size: 12px;
          line-height: 1.4;
        }

        .premium-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .premium-meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: 100%;
          min-height: 27px;
          padding: 5px 9px;
          border-radius: 999px;
          background: #F4F6F5;
          color: #39413E;
          font-size: 10px;
          font-weight: 700;
        }

        .premium-address {
          max-width: 820px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* -------------------------------------------
           STICKY NAV
        ------------------------------------------- */

        .premium-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(0,0,0,.07);
          box-shadow: 0 5px 18px rgba(0,0,0,.06);
        }

        .premium-nav-inner {
          width: min(1000px, calc(100% - 48px));
          min-height: 56px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .premium-categories {
          display: flex;
          align-items: center;
          gap: 7px;
          overflow-x: auto;
          flex: 1;
          min-width: 0;
          padding: 8px 0;
          scrollbar-width: none;
        }

        .premium-categories::-webkit-scrollbar {
          display: none;
        }

        .premium-category {
          flex: 0 0 auto;
          border-radius: 999px;
          min-height: 34px;
          padding: 0 13px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 800;
          transition:
            transform .15s ease,
            box-shadow .15s ease,
            background .15s ease;
          -webkit-appearance: none;
        }

        .premium-category:active {
          transform: scale(.96);
        }

        .premium-search {
          flex: 0 0 250px;
          position: relative;
        }

        .premium-search input {
          width: 100%;
          height: 34px;
          border: 1px solid #DDE2DF;
          border-radius: 999px;
          padding: 0 16px 0 42px;
          background: #FAFBFA;
          color: #1D2421;
          outline: none;
          font-size: 12px;
          transition: .15s ease;
        }

        .premium-search input:focus {
          background: white;
          border-color: ${brandColor};
          box-shadow: 0 0 0 4px ${brandGlow};
        }

        .premium-search-icon {
          position: absolute;
          left: 15px;
          top: 7px;
          font-size: 16px;
          color: #727A77;
          pointer-events: none;
        }

        /* -------------------------------------------
           CONTENT
        ------------------------------------------- */

        .premium-content {
          width: min(1000px, calc(100% - 48px));
          margin: 0 auto;
          padding: 25px 0 70px;
        }

        .premium-menu-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .premium-menu-title {
          margin: 0;
          font-size: 30px;
          line-height: 1;
          letter-spacing: -.4px;
          font-weight: 850;
          font-family: Georgia, 'Times New Roman', serif;
        }

        .premium-menu-count {
          color: #737A77;
          font-size: 12px;
          font-weight: 700;
        }

        .premium-category-section {
          margin-bottom: 31px;
        }

        .premium-category-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 11px;
        }

        .premium-category-title {
          margin: 0;
          font-size: 18px;
          line-height: 1.15;
          letter-spacing: 0;
          font-weight: 850;
          font-family: Georgia, 'Times New Roman', serif;
        }

        .premium-category-subtitle {
          margin-top: 5px;
          color: #7A817E;
          font-size: 11px;
          line-height: 1.4;
        }

        .premium-see-all {
          border: none;
          background: transparent;
          color: ${brandColor};
          padding: 5px 0;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
        }

        /* -------------------------------------------
           FOOD CARDS
        ------------------------------------------- */

        .premium-food-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .premium-food-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          background: white;
          border: 1px solid rgba(24,39,34,.075);
          border-radius: 12px;
          box-shadow:
            0 5px 18px rgba(21,43,37,.055),
            0 1px 2px rgba(21,43,37,.035);
          transition:
            transform .18s ease,
            box-shadow .18s ease;
          isolation: isolate;
        }

        .premium-food-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 28px rgba(21,43,37,.09),
            0 2px 4px rgba(21,43,37,.04);
        }

        .premium-food-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1.58 / 1;
          overflow: hidden;
          background: #ECEFEE;
        }

        .premium-food-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .premium-food-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9AA09D;
          background:
            linear-gradient(
              135deg,
              #F0F2F1,
              #E8EBE9
            );
          font-size: 12px;
          font-weight: 750;
          letter-spacing: .02em;
        }

        .premium-food-badge {
          position: absolute;
          left: 11px;
          top: 11px;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.94);
          color: ${brandColor};
          box-shadow: 0 4px 12px rgba(0,0,0,.13);
          font-size: 10px;
          font-weight: 900;
          backdrop-filter: blur(8px);
        }

        .premium-food-body {
          padding: 10px;
        }

        .premium-food-name {
          margin: 0;
          font-size: 13px;
          line-height: 1.25;
          font-weight: 850;
          letter-spacing: -.15px;
          font-family: Georgia, 'Times New Roman', serif;
        }

        .premium-food-description {
          margin: 4px 0 0;
          min-height: 30px;
          color: #777F7B;
          font-size: 10px;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .premium-food-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
          margin-top: 9px;
        }

        .premium-price {
          font-size: 13px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
        }

        .premium-add {
          min-height: 30px;
          padding: 0 10px;
          border: none;
          border-radius: 10px;
          background: ${brandColor};
          color: white;
          cursor: pointer;
          font-size: 10px;
          font-weight: 850;
          box-shadow: 0 5px 12px ${brandGlow};
        }

        .premium-add:active {
          transform: scale(.96);
        }

        .premium-qty {
          display: flex;
          align-items: center;
          height: 30px;
          overflow: hidden;
          border: 1px solid ${brandColor};
          border-radius: 10px;
          background: white;
        }

        .premium-qty button {
          width: 27px;
          height: 30px;
          border: none;
          background: white;
          color: ${brandColor};
          cursor: pointer;
          font-size: 18px;
          font-weight: 900;
        }

        .premium-qty span {
          min-width: 22px;
          text-align: center;
          font-size: 12px;
          font-weight: 900;
        }

        .premium-sold {
          padding: 7px 10px;
          border-radius: 999px;
          background: #FFF0F0;
          color: #C62828;
          font-size: 10px;
          font-weight: 900;
        }

        /* -------------------------------------------
           ORDERS + CART
        ------------------------------------------- */

        .premium-panel {
          background: white;
          border: 1px solid rgba(24,39,34,.075);
          border-radius: 19px;
          box-shadow: 0 5px 18px rgba(21,43,37,.055);
          padding: 19px;
          margin-bottom: 24px;
        }

        .premium-panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 12px;
        }

        .premium-panel-title {
          margin: 0;
          font-size: 20px;
          font-weight: 850;
        }

        .premium-panel-count {
          color: ${brandColor};
          font-size: 11px;
          font-weight: 900;
        }

        .premium-cart-item {
          padding: 14px 0;
          border-bottom: 1px solid #EDF0EE;
        }

        .premium-cart-item:last-child {
          border-bottom: none;
        }

        .premium-cart-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .premium-cart-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }

        .premium-small-button {
          width: 34px;
          height: 34px;
          border: 1px solid #DDE2DF;
          border-radius: 9px;
          background: white;
          cursor: pointer;
          font-size: 18px;
        }

        .premium-remove {
          margin-left: auto;
          border: none;
          background: transparent;
          color: #D32F2F;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }

        .premium-note {
          width: 100%;
          margin-top: 9px;
          padding: 10px 11px;
          border: 1px solid #DDE2DF;
          border-radius: 9px;
          outline: none;
          font-size: 12px;
        }

        .premium-primary-action {
          width: 100%;
          min-height: 46px;
          margin-top: 15px;
          border: none;
          border-radius: 11px;
          background: ${brandColor};
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 850;
          box-shadow: 0 6px 15px ${brandGlow};
          transition: transform .15s ease, filter .15s ease;
        }

        .premium-primary-action:hover,
        .premium-view-cart:hover,
        .premium-add:hover,
        .premium-sticky-order:hover {
          filter: brightness(.94);
        }

        .premium-primary-action:active,
        .premium-view-cart:active,
        .premium-add:active,
        .premium-sticky-order:active {
          transform: translateY(1px);
        }

        .premium-staff {
          width: 100%;
          min-height: 44px;
          border: 1px solid #E8B2B2;
          border-radius: 11px;
          background: white;
          color: #C62828;
          cursor: pointer;
          font-size: 13px;
          font-weight: 850;
        }

        /* -------------------------------------------
           STICKY CART
        ------------------------------------------- */

        .premium-sticky-cart {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 80;
          padding: 10px 16px;
          background: rgba(255,255,255,.96);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-top: 1px solid rgba(0,0,0,.08);
          box-shadow: 0 -9px 28px rgba(0,0,0,.12);
        }

        .premium-sticky-inner {
          width: min(1000px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .premium-cart-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: ${brandColor};
          color: white;
          font-size: 19px;
          box-shadow: 0 5px 14px ${brandGlow};
        }

        .premium-cart-summary {
          flex: 1;
          min-width: 0;
        }

        .premium-cart-label {
          color: #747B78;
          font-size: 11px;
          font-weight: 650;
        }

        .premium-cart-total {
          margin-top: 2px;
          font-size: 19px;
          font-weight: 900;
        }

        .premium-view-cart {
          min-height: 42px;
          padding: 0 18px;
          border: none;
          border-radius: 11px;
          background: ${brandColor};
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
        }

        .premium-sticky-order {
          min-height: 42px;
          padding: 0 18px;
          border: none;
          border-radius: 11px;
          background: ${brandColor};
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          box-shadow: 0 5px 14px ${brandGlow};
        }

        .premium-quick-cart {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 64px;
          z-index: 79;
          max-height: 68vh;
          overflow-y: auto;
          padding: 17px;
          background: white;
          border-top: 1px solid #DDE2DF;
          box-shadow: 0 -10px 30px rgba(0,0,0,.15);
        }

        .premium-quick-inner {
          width: min(760px, 100%);
          margin: 0 auto;
        }

        /* -------------------------------------------
           RESPONSIVE
        ------------------------------------------- */

        @media (max-width: 900px) {
          .premium-food-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .premium-search {
            flex: 0 0 220px;
          }
        }

        @media (max-width: 700px) {
          .premium-hero {
            height: 205px;
          }

          .premium-brand-inner,
          .premium-nav-inner,
          .premium-content {
            width: min(100% - 24px, 760px);
          }

          .premium-brand-inner {
            padding-bottom: 20px;
          }

          .premium-logo-wrap,
          .premium-logo {
            width: 82px;
            height: 82px;
          }

          .premium-logo-wrap {
            margin-top: -41px;
          }

          .premium-brand-name {
            font-size: 27px;
          }

          .premium-nav-inner {
            display: block;
          }

          .premium-categories {
            padding-bottom: 7px;
          }

          .premium-search {
            width: 100%;
            padding-bottom: 10px;
          }

          .premium-search input {
            height: 40px;
          }

          .premium-content {
            padding-top: 25px;
          }

          .premium-menu-title {
            font-size: 30px;
          }
        }

        @media (max-width: 520px) {
          .premium-hero {
            height: 190px;
          }

          .premium-brand-inner {
            width: calc(100% - 24px);
          }

          .premium-content {
            width: calc(100% - 24px);
          }

          .premium-nav-inner {
            width: calc(100% - 24px);
          }

          .premium-brand-name {
            font-size: 22px;
          }

          .premium-meta-pill {
            font-size: 11px;
          }

          .premium-address {
            max-width: calc(100vw - 24px);
          }

          .premium-food-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .premium-food-image-wrap {
            aspect-ratio: 1.12 / 1;
          }

          .premium-food-body {
            padding: 11px;
          }

          .premium-food-name {
            font-size: 13px;
          }

          .premium-food-description {
            font-size: 11px;
            min-height: 33px;
          }

          .premium-price {
            font-size: 15px;
          }

          .premium-add {
            min-height: 34px;
            padding: 0 11px;
            font-size: 11px;
          }

          .premium-qty {
            height: 34px;
          }

          .premium-qty button {
            width: 29px;
            height: 34px;
          }

          .premium-menu-header {
            margin-bottom: 24px;
          }

          .premium-category-section {
            margin-bottom: 32px;
          }

          .premium-menu-header {
            align-items: flex-start;
          }

          .premium-menu-count {
            padding-top: 5px;
            text-align: right;
          }

          .premium-sticky-inner {
            gap: 9px;
          }

          .premium-cart-icon {
            width: 40px;
            height: 40px;
          }

          .premium-view-cart {
            padding: 0 13px;
          }

          .premium-sticky-order {
            padding: 0 13px;
          }
        }

        @media (max-width: 380px) {
          .premium-food-grid {
            grid-template-columns: 1fr;
          }

          .premium-food-image-wrap {
            aspect-ratio: 1.5 / 1;
          }
        }
      `}</style>

      <div
        className="premium-shell"
        style={{
          '--brand': brandColor,
        }}
      >
        {/* ---------------------------------------- */}
        {/* RESTAURANT HERO */}
        {/* ---------------------------------------- */}

        <section className="premium-hero">
          {restaurant?.cover_image_url ? (
            <img
              src={restaurant.cover_image_url}
              alt=""
              className="premium-hero-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none';

                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display =
                    'block';
                }
              }}
            />
          ) : null}

          <div
            className="premium-hero-fallback"
            style={{
              display: restaurant?.cover_image_url
                ? 'none'
                : 'block',
            }}
          />

          <div className="premium-hero-overlay" />
        </section>

        {/* ---------------------------------------- */}
        {/* RESTAURANT BRAND */}
        {/* ---------------------------------------- */}

        <section className="premium-brand">
          <div className="premium-brand-inner">
            {restaurant?.logo_url && (
              <div className="premium-logo-wrap">
                <img
                  src={restaurant.logo_url}
                  alt={`${restaurant?.name || 'Restaurant'} logo`}
                  className="premium-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className="premium-brand-main">
              <div style={{ minWidth: 0 }}>
                <h1
                  className="premium-brand-name"
                  style={{
                    color: brandColor,
                  }}
                >
                  {restaurant?.name || 'Restaurant Menu'}
                </h1>

                {restaurant?.description && (
                  <div className="premium-brand-description">
                    {restaurant.description}
                  </div>
                )}

                <div className="premium-meta">
                  <span className="premium-meta-pill">
                    🍽️ Table {tableId}
                  </span>

                  {restaurant?.phone && (
                    <span className="premium-meta-pill">
                      📞 {restaurant.phone}
                    </span>
                  )}
                </div>

                {restaurant?.address && (
                  <div className="premium-meta">
                    <span
                      className="premium-meta-pill premium-address"
                      title={restaurant.address}
                    >
                      📍 {restaurant.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------- */}
        {/* STICKY CATEGORY NAVIGATION */}
        {/* ---------------------------------------- */}

        <nav className="premium-nav">
          <div className="premium-nav-inner">
            <div className="premium-categories">
              {categories.map((category) => {
                const selected =
                  selectedCategory === category;

                return (
                  <button
                    key={category}
                    className="premium-category"
                    onClick={() =>
                      setSelectedCategory(category)
                    }
                    style={{
                      border: `1px solid ${
                        selected
                          ? brandColor
                          : '#DDE2DF'
                      }`,
                      background: selected
                        ? brandColor
                        : 'white',
                      color: selected
                        ? 'white'
                        : '#333',
                      boxShadow: selected
                        ? `0 4px 12px ${brandGlow}`
                        : 'none',
                    }}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="premium-search">
              <span className="premium-search-icon">
                🔍
              </span>

              <input
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                placeholder="Search menu..."
              />
            </div>
          </div>
        </nav>

        <main className="premium-content">
          {/* -------------------------------------- */}
          {/* ACTIVE ORDERS */}
          {/* -------------------------------------- */}

          {orders.length > 0 && (
            <section className="premium-panel">
              <div className="premium-panel-heading">
                <h2 className="premium-panel-title">
                  Your Active Orders
                </h2>

                <span className="premium-panel-count">
                  {orders.length}{' '}
                  {orders.length === 1
                    ? 'order'
                    : 'orders'}
                </span>
              </div>

              {orders.map((order) => (
                <OrderStatusCard
                  key={order.order_id}
                  order={order}
                />
              ))}
            </section>
          )}

          {/* -------------------------------------- */}
          {/* MENU HEADER */}
          {/* -------------------------------------- */}

          <div className="premium-menu-header">
            <h2 className="premium-menu-title">
              Menu
            </h2>

            <span className="premium-menu-count">
              {normalizedSearch
                ? `${visibleItemCount} result${
                    visibleItemCount === 1
                      ? ''
                      : 's'
                  }`
                : `${visibleItemCount} items`}
            </span>
          </div>

          {/* -------------------------------------- */}
          {/* MENU */}
          {/* -------------------------------------- */}

          {displayedCategories.length === 0 ? (
            <div className="premium-panel">
              <div
                style={{
                  padding: '30px 10px',
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                <div
                  style={{
                    fontSize: 30,
                    marginBottom: 8,
                  }}
                >
                  🔎
                </div>

                <strong>
                  No menu items found
                </strong>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                  }}
                >
                  Try a different search.
                </div>
              </div>
            </div>
          ) : (
            displayedCategories.map((category) => (
              <section
                key={category}
                className="premium-category-section"
              >
                <div className="premium-category-heading">
                  <div>
                    <h3 className="premium-category-title">
                      {category}
                    </h3>

                    <div className="premium-category-subtitle">
                      {category === 'Desserts'
                        ? 'Sweet endings to your meal'
                        : category === 'Drinks'
                        ? 'Refreshing favourites'
                        : category === 'Starters'
                        ? 'A delicious start'
                        : category === 'Main Course'
                        ? 'Hearty favourites made to order'
                        : 'Made fresh for you'}
                    </div>
                  </div>

                  <button
                    className="premium-see-all"
                    onClick={() => {
                      setSelectedCategory(category);
                      setSearchTerm('');
                    }}
                  >
                    See all →
                  </button>
                </div>

                <div className="premium-food-grid">
                  {filteredGroupedMenu[category].map(
                    (item, itemIndex) => {
                      const quantity =
                        getItemQuantity(item.id);

                      return (
                        <article
                          key={item.id}
                          className="premium-food-card"
                          style={{
                            opacity:
                              item.is_available
                                ? 1
                                : 0.62,
                          }}
                        >
                          <div className="premium-food-image-wrap">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="premium-food-image"
                                onError={(e) => {
                                  e.currentTarget.style.display =
                                    'none';

                                  if (
                                    e.currentTarget
                                      .nextSibling
                                  ) {
                                    e.currentTarget.nextSibling.style.display =
                                      'flex';
                                  }
                                }}
                              />
                            ) : null}

                            <div
                              className="premium-food-placeholder"
                              style={{
                                display: item.image_url
                                  ? 'none'
                                  : 'flex',
                              }}
                            >
                              No image
                            </div>

                            {itemIndex === 0 &&
                              item.is_available && (
                                <span className="premium-food-badge">
                                  ★ Featured
                                </span>
                              )}
                          </div>

                          <div className="premium-food-body">
                            <h4 className="premium-food-name">
                              {item.name}
                            </h4>

                            {item.description && (
                              <p className="premium-food-description">
                                {item.description}
                              </p>
                            )}

                            <div className="premium-food-bottom">
                              <strong className="premium-price">
                                ₹{item.price}
                              </strong>

                              {!item.is_available ? (
                                <span className="premium-sold">
                                  Sold Out
                                </span>
                              ) : quantity === 0 ? (
                                <button
                                  className="premium-add"
                                  onClick={() =>
                                    addToCart(item)
                                  }
                                >
                                  + Add
                                </button>
                              ) : (
                                <div className="premium-qty">
                                  <button
                                    onClick={() =>
                                      removeFromCart(
                                        item.id
                                      )
                                    }
                                    aria-label={`Decrease ${item.name}`}
                                  >
                                    −
                                  </button>

                                  <span>
                                    {quantity}
                                  </span>

                                  <button
                                    onClick={() =>
                                      addToCart(item)
                                    }
                                    aria-label={`Increase ${item.name}`}
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            ))
          )}

          {/* -------------------------------------- */}
          {/* CART */}
          {/* -------------------------------------- */}

          <section className="premium-panel">
            <div className="premium-panel-heading">
              <h2 className="premium-panel-title">
                Your Order
              </h2>

              {cart.length > 0 && (
                <span className="premium-panel-count">
                  {totalItems}{' '}
                  {totalItems === 1
                    ? 'item'
                    : 'items'}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <div
                style={{
                  padding: '22px 5px',
                  textAlign: 'center',
                  color: '#777',
                  fontSize: 13,
                }}
              >
                Your cart is empty.
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.menu_item_id}
                    className="premium-cart-item"
                  >
                    <div className="premium-cart-row">
                      <strong>
                        {item.name}
                      </strong>

                      <strong>
                        ₹
                        {Number(item.price) *
                          item.quantity}
                      </strong>
                    </div>

                    <div className="premium-cart-controls">
                      <button
                        className="premium-small-button"
                        onClick={() =>
                          removeFromCart(
                            item.menu_item_id
                          )
                        }
                      >
                        −
                      </button>

                      <strong
                        style={{
                          minWidth: 24,
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </strong>

                      <button
                        className="premium-small-button"
                        onClick={() =>
                          addToCart(item)
                        }
                      >
                        +
                      </button>

                      <button
                        className="premium-remove"
                        onClick={() =>
                          removeItemCompletely(
                            item.menu_item_id
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      className="premium-note"
                      placeholder="Add a note (e.g. less spicy)"
                      value={item.note}
                      onChange={(e) =>
                        updateNote(
                          item.menu_item_id,
                          e.target.value
                        )
                      }
                    />
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 16,
                    fontSize: 20,
                  }}
                >
                  <strong>Total</strong>
                  <strong>₹{total}</strong>
                </div>

                <button
                  className="premium-primary-action"
                  onClick={submitOrder}
                >
                  Place Order
                </button>
              </>
            )}
          </section>

          {/* -------------------------------------- */}
          {/* CALL STAFF */}
          {/* -------------------------------------- */}

          <button
            className="premium-staff"
            onClick={handleCallStaff}
          >
            🔔 Call Staff
          </button>
        </main>

        {/* ---------------------------------------- */}
        {/* STICKY CART */}
        {/* ---------------------------------------- */}

        {cart.length > 0 && (
          <div className="premium-sticky-cart">
            <div className="premium-sticky-inner">
              <div className="premium-cart-icon">
                🛒
              </div>

              <div className="premium-cart-summary">
                <div className="premium-cart-label">
                  {totalItems}{' '}
                  {totalItems === 1
                    ? 'item'
                    : 'items'}{' '}
                  in your order
                </div>

                <div className="premium-cart-total">
                  ₹{total}
                </div>
              </div>

              <button
                className="premium-view-cart"
                onClick={() =>
                  setShowCart(!showCart)
                }
              >
                {showCart
                  ? 'Hide Cart'
                  : 'View Cart'}{' '}
                →
              </button>

              <button
                className="premium-sticky-order"
                onClick={submitOrder}
              >
                Place Order →
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------- */}
        {/* QUICK CART */}
        {/* ---------------------------------------- */}

        {showCart && cart.length > 0 && (
          <div className="premium-quick-cart">
            <div className="premium-quick-inner">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                  }}
                >
                  Cart Summary
                </h3>

                <button
                  onClick={() =>
                    setShowCart(false)
                  }
                  style={{
                    width: 34,
                    height: 34,
                    border: 'none',
                    borderRadius: '50%',
                    background: '#F1F3F2',
                    cursor: 'pointer',
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>

              {cart.map((item) => (
                <div
                  key={item.menu_item_id}
                  className="premium-cart-item"
                >
                  <div className="premium-cart-row">
                    <div>
                      <strong>
                        {item.name}
                      </strong>

                      <div
                        style={{
                          marginTop: 4,
                          color: '#777',
                          fontSize: 12,
                        }}
                      >
                        {item.quantity} × ₹
                        {item.price}
                      </div>
                    </div>

                    <strong>
                      ₹
                      {Number(item.price) *
                        item.quantity}
                    </strong>
                  </div>

                  <div className="premium-cart-controls">
                    <button
                      className="premium-small-button"
                      onClick={() =>
                        removeFromCart(
                          item.menu_item_id
                        )
                      }
                    >
                      −
                    </button>

                    <strong>
                      {item.quantity}
                    </strong>

                    <button
                      className="premium-small-button"
                      onClick={() =>
                        addToCart(item)
                      }
                    >
                      +
                    </button>

                    <button
                      className="premium-remove"
                      onClick={() =>
                        removeItemCompletely(
                          item.menu_item_id
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  fontSize: 18,
                }}
              >
                <strong>Total</strong>
                <strong>₹{total}</strong>
              </div>

              <button
                className="premium-primary-action"
                onClick={() => {
                  setShowCart(false);

                  window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: 'smooth',
                  });
                }}
              >
                Go to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
