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

    async findByIdWithParticipants(id: number): Promise<Chat | null> {
        return this.chatsRepo.findOne({
            where: { id },
            relations: ['participants'],
        });
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
        const chats = await this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'participant')
            .where('participant.id = :userAId', { userAId: userA.id })
            .orWhere('participant.id = :userBId', { userBId: userB.id })
            .getMany();

        const matched = chats.find(chat => {
            const ids = chat.participants.map(p => p.id).sort();
            const target = [userA.id, userB.id].sort();
            return ids.length === 2 && ids[0] === target[0] && ids[1] === target[1];
        });

        if (matched) return matched;

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

    async findChatsWithMessagesForUser(userId: number): Promise<Chat[]> {
        return this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'participant')
            .leftJoinAndSelect('chat.messages', 'message')
            .leftJoinAndSelect('message.sender', 'sender')
            .where('participant.id = :userId', { userId })
            .orderBy('message.createdAt', 'DESC')
            .getMany();
    }
}
