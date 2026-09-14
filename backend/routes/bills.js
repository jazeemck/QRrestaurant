const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function getBill(billId) {
  const result = await pool.query(
    `
    SELECT
      b.id AS bill_id,
      b.restaurant_id,
      b.table_id,
      b.session_id,
      b.status AS bill_status,
      b.payment_status,
      b.payment_method,
      b.created_at AS bill_created_at,
      b.paid_at,
      t.table_number,
      r.name AS restaurant_name,
      r.logo_url,
      r.cover_image_url,
      r.description,
      r.phone,
      r.address,
      o.id AS order_id,
      o.status AS order_status,
      o.created_at AS order_created_at,
      oi.id AS order_item_id,
      oi.menu_item_id,
      oi.quantity,
      oi.note,
      COALESCE(oi.unit_price, mi.price) AS unit_price,
      mi.name,
      mi.description AS item_description,
      mi.category,
      mi.image_url
    FROM bills b
    JOIN restaurants r
      ON r.id = b.restaurant_id
    JOIN tables t
      ON t.id = b.table_id
    JOIN orders o
      ON o.bill_id = b.id
    JOIN order_items oi
      ON oi.order_id = o.id
    JOIN menu_items mi
      ON mi.id = oi.menu_item_id
    WHERE b.id = $1
    ORDER BY o.created_at ASC, oi.id ASC
    `,
    [billId]
  );

  if (!result.rows.length) {
    return null;
  }

  const first = result.rows[0];
  const ordersMap = new Map();

  for (const row of result.rows) {
    if (!ordersMap.has(row.order_id)) {
      ordersMap.set(row.order_id, {
        id: row.order_id,
        order_number: row.order_id,
        status: row.order_status,
        created_at: row.order_created_at,
        items: [],
      });
    }

    ordersMap.get(row.order_id).items.push({
      order_item_id: row.order_item_id,
      menu_item_id: row.menu_item_id,
      name: row.name,
      description: row.item_description,
      category: row.category,
      image_url: row.image_url,
      quantity: Number(row.quantity || 0),
      note: row.note,
      unit_price: toMoney(row.unit_price),
      item_total: toMoney(
        Number(row.unit_price || 0) *
          Number(row.quantity || 0)
      ),
    });
  }

  const orders = Array.from(ordersMap.values());
  const items = orders.flatMap((order) => order.items);

  const subtotal = toMoney(
    items.reduce(
      (sum, item) =>
        sum + Number(item.item_total || 0),
      0
    )
  );

  return {
    id: first.bill_id,
    bill_id: first.bill_id,
    bill_number: first.bill_id,
    status: first.bill_status,
    payment_status:
      first.payment_status || 'unpaid',
    payment_method:
      first.payment_method || null,
    created_at: first.bill_created_at,
    paid_at: first.paid_at || null,

    restaurant: {
      id: first.restaurant_id,
      name: first.restaurant_name,
      logo_url: first.logo_url,
      cover_image_url: first.cover_image_url,
      description: first.description,
      phone: first.phone,
      address: first.address,
    },

    table: {
      id: first.table_id,
      table_number: first.table_number,
    },

    session_id: first.session_id,
    orders,
    items,

    totals: {
      subtotal,
      tax: 0,
      discount: 0,
      grand_total: subtotal,
    },
  };
}

