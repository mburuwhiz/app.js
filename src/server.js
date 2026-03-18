const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make `io` available to controllers
app.set('socketio', io);

io.on('connection', (socket) => {
  logger.info(`New WebSocket client connected: ${socket.id}`);

  // Client subscribes to a specific payment request ID (CheckoutRequestID for STK, TransID for C2B)
  socket.on('subscribe_to_payment', (paymentId) => {
    logger.info(`Client ${socket.id} subscribed to payment updates for ${paymentId}`);
    socket.join(paymentId);
  });

  socket.on('disconnect', () => {
    logger.debug(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
