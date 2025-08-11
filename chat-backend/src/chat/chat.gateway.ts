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

    /** userId -> set of socketIds */
    private onlineUsers = new Map<number, Set<string>>();

    constructor(
        private readonly userService: UserService,
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
        private readonly jwtService: JwtService,
    ) {}

    async handleConnection(clientSocket: Socket) {
        try {
            const accessToken = clientSocket.handshake.auth?.token as string;
            if (!accessToken) return clientSocket.disconnect();

            const jwtPayload = this.jwtService.verify(accessToken);
            const userId = Number(jwtPayload.sub);
            clientSocket.data.userId = userId;

            // персональная комната пользователя
            clientSocket.join(`user-${userId}`);

            // учёт онлайна
            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
                this.server.emit('userOnline', { userId });
            }
            this.onlineUsers.get(userId)!.add(clientSocket.id);

            // отдать подключившемуся список онлайнов
            const currentOnlineIds = Array.from(this.onlineUsers.keys());
            clientSocket.emit('onlineUsers', { userIds: currentOnlineIds });

            console.log(`✅ User ${userId} connected`);
        } catch (error) {
            console.warn('handleConnection error', error);
            clientSocket.disconnect();
        }
    }

    handleDisconnect(clientSocket: Socket) {
        const userId = clientSocket.data.userId;
        if (!userId) return;

        const socketsOfUser = this.onlineUsers.get(userId);
        if (!socketsOfUser) return;

        socketsOfUser.delete(clientSocket.id);
        if (socketsOfUser.size === 0) {
            this.onlineUsers.delete(userId);
            this.server.emit('userOffline', { userId: Number(userId) });
        }
    }

    @SubscribeMessage('joinChat')
    handleJoinChat(
        @MessageBody() body: { chatId: number },
        @ConnectedSocket() clientSocket: Socket
    ) {
        const userId = clientSocket.data.userId;
        if (!userId) {
            console.warn('joinChat: no userId on socket');
            return;
        }

        const chatIdNumber = Number(body?.chatId);
        if (!chatIdNumber) {
            console.warn('joinChat: invalid payload', body);
            return;
        }

        // выходим из предыдущих комнат чатов
        for (const roomName of clientSocket.rooms) {
            if (roomName.startsWith('chat-')) clientSocket.leave(roomName);
        }

        const chatRoomName = `chat-${chatIdNumber}`;
        clientSocket.join(chatRoomName);
        console.log(`🔗 User ${userId} joined room ${chatRoomName}`);
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody()
            body: { to: number; chatId: number; message: string },
        @ConnectedSocket() clientSocket: Socket,
    ) {
        const senderId = Number(clientSocket.data.userId);
        const recipientId = Number(body.to);
        const chatIdNumber = Number(body.chatId);
        const content = body.message;

        // валидация участников/чата
        const senderUser = await this.userService.findById(senderId);
        const recipientUser = await this.userService.findById(recipientId);
        const chatEntity = await this.chatService.findByIdWithParticipants(chatIdNumber);

        if (!senderUser || !recipientUser || !chatEntity) {
            console.warn('⚠ Invalid message payload:', body);
            return;
        }

        const isParticipant = chatEntity.participants.some(p => p.id === senderUser.id);
        if (!isParticipant) {
            console.warn(`⚠ User ${senderUser.id} is not a participant of chat ${chatIdNumber}`);
            return;
        }

        // создаём сообщение
        const savedMessage = await this.messageService.createMessage(
            senderUser,
            chatEntity,
            content,
        );

        const messageEventPayload = {
            id: savedMessage.id,
            chatId: chatIdNumber,
            content,
            from: senderUser.id,
            to: recipientUser.id,
            createdAt: savedMessage.createdAt,
            sender: {
                id: senderUser.id,
                email: senderUser.email,
                name: senderUser.name,
            },
        };

        // всем, кто уже в комнате чата
        const chatRoomName = `chat-${chatIdNumber}`;
        this.server.to(chatRoomName).emit('receiveMessage', messageEventPayload);

        // персонально обоим участникам (если они не в комнате)
        for (const participant of chatEntity.participants) {
            this.server.to(`user-${participant.id}`).emit('receiveMessage', messageEventPayload);
        }

        // обновление lastMessage для сайдбара обоих участников
        for (const participant of chatEntity.participants) {
            this.server.to(`user-${participant.id}`).emit('chatLastMessage', {
                chatId: chatIdNumber,
                lastMessage: {
                    id: savedMessage.id,
                    content,
                    createdAt: savedMessage.createdAt,
                    senderId: senderUser.id,
                },
                lastMessageAt: savedMessage.createdAt,
            });
        }
    }

    // ===== WebRTC сигналинг =====

    @SubscribeMessage('callInvite')
    async handleCallInvite(
        @MessageBody() body: { toUserId: number; chatId: number; sdp: any },
        @ConnectedSocket() client: Socket,
    ) {
        const fromUserId = Number(client.data.userId);
        const toUserId = Number(body.toUserId);
        const chatId = Number(body.chatId);

        // (по желанию) убедимся, что оба состоят в чате
        const chat = await this.chatService.findByIdWithParticipants(chatId);
        if (!chat || !chat.participants.some(u => u.id === fromUserId) || !chat.participants.some(u => u.id === toUserId)) {
            return;
        }

        // Покидаем оффер в персональную комнату адресата
        this.server.to(`user-${toUserId}`).emit('callInvite', {
            fromUserId,
            chatId,
            sdp: body.sdp,
        });
    }

    @SubscribeMessage('callAnswer')
    async handleCallAnswer(
        @MessageBody() body: { toUserId: number; chatId: number; sdp: any },
        @ConnectedSocket() client: Socket,
    ) {
        const fromUserId = Number(client.data.userId);
        const toUserId = Number(body.toUserId);
        const chatId = Number(body.chatId);

        this.server.to(`user-${toUserId}`).emit('callAnswer', {
            fromUserId,
            chatId,
            sdp: body.sdp,
        });
    }

    @SubscribeMessage('callIce')
    async handleCallIce(
        @MessageBody() body: { toUserId: number; chatId: number; candidate: any },
        @ConnectedSocket() client: Socket,
    ) {
        const fromUserId = Number(client.data.userId);
        const toUserId = Number(body.toUserId);
        const chatId = Number(body.chatId);

        this.server.to(`user-${toUserId}`).emit('callIce', {
            fromUserId,
            chatId,
            candidate: body.candidate,
        });
    }

    @SubscribeMessage('callEnd')
    async handleCallEnd(
        @MessageBody() body: { toUserId: number; chatId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const fromUserId = Number(client.data.userId);
        const toUserId = Number(body.toUserId);
        const chatId = Number(body.chatId);

        this.server.to(`user-${toUserId}`).emit('callEnd', { fromUserId, chatId });
    }
}
