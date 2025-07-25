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
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({ cors: true })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private onlineUsers = new Map<number, string>(); // userId -> socketId

    constructor(
        private readonly userService: UserService,
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
        private readonly jwtService: JwtService,
    ) {}

    async handleConnection(client: Socket) {
        try {
            console.log('auth payload:', client.handshake.auth);
            const token = client.handshake.auth?.token as string;
            if (!token) {
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload.sub;

            this.onlineUsers.set(userId, client.id);
            client.data.userId = userId;
            client.join(String(userId));

            console.log(`User ${userId} connected`);
        } catch (err) {
            console.warn('Unauthorized socket connection attempt');
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.onlineUsers.delete(userId);
            console.log(`User ${userId} disconnected`);
        }
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

        const sender = await this.userService.findById(from);
        const recipient = await this.userService.findById(to);
        const chat = await this.chatService.findByIdWithParticipants(chatId);

        if (!sender || !recipient || !chat) {
            console.warn('Invalid message payload:', data);
            return;
        }

        const isParticipant = chat.participants.some(
            (user) => user.id === sender.id,
        );
        if (!isParticipant) {
            console.warn(`User ${sender.id} is not a participant of chat ${chatId}`);
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
        };

        const recipientSocketId = this.onlineUsers.get(to);
        if (recipientSocketId) {
            client.to(recipientSocketId).emit('receiveMessage', response);
        }

        client.emit('receiveMessage', response);
    }
}
