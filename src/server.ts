import 'dotenv/config';
import http from 'http';
import { createApp } from '@/app';
import { initChatGateway } from '@/modules/chat/chat.gateway';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();
const httpServer = http.createServer(app);

// Socket.io compartilha o mesmo servidor HTTP (Railway expõe uma única porta)
initChatGateway(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] rodando na porta ${PORT}`);
});
