const express = require('express');
const router = express.Router();
const pool = require('../db');

// ==================================================
// SALES STATUS
// ==================================================

// Only completed orders are counted as finalized sales.
// Cancelled and active orders are excluded.
const SALES_STATUS = 'completed';

// ==================================================
// GET SALES SUMMARY
// ==================================================
//
// Example:
// GET /api/sales/summary/1?date=2026-09-08
//
// Returns:
// - total revenue
// - total orders
// - total items sold
// - average order value
// ==================================================

router.get('/summary/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { date } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT o.id)::int AS total_orders,

        COALESCE(
          SUM(oi.quantity),
          0
        )::int AS items_sold,

        COALESCE(
          SUM(
            oi.quantity * mi.price
          ),
          0
        )::numeric AS total_revenue,

        COALESCE(
          SUM(
            oi.quantity * mi.price
          ) / NULLIF(COUNT(DISTINCT o.id), 0),
          0
        )::numeric AS average_order_value

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

        AND o.status = $2

        AND (
          $3::date IS NULL
          OR o.created_at::date = $3::date
        )
      `,
      [
        restaurantId,
        SALES_STATUS,
        date || null,
      ]
    );

    const summary = result.rows[0];

    res.json({
      date: date || null,
      total_orders: Number(
        summary.total_orders || 0
      ),
      items_sold: Number(
        summary.items_sold || 0
      ),
      total_revenue: Number(
        summary.total_revenue || 0
      ),
      average_order_value: Number(
        summary.average_order_value || 0
      ),
    });
  } catch (err) {
    console.error(
      'Error getting sales summary:',
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// ==================================================
// GET ITEM SALES
// ==================================================
//
// Example:
// GET /api/sales/items/1?date=2026-09-08
//
// Returns each menu item:
// - item name
// - category
// - quantity sold
// - revenue
// ==================================================

router.get('/items/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { date } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT
        mi.id AS menu_item_id,
        mi.name,
        mi.category,

        SUM(oi.quantity)::int AS quantity_sold,

        SUM(
          oi.quantity * mi.price
        )::numeric AS revenue

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

        AND o.status = $2

        AND (
          $3::date IS NULL
          OR o.created_at::date = $3::date
        )

      GROUP BY
        mi.id,
        mi.name,
        mi.category

      ORDER BY
        quantity_sold DESC,
        revenue DESC
      `,
      [
        restaurantId,
        SALES_STATUS,
        date || null,
      ]
    );

    res.json(
      result.rows.map((item) => ({
        menu_item_id: item.menu_item_id,
        name: item.name,
        category: item.category,
        quantity_sold: Number(
          item.quantity_sold || 0
        ),
        revenue: Number(
          item.revenue || 0
        ),
      }))
    );
  } catch (err) {
    console.error(
      'Error getting item sales:',
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// ==================================================
// GET DAILY SALES
// ==================================================
//
// Example:
// GET /api/sales/daily/1
//
// Optional:
// ?from=2026-09-01&to=2026-09-08
//
// Returns one row per day.
// ==================================================

router.get('/daily/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { from, to } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT
        o.created_at::date AS sales_date,

        COUNT(DISTINCT o.id)::int
          AS order_count,

        SUM(oi.quantity)::int
          AS item_count,

        SUM(
          oi.quantity * mi.price
        )::numeric AS revenue,

        (
          SUM(
            oi.quantity * mi.price
          )
          /
          NULLIF(
            COUNT(DISTINCT o.id),
            0
          )
        )::numeric AS average_order_value

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

        AND o.status = $2

        AND (
          $3::date IS NULL
          OR o.created_at::date >= $3::date
        )

        AND (
          $4::date IS NULL
          OR o.created_at::date <= $4::date
        )

      GROUP BY
        o.created_at::date

      ORDER BY
        sales_date DESC
      `,
      [
        restaurantId,
        SALES_STATUS,
        from || null,
        to || null,
      ]
    );

    res.json(
      result.rows.map((day) => ({
        sales_date: day.sales_date,
        order_count: Number(
          day.order_count || 0
        ),
        item_count: Number(
          day.item_count || 0
        ),
        revenue: Number(
          day.revenue || 0
        ),
        average_order_value: Number(
          day.average_order_value || 0
        ),
      }))
    );
  } catch (err) {
    console.error(
      'Error getting daily sales:',
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// ==================================================
// GET TOP SELLING ITEMS
// ==================================================
//
// Example:
// GET /api/sales/top-items/1?date=2026-09-08
//
// Returns the best-selling items.
// ==================================================

router.get(
  '/top-items/:restaurantId',
  async (req, res) => {
    const { restaurantId } = req.params;
    const { date, limit = 5 } = req.query;

    const parsedLimit = Math.min(
      Math.max(Number(limit) || 5, 1),
      50
    );

    try {
      const result = await pool.query(
        `
        SELECT
          mi.id AS menu_item_id,
          mi.name,
          mi.category,

          SUM(oi.quantity)::int
            AS quantity_sold,

          SUM(
            oi.quantity * mi.price
          )::numeric AS revenue

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

          AND o.status = $2

          AND (
            $3::date IS NULL
            OR o.created_at::date = $3::date
          )

        GROUP BY
          mi.id,
          mi.name,
          mi.category

        ORDER BY
          quantity_sold DESC,
          revenue DESC

        LIMIT $4
        `,
        [
          restaurantId,
          SALES_STATUS,
          date || null,
          parsedLimit,
        ]
      );

      res.json(
        result.rows.map((item) => ({
          menu_item_id:
            item.menu_item_id,
          name: item.name,
          category:
            item.category,
          quantity_sold:
            Number(
              item.quantity_sold || 0
            ),
          revenue:
            Number(
              item.revenue || 0
            ),
        }))
      );
    } catch (err) {
      console.error(
        'Error getting top selling items:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;