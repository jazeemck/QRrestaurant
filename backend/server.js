require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const socketManager = require('./socket');
const pool = require('./db');

const menuRoutes = require('./routes/menu');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const restaurantRoutes = require('./routes/restaurants');
const salesRoutes = require('./routes/sales');
const billRoutes = require('./routes/bills');

const app = express();

app.use(cors());

// Increased JSON body limit so uploaded food/restaurant images
// converted to Base64 data URLs can be sent to the API.
app.use(express.json({ limit: '10mb' }));

app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      db: 'connected',
    });
  } catch (err) {
    console.error('Database connection failed:', err);

    res.status(500).json({
      db: 'disconnected',
      error: err.message,
    });
  }
});

app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/bills', billRoutes);

app.get('/', (req, res) => {
  res.send('QR Restaurant Ordering API is running');
});

const server = http.createServer(app);

socketManager.init(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});