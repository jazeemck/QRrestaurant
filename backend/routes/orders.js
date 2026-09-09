const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');

// ==================================================
// HELPER: BUILD COMPLETE ORDER
// ==================================================

async function getCompleteOrder(orderId) {
  const result = await pool.query(
    `SELECT
       o.id AS order_id,
       o.session_id,
       o.status,
       o.created_at,
       o.payment_status,
       o.payment_method,
       o.paid_at,

       ts.table_id,

       t.restaurant_id,
       t.table_number,

       oi.id AS order_item_id,
       oi.menu_item_id,
       oi.quantity,
       oi.note,
       oi.status AS item_status,
       oi.unit_price,

       mi.name,
       mi.description,
       mi.price,
       mi.category,
       mi.image_url

     FROM orders o

     JOIN table_sessions ts
       ON ts.id = o.session_id

     JOIN tables t
       ON t.id = ts.table_id

     JOIN order_items oi
       ON oi.order_id = o.id

     JOIN menu_items mi
       ON mi.id = oi.menu_item_id

     WHERE o.id = $1

     ORDER BY oi.id ASC`,
    [orderId]
  );

  if (!result.rows.length) {
    return null;
  }

  const first = result.rows[0];

  return {
    id: first.order_id,
    order_id: first.order_id,

    session_id: first.session_id,

    table_id: first.table_id,
    table_number: first.table_number,
    restaurant_id: first.restaurant_id,

    status: first.status,
    created_at: first.created_at,

    items: result.rows.map((row) => ({
      order_item_id: row.order_item_id,
      menu_item_id: row.menu_item_id,

      name: row.name,
      description: row.description,

      price: row.price,
      category: row.category,
      image_url: row.image_url,

      quantity: row.quantity,
      note: row.note,

      item_status: row.item_status,
    })),
  };
}

// ==================================================
// CREATE ORDER
// RESTAURANT ID + TABLE NUMBER
// ==================================================

