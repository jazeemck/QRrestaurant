let io;

function init(server) {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_kitchen', (restaurantId) => {
      socket.join(`kitchen_${restaurantId}`);
    });

    socket.on('join_table', (tableId) => {
      socket.join(`table_${tableId}`);
    });

    socket.on('join_restaurant', (restaurantId) => {
      socket.join(`restaurant_${restaurantId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }

  return io;
}

module.exports = {
  init,
  getIO,
};