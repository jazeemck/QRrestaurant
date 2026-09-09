const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');

// GET all menu items for a restaurant
router.get('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT *
       FROM menu_items
       WHERE restaurant_id = $1
       ORDER BY category, name`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error getting menu:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// POST add a new menu item
router.post('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  const {
    name,
    description,
    price,
    category,
    image_url,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO menu_items
        (
          restaurant_id,
          name,
          description,
          price,
          category,
          image_url
        )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        restaurantId,
        name,
        description || null,
        price,
        category,
        image_url || null,
      ]
    );

    const item = result.rows[0];

    // Notify all customers currently viewing this restaurant
    getIO()
      .to(`restaurant_${restaurantId}`)
      .emit('menu_item_added', item);

    res.status(201).json(item);
  } catch (err) {
    console.error('Error adding menu item:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// PATCH edit a menu item
router.patch('/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  const {
    name,
    description,
    price,
    category,
    image_url,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE menu_items
       SET
         name = $1,
         description = $2,
         price = $3,
         category = $4,
         image_url = $5
       WHERE id = $6
       RETURNING *`,
      [
        name,
        description || null,
        price,
        category,
        image_url || null,
        itemId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Menu item not found',
      });
    }

    const item = result.rows[0];

    // Notify customers about the updated item
    getIO()
      .to(`restaurant_${item.restaurant_id}`)
      .emit('menu_item_updated', item);

    res.json(item);
  } catch (err) {
    console.error('Error updating menu item:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// PATCH toggle menu item availability
router.patch(
  '/item/:itemId/availability',
  async (req, res) => {
    const { itemId } = req.params;
    const { is_available } = req.body;

    try {
      const result = await pool.query(
        `UPDATE menu_items
         SET is_available = $1
         WHERE id = $2
         RETURNING *`,
        [is_available, itemId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Menu item not found',
        });
      }

      const item = result.rows[0];

      // Notify customers about availability change
      getIO()
        .to(`restaurant_${item.restaurant_id}`)
        .emit('menu_item_updated', item);

      res.json(item);
    } catch (err) {
      console.error(
        'Error updating menu availability:',
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// DELETE menu item
router.delete('/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM menu_items
       WHERE id = $1
       RETURNING *`,
      [itemId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Menu item not found',
      });
    }

    const item = result.rows[0];

    // Notify customers about deleted item
    getIO()
      .to(`restaurant_${item.restaurant_id}`)
      .emit('menu_item_deleted', item);

    res.json(item);
  } catch (err) {
    console.error('Error deleting menu item:', err);

    // PostgreSQL foreign key violation
    if (err.code === '23503') {
      return res.status(409).json({
        error:
          'This menu item has been used in previous orders and cannot be permanently deleted. Mark it unavailable instead.',
      });
    }

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;