router.post(
  '/restaurant/:restaurantId/table/:tableNumber',
  async (req, res) => {
    const { restaurantId, tableNumber } =
      req.params;

    const { items } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Order must contain at least one item',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // --------------------------------------------
      // Find table
      // --------------------------------------------

      const tableResult = await client.query(
        `SELECT
           id,
           restaurant_id,
           table_number
         FROM tables
         WHERE restaurant_id = $1
           AND table_number = $2`,
        [
          restaurantId,
          tableNumber,
        ]
      );

      if (!tableResult.rows.length) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          error: 'Table not found',
        });
      }

      const table =
        tableResult.rows[0];

      // --------------------------------------------
      // Find active table session
      // --------------------------------------------

      let sessionResult =
        await client.query(
          `SELECT
             id,
             table_id,
             started_at,
             ended_at,
             is_active
           FROM table_sessions
           WHERE table_id = $1
             AND is_active = true
           ORDER BY started_at DESC
           LIMIT 1`,
          [table.id]
        );

      let session;

      // --------------------------------------------
      // Create session if necessary
      // --------------------------------------------

      if (
        !sessionResult.rows.length
      ) {
        sessionResult =
          await client.query(
            `INSERT INTO table_sessions
              (
                table_id,
                started_at,
                is_active
              )
             VALUES
              (
                $1,
                NOW(),
                true
              )
             RETURNING *`,
            [table.id]
          );

        session =
          sessionResult.rows[0];
      } else {
        session =
          sessionResult.rows[0];
      }

      // --------------------------------------------
      // Create order
      // --------------------------------------------

      const orderResult =
        await client.query(
          `INSERT INTO orders
            (
              session_id,
              status
            )
           VALUES
            (
              $1,
              'placed'
            )
           RETURNING *`,
          [session.id]
        );

      const order =
        orderResult.rows[0];

      // --------------------------------------------
      // Create order items
      // --------------------------------------------

      for (const item of items) {
        const menuItemResult =
          await client.query(
            `SELECT
               id
             FROM menu_items
             WHERE id = $1
               AND restaurant_id = $2`,
            [
              item.menu_item_id,
              restaurantId,
            ]
          );

        if (
          !menuItemResult.rows.length
        ) {
          throw new Error(
            `Menu item ${item.menu_item_id} not found`
          );
        }

        const quantity =
          Number(item.quantity);

        if (
          !Number.isInteger(
            quantity
          ) ||
          quantity <= 0
        ) {
          throw new Error(
            `Invalid quantity for menu item ${item.menu_item_id}`
          );
        }

        await client.query(
          `INSERT INTO order_items
            (
              order_id,
              menu_item_id,
              quantity,
              note,
              status
            )
           VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5
            )`,
          [
            order.id,
            item.menu_item_id,
            quantity,
            item.note || null,
            'placed',
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      // --------------------------------------------
      // Build complete order
      // --------------------------------------------

      const completeOrder =
        await getCompleteOrder(
          order.id
        );

      // --------------------------------------------
      // Send to kitchen
      // --------------------------------------------

      getIO()
        .to(
          `kitchen_${restaurantId}`
        )
        .emit(
          'new_order',
          completeOrder
        );

      // --------------------------------------------
      // Send to customer table
      // --------------------------------------------

      getIO()
        .to(
          `table_${table.table_number}`
        )
        .emit(
          'order_created',
          completeOrder
        );

      res.status(201).json(
        completeOrder
      );
    } catch (err) {
      await client.query(
        'ROLLBACK'
      );

      console.error(
        'Error placing order:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// ==================================================
// LEGACY CREATE ORDER
// INTERNAL TABLE ID
// ==================================================

router.post(
  '/table/:tableId',
  async (req, res) => {
    const { tableId } = req.params;

    const { items } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Order must contain at least one item',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // --------------------------------------------
      // Find table
      // --------------------------------------------

      const tableResult =
        await client.query(
          `SELECT
             id,
             restaurant_id,
             table_number
           FROM tables
           WHERE id = $1`,
          [tableId]
        );

      if (
        !tableResult.rows.length
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          error: 'Table not found',
        });
      }

      const table =
        tableResult.rows[0];

      // --------------------------------------------
      // Find active session
      // --------------------------------------------

      let sessionResult =
        await client.query(
          `SELECT *
           FROM table_sessions
           WHERE table_id = $1
             AND is_active = true
           ORDER BY started_at DESC
           LIMIT 1`,
          [table.id]
        );

      let session;

      if (
        sessionResult.rows.length
      ) {
        session =
          sessionResult.rows[0];
      } else {
        sessionResult =
          await client.query(
            `INSERT INTO table_sessions
              (
                table_id,
                started_at,
                is_active
              )
             VALUES
              (
                $1,
                NOW(),
                true
              )
             RETURNING *`,
            [table.id]
          );

        session =
          sessionResult.rows[0];
      }

      // --------------------------------------------
      // Create order
      // --------------------------------------------

      const orderResult =
        await client.query(
          `INSERT INTO orders
            (
              session_id,
              status
            )
           VALUES
            (
              $1,
              'placed'
            )
           RETURNING *`,
          [session.id]
        );

      const order =
        orderResult.rows[0];

      // --------------------------------------------
      // Add items
      // --------------------------------------------

      for (const item of items) {
        const menuResult =
          await client.query(
            `SELECT id
             FROM menu_items
             WHERE id = $1
               AND restaurant_id = $2`,
            [
              item.menu_item_id,
              table.restaurant_id,
            ]
          );

        if (
          !menuResult.rows.length
        ) {
          throw new Error(
            `Menu item ${item.menu_item_id} not found`
          );
        }

        const quantity =
          Number(item.quantity);

        if (
          !Number.isInteger(
            quantity
          ) ||
          quantity <= 0
        ) {
          throw new Error(
            `Invalid quantity for menu item ${item.menu_item_id}`
          );
        }

        await client.query(
          `INSERT INTO order_items
            (
              order_id,
              menu_item_id,
              quantity,
              note,
              status
            )
           VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5
            )`,
          [
            order.id,
            item.menu_item_id,
            quantity,
            item.note || null,
            'placed',
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      const completeOrder =
        await getCompleteOrder(
          order.id
        );

      getIO()
        .to(
          `kitchen_${table.restaurant_id}`
        )
        .emit(
          'new_order',
          completeOrder
        );

      getIO()
        .to(
          `table_${table.table_number}`
        )
        .emit(
          'order_created',
          completeOrder
        );

      res.status(201).json(
        completeOrder
      );
    } catch (err) {
      await client.query(
        'ROLLBACK'
      );

      console.error(
        'Error placing legacy order:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// ==================================================
// GET KITCHEN ORDERS
// ==================================================

router.get(
  '/kitchen/:restaurantId',
  async (req, res) => {
    const { restaurantId } =
      req.params;

    try {
      const result = await pool.query(
        `SELECT
           o.id AS order_id,
           o.session_id,
           o.status,
           o.created_at,

           ts.table_id,

           t.restaurant_id,
           t.table_number

         FROM orders o

         JOIN table_sessions ts
           ON ts.id = o.session_id

         JOIN tables t
           ON t.id = ts.table_id

         WHERE t.restaurant_id = $1

         ORDER BY
           o.created_at ASC`,
        [restaurantId]
      );

      const orders =
        await Promise.all(
          result.rows.map(
            async (order) => {
              const itemsResult =
                await pool.query(
                  `SELECT
                     oi.id AS order_item_id,
                     oi.menu_item_id,
                     oi.quantity,
                     oi.note,
                     oi.status AS item_status,

                     mi.name,
                     mi.description,
                     mi.price,
                     mi.category,
                     mi.image_url

                   FROM order_items oi

                   JOIN menu_items mi
                     ON mi.id =
                        oi.menu_item_id

                   WHERE oi.order_id = $1

                   ORDER BY oi.id ASC`,
                  [order.order_id]
                );

              return {
                id:
                  order.order_id,

                order_id:
                  order.order_id,

                session_id:
                  order.session_id,

                table_id:
                  order.table_id,

                table_number:
                  order.table_number,

                restaurant_id:
                  order.restaurant_id,

                status:
                  order.status,

                created_at:
                  order.created_at,

                items:
                  itemsResult.rows.map((item) => ({
                    ...item,
                    price: item.unit_price ?? item.price,
                    unit_price: item.unit_price ?? item.price,
                  })),
              };
            }
          )
        );

      res.json(
        orders
      );
    } catch (err) {
      console.error(
        'Error getting kitchen orders:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ==================================================
// GET COMPLETE BILL FOR ORDER
// ==================================================

router.get(
  '/bill/:orderId',
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const result = await pool.query(
        `
        SELECT
          o.id AS order_id,
          o.status,
          o.created_at,
          o.session_id,
          o.payment_status,
          o.payment_method,
          o.paid_at,

          ts.table_id,

          t.table_number,
          t.restaurant_id,

          r.name AS restaurant_name,
          r.logo_url,
          r.cover_image_url,
          r.description AS restaurant_description,
          r.phone,
          r.address,
          r.primary_color,

          oi.id AS order_item_id,
          oi.menu_item_id,
          oi.quantity,
          oi.note,
          oi.status AS item_status,
          oi.unit_price,

          mi.name,
          mi.category,
          mi.price AS current_menu_price
        FROM orders o
        JOIN table_sessions ts
          ON ts.id = o.session_id
        JOIN tables t
          ON t.id = ts.table_id
        JOIN restaurants r
          ON r.id = t.restaurant_id
        JOIN order_items oi
          ON oi.order_id = o.id
        JOIN menu_items mi
          ON mi.id = oi.menu_item_id
        WHERE o.id = $1
        ORDER BY oi.id ASC
        `,
        [orderId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Order not found',
        });
      }

      const first = result.rows[0];

      const items = result.rows.map((row) => {
        const unitPrice = Number(
          row.unit_price ?? row.current_menu_price ?? 0
        );
        const quantity = Number(row.quantity || 0);

        return {
          id: row.order_item_id,
          order_item_id: row.order_item_id,
          menu_item_id: row.menu_item_id,
          name: row.name,
          category: row.category,
          quantity,
          note: row.note,
          item_status: row.item_status,
          unit_price: unitPrice,
          price: unitPrice,
          item_total: Number(
            (unitPrice * quantity).toFixed(2)
          ),
        };
      });

      const subtotal = Number(
        items
          .reduce(
            (sum, item) => sum + item.item_total,
            0
          )
          .toFixed(2)
      );

      const tax = 0;
      const discount = 0;

      const grandTotal = Number(
        (subtotal + tax - discount).toFixed(2)
      );

      res.json({
        restaurant: {
          id: first.restaurant_id,
          name: first.restaurant_name,
          logo_url: first.logo_url,
          cover_image_url: first.cover_image_url,
          description:
            first.restaurant_description,
          phone: first.phone,
          address: first.address,
          primary_color: first.primary_color,
        },

        order: {
          id: first.order_id,
          order_number: first.order_id,
          status: first.status,
          created_at: first.created_at,
          session_id: first.session_id,
          table_id: first.table_id,
          table_number: first.table_number,
          payment_status:
            first.payment_status || 'unpaid',
          payment_method:
            first.payment_method || null,
          paid_at: first.paid_at || null,
          items,
        },

        totals: {
          subtotal,
          tax,
          discount,
          grand_total: grandTotal,
        },
      });
    } catch (err) {
      console.error(
        'Failed to generate bill:',
        err
      );

      res.status(500).json({
        error: 'Failed to generate bill.',
      });
    }
  }
);

// ==================================================
// GET BILLING ORDERS FOR RESTAURANT
// ==================================================


router.get(
  '/restaurant/:restaurantId/billing',
  async (req, res) => {
    try {
      const { restaurantId } = req.params;

      const result = await pool.query(
        `
        SELECT
          o.id,
          o.status,
          o.created_at,
          o.payment_status,
          o.payment_method,
          o.paid_at,
          t.table_number,
          COALESCE(
            SUM(
              oi.quantity *
              COALESCE(oi.unit_price, mi.price)
            ),
            0
          ) AS total
        FROM orders o
        JOIN table_sessions ts
          ON ts.id = o.session_id
        JOIN tables t
          ON t.id = ts.table_id
        LEFT JOIN order_items oi
          ON oi.order_id = o.id
        LEFT JOIN menu_items mi
          ON mi.id = oi.menu_item_id
        WHERE t.restaurant_id = $1
        GROUP BY
          o.id,
          o.status,
          o.created_at,
          o.payment_status,
          o.payment_method,
          o.paid_at,
          t.table_number
        ORDER BY o.created_at DESC
        `,
        [restaurantId]
      );

      res.json(
        result.rows.map((order) => ({
          id: order.id,
          status: order.status,
          created_at: order.created_at,
          table_number: order.table_number,
          total: Number(order.total || 0),
          payment_status:
            order.payment_status || 'unpaid',
          payment_method:
            order.payment_method || null,
          paid_at:
            order.paid_at || null,
        }))
      );
    } catch (err) {
      console.error(
        'Failed to fetch billing orders:',
        err
      );

      res.status(500).json({
        error: 'Failed to fetch billing orders',
      });
    }
  }
);

// ==================================================
// GET CUSTOMER ORDERS FOR TABLE
// ==================================================


router.get(
  '/restaurant/:restaurantId/table/:tableNumber',
  async (req, res) => {
    const {
      restaurantId,
      tableNumber,
    } = req.params;

    try {
      const tableResult =
        await pool.query(
          `SELECT
             id,
             restaurant_id,
             table_number
           FROM tables
           WHERE restaurant_id = $1
             AND table_number = $2`,
          [
            restaurantId,
            tableNumber,
          ]
        );

      if (
        !tableResult.rows.length
      ) {
        return res.status(404).json({
          error: 'Table not found',
        });
      }

      const result = await pool.query(
        `SELECT
           o.id AS order_id,
           o.session_id,
           o.status,
           o.created_at,

           ts.table_id,

           t.restaurant_id,
           t.table_number

         FROM orders o

         JOIN table_sessions ts
           ON ts.id = o.session_id

         JOIN tables t
           ON t.id = ts.table_id

         WHERE t.restaurant_id = $1
           AND t.table_number = $2

           AND o.status <> 'completed'

         ORDER BY
           o.created_at ASC`,
        [
          restaurantId,
          tableNumber,
        ]
      );

      const orders =
        await Promise.all(
          result.rows.map(
            async (order) => {
              const itemsResult =
                await pool.query(
                  `SELECT
                     oi.id AS order_item_id,
                     oi.menu_item_id,
                     oi.quantity,
                     oi.note,
                     oi.status AS item_status,

                     mi.name,
                     mi.description,
                     mi.price,
                     mi.category,
                     mi.image_url

                   FROM order_items oi

                   JOIN menu_items mi
                     ON mi.id =
                        oi.menu_item_id

                   WHERE oi.order_id = $1

                   ORDER BY oi.id ASC`,
                  [order.order_id]
                );

              return {
                id:
                  order.order_id,

                order_id:
                  order.order_id,

                session_id:
                  order.session_id,

                table_id:
                  order.table_id,

                table_number:
                  order.table_number,

                restaurant_id:
                  order.restaurant_id,

                status:
                  order.status,

                created_at:
                  order.created_at,

                items:
                  itemsResult.rows.map((item) => ({
                    ...item,
                    price: item.unit_price ?? item.price,
                    unit_price: item.unit_price ?? item.price,
                  })),
              };
            }
          )
        );

      res.json(
        orders
      );
    } catch (err) {
      console.error(
        'Error getting table orders:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ==================================================
// MARK ORDER PAYMENT AS COMPLETE
// ==================================================

router.patch(
  '/:orderId/payment',
  async (req, res) => {
    const { orderId } = req.params;
    const { payment_method } = req.body;

    const allowedPaymentMethods = [
      'cash',
      'upi',
      'card',
    ];

    const normalizedPaymentMethod =
      String(payment_method || '').toLowerCase();

    if (
      !allowedPaymentMethods.includes(
        normalizedPaymentMethod
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid payment method. Use cash, upi or card.',
      });
    }

    try {
      const orderResult = await pool.query(
        `
        SELECT
          id,
          status,
          payment_status
        FROM orders
        WHERE id = $1
        `,
        [orderId]
      );

      if (!orderResult.rows.length) {
        return res.status(404).json({
          error: 'Order not found',
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== 'completed') {
        return res.status(400).json({
          error:
            'Payment can only be completed after the order is completed.',
        });
      }

      if (order.payment_status === 'paid') {
        return res.status(400).json({
          error: 'This order has already been paid.',
        });
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET
          payment_status = 'paid',
          payment_method = $1,
          paid_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          payment_status,
          payment_method,
          paid_at
        `,
        [
          normalizedPaymentMethod,
          orderId,
        ]
      );

      const payment = result.rows[0];

      res.json({
        success: true,
        id: payment.id,
        payment_status:
          payment.payment_status,
        payment_method:
          payment.payment_method,
        paid_at: payment.paid_at,
      });
    } catch (err) {
      console.error(
        'Failed to complete payment:',
        err
      );

      res.status(500).json({
        error: 'Failed to complete payment.',
      });
    }
  }
);

// ==================================================
// UPDATE ORDER STATUS
// ==================================================


router.patch(
  '/:orderId/status',
  async (req, res) => {
    const { orderId } =
      req.params;

    const { status } =
      req.body;

    const allowedStatuses = [
      'placed',
      'preparing',
      'ready',
      'completed',
      'cancelled',
    ];

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid order status',
      });
    }

    try {
      // --------------------------------------------
      // Update order
      // --------------------------------------------

      const result =
        await pool.query(
          `UPDATE orders
           SET status = $1
           WHERE id = $2
           RETURNING *`,
          [
            status,
            orderId,
          ]
        );

      if (
        !result.rows.length
      ) {
        return res.status(404).json({
          error:
            'Order not found',
        });
      }

      const order =
        result.rows[0];

      // --------------------------------------------
      // Get table information
      // --------------------------------------------

      const tableResult =
        await pool.query(
          `SELECT
             t.id AS table_id,
             t.table_number,
             t.restaurant_id

           FROM orders o

           JOIN table_sessions ts
             ON ts.id =
                o.session_id

           JOIN tables t
             ON t.id =
                ts.table_id

           WHERE o.id = $1`,
          [order.id]
        );

      if (
        !tableResult.rows.length
      ) {
        return res.status(404).json({
          error:
            'Table information not found for order',
        });
      }

      const table =
        tableResult.rows[0];

      // --------------------------------------------
      // Update item statuses too
      // --------------------------------------------

      await pool.query(
        `UPDATE order_items
         SET status = $1
         WHERE order_id = $2`,
        [
          status,
          order.id,
        ]
      );

      // --------------------------------------------
      // Status event
      //
      // IMPORTANT:
      // order_id uniquely identifies the order.
      // --------------------------------------------

      const statusUpdate = {
        id:
          order.id,

        order_id:
          order.id,

        session_id:
          order.session_id,

        table_id:
          table.table_id,

        table_number:
          table.table_number,

        restaurant_id:
          table.restaurant_id,

        status:
          order.status,

        created_at:
          order.created_at,
      };

      // --------------------------------------------
      // Send to kitchen
      // --------------------------------------------

      getIO()
        .to(
          `kitchen_${table.restaurant_id}`
        )
        .emit(
          'order_status_updated',
          statusUpdate
        );

      // --------------------------------------------
      // Send to customer
      // --------------------------------------------

      getIO()
        .to(
          `table_${table.table_number}`
        )
        .emit(
          'order_status_updated',
          statusUpdate
        );

      res.json(
        statusUpdate
      );
    } catch (err) {
      console.error(
        'Error updating order status:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;