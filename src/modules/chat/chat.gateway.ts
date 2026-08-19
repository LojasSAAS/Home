import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { query } from '@/config/database';

interface SendMessagePayload {
  order_id: string;
  tenant_id: string;
  sender_type: 'CUSTOMER' | 'STORE';
  sender_id: string;
  message_body: string;
}

/**
 * Cada pedido vira uma "sala" (room) isolada: order:<order_id>.
 * Cliente e loja entram na mesma sala; ninguém fora do pedido recebe as mensagens.
 */
export function initChatGateway(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
    },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_order', async ({ order_id }: { order_id: string }) => {
      if (!order_id) return;
      socket.join(roomName(order_id));
    });

    socket.on('leave_order', ({ order_id }: { order_id: string }) => {
      if (!order_id) return;
      socket.leave(roomName(order_id));
    });

    socket.on('send_message', async (payload: SendMessagePayload) => {
      try {
        const { order_id, tenant_id, sender_type, sender_id, message_body } = payload;

        if (!order_id || !tenant_id || !message_body?.trim()) {
          socket.emit('chat_error', { error: 'Payload de mensagem inválido' });
          return;
        }

        // Persiste antes de retransmitir, garantindo histórico consistente
        // mesmo se o app estiver momentaneamente offline ao reconectar.
        const result = await query(
          `INSERT INTO messages (tenant_id, order_id, sender_type, sender_id, message_body)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, tenant_id, order_id, sender_type, sender_id, message_body, created_at`,
          [tenant_id, order_id, sender_type, sender_id, message_body.trim()],
        );

        const savedMessage = result.rows[0];
        io.to(roomName(order_id)).emit('new_message', savedMessage);
      } catch (err) {
        console.error('[chat] erro ao salvar mensagem', err);
        socket.emit('chat_error', { error: 'Não foi possível enviar a mensagem' });
      }
    });

    socket.on('disconnect', () => {
      // rooms são limpas automaticamente pelo socket.io no disconnect
    });
  });

  return io;
}

function roomName(orderId: string) {
  return `order:${orderId}`;
}
