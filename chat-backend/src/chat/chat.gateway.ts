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
            if (!token) return client.disconnect();

            const payload = this.jwtService.verify(token);
            const userId = Number(payload.sub);
            client.data.userId = userId;

            // персональная комната для событий чата
            client.join(`user-${userId}`);

            // новый онлайн
            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
                this.server.emit('userOnline', { userId });
            }
            this.onlineUsers.get(userId)!.add(client.id);

            // отправляем список текущих онлайнов подключившемуся
            const onlineList = Array.from(this.onlineUsers.keys());
            client.emit('onlineUsers', { userIds: onlineList });

            console.log(`✅ User ${userId} connected`);
        } catch (e) {
            console.warn('handleConnection error', e);
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
            this.server.emit('userOffline', { userId: Number(userId) });
        }
    }

    @SubscribeMessage('joinChat')
    handleJoinChat(
        @MessageBody() body: { chatId: number },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            console.warn('joinChat: no userId');
            return;
        }

        const chatId = Number(body?.chatId);
        if (!chatId) {
            console.warn('joinChat: invalid payload', body);
            return;
        }

        for (const room of client.rooms) {
            if (room.startsWith('chat-')) client.leave(room);
        }
        const room = `chat-${chatId}`;
        client.join(room);
        console.log(`🔗 User ${userId} joined room ${room}`);
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() data: { to: number; chatId: number; message: string },
        @ConnectedSocket() client: Socket,
    ) {
        const from = client.data.userId;
        const { to, chatId, message } = data;

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

        // сообщение в комнату чата
        this.server.to(`chat-${chatId}`).emit('receiveMessage', response);

        // обновление lastMessage в персональные комнаты
        for (const u of chat.participants) {
            this.server.to(`user-${u.id}`).emit('chatLastMessage', {
                chatId,
                lastMessage: {
                    id: savedMessage.id,
                    content: message,
                    createdAt: savedMessage.createdAt,
                    senderId: sender.id,
                },
                lastMessageAt: savedMessage.createdAt,
            });
        }
    }
}
