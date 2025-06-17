import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private onlineUsers: Map<string, string> = new Map();

    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            this.onlineUsers.set(userId, client.id);
            client.join(userId); // Комната = userId
            console.log(`User ${userId} connected`);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = [...this.onlineUsers.entries()].find(([, id]) => id === client.id)?.[0];
        if (userId) {
            this.onlineUsers.delete(userId);
            console.log(`User ${userId} disconnected`);
        }
    }

    @SubscribeMessage('sendMessage')
    handleMessage(
        @MessageBody() data: { to: string; message: string; from: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { to, message, from } = data;
        client.to(to).emit('receiveMessage', {
            from,
            message,
            time: new Date().toISOString(),
        });
    }
}
