import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { ChatService } from '../chat/chat.service';
import { UserService } from '../user/user.service';

@Injectable()
export class MessageService {
    constructor(
        @InjectRepository(Message)
        private msgRepo: Repository<Message>,
        private chatService: ChatService,
        private userService: UserService,
    ) {}

    async sendMessage(chatId: number, senderId: number, text: string): Promise<Message> {
        const chat = await this.chatService.findOne(chatId);
        if (!chat) {
            throw new Error('Chat not found');
        }

        const sender = await this.userService.findById(senderId);
        if (!sender) {
            throw new Error('Sender not found');
        }

        const msg = this.msgRepo.create({
            chat,
            sender,
            text,
        });

        return this.msgRepo.save(msg);
    }

    async getMessages(chatId: number): Promise<Message[]> {
        return this.msgRepo.find({
            where: { chat: { id: chatId } },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }
}
