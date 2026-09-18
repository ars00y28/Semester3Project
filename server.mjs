import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/api/socket',
  });

  // Make io accessible from API routes via global
  global.io = io;

  io.on('connection', (socket) => {
    socket.on('join-page', (pageId) => {
      socket.join(`page:${pageId}`);
    });

    // Document editor sync
    socket.on('page:content', ({ pageId, content }) => {
      socket.to(`page:${pageId}`).emit('page:content', { content });
    });

    socket.on('page:title', ({ pageId, title }) => {
      socket.to(`page:${pageId}`).emit('page:title', { title });
    });

    // Database sync
    socket.on('db:row-add', ({ pageId, row }) => {
      socket.to(`page:${pageId}`).emit('db:row-add', { row });
    });

    socket.on('db:cell-update', ({ pageId, rowId, columnId, value }) => {
      socket.to(`page:${pageId}`).emit('db:cell-update', { rowId, columnId, value });
    });

    socket.on('db:column-add', ({ pageId, column }) => {
      socket.to(`page:${pageId}`).emit('db:column-add', { column });
    });

    socket.on('db:column-update', ({ pageId, column }) => {
      socket.to(`page:${pageId}`).emit('db:column-update', { column });
    });

    socket.on('db:column-delete', ({ pageId, columnId }) => {
      socket.to(`page:${pageId}`).emit('db:column-delete', { columnId });
    });

    socket.on('db:row-delete', ({ pageId, rowId }) => {
      socket.to(`page:${pageId}`).emit('db:row-delete', { rowId });
    });

    // Sidebar refresh for all connected users
    socket.on('page:sidebar-refresh', () => {
      socket.broadcast.emit('sidebar:refresh');
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.io ready on /api/socket`);
  });
});
