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
        @InjectRepository(User)
        private usersRepo: Repository<User>,
    ) {}

    async findOne(id: number): Promise<Chat | null> {
        return this.chatsRepo.findOne({ where: { id } });
    }

    async createChat(userA: User, userB: User): Promise<Chat> {
        const chat = this.chatsRepo.create({ participants: [userA, userB] });
        return this.chatsRepo.save(chat);
    }

    async findChatsForUser(userId: number): Promise<Chat[]> {
        return this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'user')
            .where('user.id = :userId', { userId })
            .getMany();
    }

    async findOrCreateChat(userA: User, userB: User): Promise<Chat> {
        const existingChat = await this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'user')
            .where('user.id IN (:...ids)', { ids: [userA.id, userB.id] })
            .groupBy('chat.id')
            .having('COUNT(user.id) = 2')
            .getOne();

        if (existingChat) {
            return existingChat;
        }

        return this.createChat(userA, userB);
    }
    async getOrCreateChat(userAId: number, userBId: number): Promise<Chat> {
        const userA = await this.usersRepo.findOneBy({ id: userAId });
        const userB = await this.usersRepo.findOneBy({ id: userBId });

        if (!userA || !userB) {
            throw new Error('One or both users not found');
        }

        return this.findOrCreateChat(userA, userB);
    }
}