// ==================================================
// GET UNBILLED ORDERS FOR STAFF
// ==================================================
router.get(
  '/restaurant/:restaurantId/unbilled-orders',
  async (req, res) => {
    const { restaurantId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          o.id AS order_id,
          o.session_id,
          o.status,
          o.created_at,
          o.payment_status,
          ts.table_id,
          t.restaurant_id,
          t.table_number,
          oi.id AS order_item_id,
          oi.menu_item_id,
          oi.quantity,
          oi.note,
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
        WHERE t.restaurant_id = $1
          AND o.bill_id IS NULL
          AND o.status <> 'cancelled'
          AND COALESCE(o.payment_status, 'unpaid') <> 'paid'
        ORDER BY o.created_at ASC, oi.id ASC
        `,
        [restaurantId]
      );

      const ordersMap = new Map();

      for (const row of result.rows) {
        if (!ordersMap.has(row.order_id)) {
          ordersMap.set(row.order_id, {
            id: row.order_id,
            order_id: row.order_id,
            session_id: row.session_id,
            table_id: row.table_id,
            table_number: row.table_number,
            restaurant_id: row.restaurant_id,
            status: row.status,
            created_at: row.created_at,
            payment_status:
              row.payment_status || 'unpaid',
            items: [],
          });
        }

        ordersMap.get(row.order_id).items.push({
          order_item_id: row.order_item_id,
          menu_item_id: row.menu_item_id,
          name: row.name,
          description: row.description,
          price: toMoney(
            row.unit_price ?? row.price
          ),
          unit_price: toMoney(
            row.unit_price ?? row.price
          ),
          category: row.category,
          image_url: row.image_url,
          quantity: Number(row.quantity || 0),
          note: row.note,
          item_status: row.status,
        });
      }

      res.json(
        Array.from(ordersMap.values())
      );
    } catch (err) {
      console.error(
        'Failed to fetch unbilled staff orders:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch unbilled staff orders.',
      });
    }
  }
);

// ==================================================
// GENERATE COMBINED BILL FOR A TABLE
// ==================================================
router.post(
  '/restaurant/:restaurantId/table/:tableNumber/generate',
  async (req, res) => {
    const {
      restaurantId,
      tableNumber,
    } = req.params;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const tableResult = await client.query(
        `
        SELECT
          id,
          restaurant_id,
          table_number
        FROM tables
        WHERE restaurant_id = $1
          AND table_number = $2
        `,
        [restaurantId, tableNumber]
      );

      if (!tableResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          error: 'Table not found.',
        });
      }

      const table =
        tableResult.rows[0];

      const sessionResult =
        await client.query(
          `
          SELECT
            id,
            table_id,
            started_at,
            ended_at,
            is_active
          FROM table_sessions
          WHERE table_id = $1
            AND is_active = true
          ORDER BY started_at DESC
          LIMIT 1
          FOR UPDATE
          `,
          [table.id]
        );

      if (!sessionResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'Table has no active session.',
        });
      }

      const session =
        sessionResult.rows[0];

      const ordersResult =
        await client.query(
          `
          SELECT
            o.id,
            o.status,
            o.payment_status
          FROM orders o
          WHERE o.session_id = $1
            AND o.bill_id IS NULL
            AND o.status <> 'cancelled'
            AND COALESCE(
              o.payment_status,
              'unpaid'
            ) <> 'paid'
          ORDER BY o.created_at ASC
          FOR UPDATE
          `,
          [session.id]
        );

      if (!ordersResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'There are no unbilled orders for this table.',
        });
      }

      // Both are considered finished/served.
      const finalStatuses = new Set([
        'completed',
        'delivered',
      ]);

      const unfinished =
        ordersResult.rows.filter(
          (order) =>
            !finalStatuses.has(order.status)
        );

      if (unfinished.length) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            `Cannot generate the bill yet. ${unfinished.length} order(s) are not finished serving.`,
          unfinished_order_ids:
            unfinished.map(
              (order) => order.id
            ),
        });
      }

      const billResult =
        await client.query(
          `
          INSERT INTO bills
            (
              restaurant_id,
              table_id,
              session_id,
              status,
              payment_status,
              created_at
            )
          VALUES
            (
              $1,
              $2,
              $3,
              'generated',
              'unpaid',
              NOW()
            )
          RETURNING id, created_at
          `,
          [
            restaurantId,
            table.id,
            session.id,
          ]
        );

      const bill =
        billResult.rows[0];

      const orderIds =
        ordersResult.rows.map(
          (row) => row.id
        );

      await client.query(
        `
        UPDATE orders
        SET bill_id = $1
        WHERE id = ANY($2::integer[])
        `,
        [bill.id, orderIds]
      );

      await client.query('COMMIT');

      const completeBill =
        await getBill(bill.id);

      getIO()
        .to(
          `restaurant_${restaurantId}`
        )
        .emit(
          'bill_generated',
          {
            bill_id: bill.id,
            bill_number: bill.id,
            table_number:
              table.table_number,
            order_ids: orderIds,
            status: 'generated',
          }
        );

      getIO()
        .to(
          `table_${table.table_number}`
        )
        .emit(
          'bill_generated',
          {
            bill_id: bill.id,
            bill_number: bill.id,
            table_number:
              table.table_number,
            order_ids: orderIds,
            status: 'generated',
          }
        );

      res.status(201).json(
        completeBill
      );
    } catch (err) {
      await client.query('ROLLBACK');

      console.error(
        'Failed to generate combined bill:',
        err
      );

      res.status(500).json({
        error:
          'Failed to generate combined bill.',
      });
    } finally {
      client.release();
    }
  }
);

// ==================================================
// GET BILLING LIST FOR ADMIN
// ==================================================
router.get(
  '/restaurant/:restaurantId',
  async (req, res) => {
    const { restaurantId } =
      req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          b.id,
          b.status,
          b.payment_status,
          b.payment_method,
          b.created_at,
          b.paid_at,
          t.table_number,
          COUNT(DISTINCT o.id)::int
            AS order_count,
          COALESCE(
            SUM(
              oi.quantity *
              COALESCE(
                oi.unit_price,
                mi.price
              )
            ),
            0
          ) AS total
        FROM bills b
        JOIN tables t
          ON t.id = b.table_id
        LEFT JOIN orders o
          ON o.bill_id = b.id
        LEFT JOIN order_items oi
          ON oi.order_id = o.id
        LEFT JOIN menu_items mi
          ON mi.id = oi.menu_item_id
        WHERE b.restaurant_id = $1
        GROUP BY
          b.id,
          b.status,
          b.payment_status,
          b.payment_method,
          b.created_at,
          b.paid_at,
          t.table_number
        ORDER BY b.created_at DESC
        `,
        [restaurantId]
      );

      res.json(
        result.rows.map((row) => ({
          id: row.id,
          bill_id: row.id,
          bill_number: row.id,
          status: row.status,
          payment_status:
            row.payment_status ||
            'unpaid',
          payment_method:
            row.payment_method ||
            null,
          created_at: row.created_at,
          paid_at:
            row.paid_at || null,
          table_number:
            row.table_number,
          order_count:
            Number(
              row.order_count || 0
            ),
          total: toMoney(row.total),
        }))
      );
    } catch (err) {
      console.error(
        'Failed to fetch bills:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch bills.',
      });
    }
  }
);

