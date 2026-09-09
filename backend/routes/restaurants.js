const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');

// GET restaurant details
router.get('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        id,
        name,
        created_at,
        logo_url,
        cover_image_url,
        description,
        phone,
        address,
        primary_color
       FROM restaurants
       WHERE id = $1`,
      [restaurantId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Restaurant not found',
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting restaurant:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// PATCH update restaurant details
router.patch('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  const {
    name,
    logo_url,
    cover_image_url,
    description,
    phone,
    address,
    primary_color,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE restaurants
       SET
         name = COALESCE($1, name),
         logo_url = COALESCE($2, logo_url),
         cover_image_url = COALESCE($3, cover_image_url),
         description = COALESCE($4, description),
         phone = COALESCE($5, phone),
         address = COALESCE($6, address),
         primary_color = COALESCE($7, primary_color)
       WHERE id = $8
       RETURNING
         id,
         name,
         created_at,
         logo_url,
         cover_image_url,
         description,
         phone,
         address,
         primary_color`,
      [
        name,
        logo_url,
        cover_image_url,
        description,
        phone,
        address,
        primary_color,
        restaurantId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Restaurant not found',
      });
    }

    const restaurant = result.rows[0];

    // Tell connected clients that restaurant branding changed
    getIO()
      .to(`restaurant_${restaurantId}`)
      .emit('restaurant_updated', restaurant);

    res.json(restaurant);
  } catch (err) {
    console.error('Error updating restaurant:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;