import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';
import { MessageService } from '../message/message.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({ cors: true })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // userId -> Set<socketId>
    private onlineUsers = new Map<number, Set<string>>();

    constructor(
        private readonly userService: UserService,
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
        private readonly jwtService: JwtService,
    ) {}

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token as string;
            if (!token) {
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload.sub;
            client.data.userId = userId;

            // добавляем сокет пользователя
            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
                this.server.emit('userOnline', { userId });
            }

            this.onlineUsers.get(userId)!.add(client.id);

            console.log(`✅ User ${userId} connected`);
        } catch (err) {
            console.warn('❌ Unauthorized socket connection attempt');
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (!userId) return;

        const sockets = this.onlineUsers.get(userId);
        if (!sockets) return;

        sockets.delete(client.id);

        if (sockets.size === 0) {
            this.onlineUsers.delete(userId);
            this.server.emit('userOffline', { userId });
        }

        console.log(`❌ User ${userId} disconnected`);
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody()
            data: {
            to: number;
            chatId: number;
            message: string;
        },
        @ConnectedSocket() client: Socket,
    ) {
        const from = client.data.userId;
        const { to, chatId, message } = data;

        // проверяем участников
        const sender = await this.userService.findById(from);
        const recipient = await this.userService.findById(to);
        const chat = await this.chatService.findByIdWithParticipants(chatId);

        if (!sender || !recipient || !chat) {
            console.warn('⚠ Invalid message payload:', data);
            return;
        }

        const isParticipant = chat.participants.some((u) => u.id === sender.id);
        if (!isParticipant) {
            console.warn(`⚠ User ${sender.id} is not a participant of chat ${chatId}`);
            return;
        }

        // сохраняем сообщение
        const savedMessage = await this.messageService.createMessage(
            sender,
            chat,
            message,
        );

        const response = {
            id: savedMessage.id,
            chatId,
            content: message,
            from,
            to,
            createdAt: savedMessage.createdAt,
            sender: {
                id: sender.id,
                email: sender.email,
                name: sender.name,
            },
        };

        // отправляем всем соединениям получателя
        const recipientSockets = this.onlineUsers.get(to);
        recipientSockets?.forEach((socketId) => {
            this.server.to(socketId).emit('receiveMessage', response);
        });

        // отправляем всем соединениям отправителя
        const senderSockets = this.onlineUsers.get(from);
        senderSockets?.forEach((socketId) => {
            this.server.to(socketId).emit('receiveMessage', response);
        });
    }
}
