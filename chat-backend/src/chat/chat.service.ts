import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Chat)
        private chatsRepo: Repository<Chat>,
    ) {}

    async findOne(id: number): Promise<Chat | null> {
        return this.chatsRepo.findOne({ where: { id } });
    }

    // создать чат между двумя пользователями
    async createChat(userA: User, userB: User): Promise<Chat> {
        const chat = this.chatsRepo.create({ participants: [userA, userB] });
        return this.chatsRepo.save(chat);
    }

    // получить все чаты для пользователя
    async findChatsForUser(userId: number): Promise<Chat[]> {
        return this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'user')
            .where('user.id = :userId', { userId })
            .getMany();
    }
}
