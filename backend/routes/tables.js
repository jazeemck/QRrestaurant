const express = require('express');
const router = express.Router();
const pool = require('../db');
const QRCode = require('qrcode');
const { getIO } = require('../socket');

// GET all tables for a restaurant
router.get('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT *
       FROM tables
       WHERE restaurant_id = $1
       ORDER BY table_number`,
      [restaurantId]
    );

    const tables = await Promise.all(
      result.rows.map(async (table) => {
        const url =
          table.qr_code_url ||
          `${process.env.APP_URL || 'http://localhost:3000'}` +
            `/r/${restaurantId}/t/${table.table_number}`;

        const qrDataUrl = await QRCode.toDataURL(url);

        return {
          ...table,
          qr_code_url: url,
          qr_image: qrDataUrl,
        };
      })
    );

    res.json(tables);
  } catch (err) {
    console.error('Error getting tables:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// PATCH regenerate QR URL for a table
router.patch(
  '/:restaurantId/:tableNumber/qr',
  async (req, res) => {
    const { restaurantId, tableNumber } = req.params;

    try {
      const tableResult = await pool.query(
        `SELECT *
         FROM tables
         WHERE restaurant_id = $1
           AND table_number = $2`,
        [restaurantId, tableNumber]
      );

      const table = tableResult.rows[0];

      if (!table) {
        return res.status(404).json({
          error: 'Table not found',
        });
      }

      const url =
        `${process.env.APP_URL || 'http://localhost:3000'}` +
        `/r/${restaurantId}/t/${tableNumber}`;

      const qrDataUrl = await QRCode.toDataURL(url);

      const updatedResult = await pool.query(
        `UPDATE tables
         SET qr_code_url = $1
         WHERE id = $2
         RETURNING *`,
        [url, table.id]
      );

      res.json({
        ...updatedResult.rows[0],
        qr_image: qrDataUrl,
      });
    } catch (err) {
      console.error('Error regenerating QR:', err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// POST create a table and generate its QR code
router.post('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { table_number } = req.body;

  try {
    const tableResult = await pool.query(
      `INSERT INTO tables
        (restaurant_id, table_number)
       VALUES ($1, $2)
       RETURNING *`,
      [restaurantId, table_number]
    );

    const table = tableResult.rows[0];

    const url =
      `${process.env.APP_URL || 'http://localhost:3000'}` +
      `/r/${restaurantId}/t/${table.table_number}`;

    const qrDataUrl = await QRCode.toDataURL(url);

    const updatedResult = await pool.query(
      `UPDATE tables
       SET qr_code_url = $1
       WHERE id = $2
       RETURNING *`,
      [url, table.id]
    );

    res.status(201).json({
      ...updatedResult.rows[0],
      qr_image: qrDataUrl,
    });
  } catch (err) {
    console.error('Error creating table:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// POST customer calls for staff assistance
// Uses public restaurant ID + table number
router.post(
  '/restaurant/:restaurantId/table/:tableNumber/call-staff',
  async (req, res) => {
    const { restaurantId, tableNumber } = req.params;

    try {
      // Find the table using restaurant ID + public table number
      const tableResult = await pool.query(
        `SELECT id, restaurant_id, table_number
         FROM tables
         WHERE restaurant_id = $1
           AND table_number = $2`,
        [restaurantId, tableNumber]
      );

      if (!tableResult.rows.length) {
        return res.status(404).json({
          error: 'Table not found',
        });
      }

      const table = tableResult.rows[0];

      // Create the staff call using the internal database table ID
      const callResult = await pool.query(
        `INSERT INTO staff_calls (table_id)
         VALUES ($1)
         RETURNING *`,
        [table.id]
      );

      const call = callResult.rows[0];

      // Notify the kitchen dashboard
      getIO()
        .to(`kitchen_${table.restaurant_id}`)
        .emit('staff_called', {
          ...call,
          table_number: table.table_number,
        });

      res.status(201).json({
        ...call,
        table_number: table.table_number,
      });
    } catch (err) {
      console.error('Error calling staff:', err);

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;