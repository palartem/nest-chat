import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { MessageService } from '../message/message.service';
import { UserService } from '../user/user.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private onlineUsers: Map<string, string> = new Map();

    constructor(
        private readonly userService: UserService,
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
    ) {}

    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            this.onlineUsers.set(userId, client.id);
            client.join(userId);
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
    async handleMessage(
        @MessageBody() data: { to: string; message: string; from: string; chatId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const { to, message, from, chatId } = data;
        console.log(data);
        const sender = await this.userService.findOne(+from);
        const recipient = await this.userService.findOne(+to);
        const chat = await this.chatService.findOne(+chatId);

        if (sender && recipient && chat) {
            console.log('2 тест', sender, recipient, chat);
            await this.messageService.createMessage(sender, chat, message);

            client.to(to).emit('receiveMessage', {
                from,
                message,
                time: new Date().toISOString(),
            });
        }
    }
}
