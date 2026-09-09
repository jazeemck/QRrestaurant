const { io } = require('socket.io-client');

const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);

  // Join the kitchen room for restaurant 1
  socket.emit('join_kitchen', 1);

  // Join the table room for table 1
  socket.emit('join_table', 1);

  console.log('Joined kitchen_1 and table_1');
});

socket.on('new_order', (order) => {
  console.log('NEW ORDER EVENT RECEIVED:');
  console.log(JSON.stringify(order, null, 2));
});

socket.on('order_status_updated', (order) => {
  console.log('ORDER STATUS EVENT RECEIVED:');
  console.log(JSON.stringify(order, null, 2));
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});