import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { User } from '../user/user.entity';
import { Chat } from '../chat/chat.entity';

@Injectable()
export class MessageService {
    constructor(
        @InjectRepository(Message)
        private messagesRepo: Repository<Message>,
    ) {}

    async createMessage(sender: User, chat: Chat, content: string): Promise<Message> {
        const msg = this.messagesRepo.create({ sender, chat, content });
        return this.messagesRepo.save(msg);
    }

    async getMessagesForChat(chatId: number): Promise<Message[]> {
        return this.messagesRepo.find({
            where: { chat: { id: chatId } },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }
}