// ==================================================
// GET SINGLE BILL
// ==================================================
router.get(
  '/:billId',
  async (req, res) => {
    try {
      const bill =
        await getBill(
          req.params.billId
        );

      if (!bill) {
        return res.status(404).json({
          error: 'Bill not found.',
        });
      }

      res.json(bill);
    } catch (err) {
      console.error(
        'Failed to fetch bill:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch bill.',
      });
    }
  }
);

// ==================================================
// MARK BILL AS PAID
// ==================================================
router.patch(
  '/:billId/payment',
  async (req, res) => {
    const { billId } =
      req.params;

    const {
      payment_method,
    } = req.body;

    const allowedPaymentMethods = [
      'cash',
      'upi',
      'card',
    ];

    const normalizedPaymentMethod =
      String(
        payment_method || ''
      ).toLowerCase();

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

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const billResult =
        await client.query(
          `
          SELECT
            b.id,
            b.restaurant_id,
            b.table_id,
            b.session_id,
            b.payment_status,
            t.table_number
          FROM bills b
          JOIN tables t
            ON t.id = b.table_id
          WHERE b.id = $1
          FOR UPDATE
          `,
          [billId]
        );

      if (!billResult.rows.length) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          error:
            'Bill not found.',
        });
      }

      const bill =
        billResult.rows[0];

      if (
        bill.payment_status ===
        'paid'
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          error:
            'This bill has already been paid.',
        });
      }

      const paymentResult =
        await client.query(
          `
          UPDATE bills
          SET
            payment_status = 'paid',
            payment_method = $1,
            paid_at = NOW(),
            status = 'paid'
          WHERE id = $2
          RETURNING
            id,
            payment_status,
            payment_method,
            paid_at,
            status
          `,
          [
            normalizedPaymentMethod,
            billId,
          ]
        );

      await client.query(
        `
        UPDATE orders
        SET
          payment_status = 'paid',
          payment_method = $1,
          paid_at = NOW()
        WHERE bill_id = $2
        `,
        [
          normalizedPaymentMethod,
          billId,
        ]
      );

      const remainingResult =
        await client.query(
          `
          SELECT COUNT(*)::int
            AS count
          FROM orders
          WHERE session_id = $1
            AND bill_id IS NULL
            AND status <> 'cancelled'
            AND COALESCE(
              payment_status,
              'unpaid'
            ) <> 'paid'
          `,
          [bill.session_id]
        );

      let sessionClosed =
        false;

      if (
        Number(
          remainingResult
            .rows[0]
            .count || 0
        ) === 0
      ) {
        await client.query(
          `
          UPDATE table_sessions
          SET
            is_active = false,
            ended_at = NOW()
          WHERE id = $1
            AND is_active = true
          `,
          [bill.session_id]
        );

        sessionClosed = true;
      }

      await client.query(
        'COMMIT'
      );

      const payment =
        paymentResult.rows[0];

      getIO()
        .to(
          `restaurant_${bill.restaurant_id}`
        )
        .emit(
          'bill_paid',
          {
            bill_id: bill.id,
            payment_status:
              payment.payment_status,
            payment_method:
              payment.payment_method,
            paid_at:
              payment.paid_at,
            session_closed:
              sessionClosed,
          }
        );

      getIO()
        .to(
          `table_${
            bill.table_number ||
            bill.table_id
          }`
        )
        .emit(
          'bill_paid',
          {
            bill_id: bill.id,
            payment_status:
              payment.payment_status,
            payment_method:
              payment.payment_method,
            paid_at:
              payment.paid_at,
            session_closed:
              sessionClosed,
          }
        );

      res.json({
        success: true,
        bill_id: payment.id,
        payment_status:
          payment.payment_status,
        payment_method:
          payment.payment_method,
        paid_at:
          payment.paid_at,
        status:
          payment.status,
        session_closed:
          sessionClosed,
      });
    } catch (err) {
      await client.query(
        'ROLLBACK'
      );

      console.error(
        'Failed to complete bill payment:',
        err
      );

      res.status(500).json({
        error:
          'Failed to complete bill payment.',
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;