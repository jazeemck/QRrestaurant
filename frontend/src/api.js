const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = {
  // ==================================================
  // RESTAURANT
  // ==================================================

  getRestaurant: (restaurantId) =>
    fetch(`${BASE_URL}/restaurants/${restaurantId}`).then((r) =>
      r.json()
    ),

  updateRestaurant: (restaurantId, restaurant) =>
    fetch(`${BASE_URL}/restaurants/${restaurantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restaurant),
    }).then((r) => r.json()),

  // ==================================================
  // MENU
  // ==================================================

  getMenu: (restaurantId) =>
    fetch(`${BASE_URL}/menu/${restaurantId}`).then((r) =>
      r.json()
    ),

  placeOrder: (restaurantId, tableNumber, items) =>
    fetch(
      `${BASE_URL}/orders/restaurant/${restaurantId}/table/${tableNumber}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      }
    ).then((r) => r.json()),

  callStaff: (restaurantId, tableNumber) =>
    fetch(
      `${BASE_URL}/tables/restaurant/${restaurantId}/table/${tableNumber}/call-staff`,
      {
        method: 'POST',
      }
    ).then((r) => r.json()),

  // ==================================================
  // ORDERS
  // ==================================================

  getKitchenOrders: (restaurantId) =>
    fetch(`${BASE_URL}/orders/kitchen/${restaurantId}`).then((r) =>
      r.json()
    ),

  getTableOrders: (restaurantId, tableNumber) =>
    fetch(
      `${BASE_URL}/orders/restaurant/${restaurantId}/table/${tableNumber}`
    ).then((r) => r.json()),

  updateOrderStatus: (orderId, status) =>
    fetch(`${BASE_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    }).then((r) => r.json()),

  // ==================================================
  // MENU MANAGEMENT
  // ==================================================

  addMenuItem: (restaurantId, item) =>
    fetch(`${BASE_URL}/menu/${restaurantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    }).then((r) => r.json()),

  updateMenuItem: (itemId, item) =>
    fetch(`${BASE_URL}/menu/item/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    }).then((r) => r.json()),

  toggleItemAvailability: (itemId, is_available) =>
    fetch(`${BASE_URL}/menu/item/${itemId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_available }),
    }).then((r) => r.json()),

  deleteMenuItem: (itemId) =>
    fetch(`${BASE_URL}/menu/item/${itemId}`, {
      method: 'DELETE',
    }).then((r) => r.json()),

  // ==================================================
  // TABLE MANAGEMENT
  // ==================================================

  getTables: (restaurantId) =>
    fetch(`${BASE_URL}/tables/${restaurantId}`).then((r) =>
      r.json()
    ),

  addTable: (restaurantId, table_number) =>
    fetch(`${BASE_URL}/tables/${restaurantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ table_number }),
    }).then((r) => r.json()),

  // ==================================================
  // SALES
  // ==================================================

  // Get sales summary for a specific date
  // Returns:
  // - total_orders
  // - items_sold
  // - total_revenue
  // - average_order_value
  getSalesSummary: (restaurantId, date) =>
    fetch(
      `${BASE_URL}/sales/summary/${restaurantId}?date=${date}`
    ).then((r) => r.json()),

  // Get item-level sales for a specific date
  // Returns:
  // - menu_item_id
  // - name
  // - category
  // - quantity_sold
  // - revenue
  getSalesItems: (restaurantId, date) =>
    fetch(
      `${BASE_URL}/sales/items/${restaurantId}?date=${date}`
    ).then((r) => r.json()),

  // Get daily sales between two dates
  // Returns:
  // - sales_date
  // - order_count
  // - item_count
  // - revenue
  // - average_order_value
  getDailySales: (restaurantId, from, to) =>
    fetch(
      `${BASE_URL}/sales/daily/${restaurantId}?from=${from}&to=${to}`
    ).then((r) => r.json()),

  // Get top-selling items for a specific date
  getTopSellingItems: (
    restaurantId,
    date,
    limit = 5
  ) =>
    fetch(
      `${BASE_URL}/sales/top-items/${restaurantId}?date=${date}&limit=${limit}`
    ).then((r) => r.json()),
};