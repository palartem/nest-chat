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
        if (userA.id === userB.id) {
            throw new Error('❌ Нельзя создать чат с самим собой');
        }
        console.log('userA:', userA, 'userB', userB);
        return this.chatsRepo.save(chat);
    }

    async findChatsForUser(userId: number): Promise<Chat[]> {
        return this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoin('chat.participants', 'participant')
            .leftJoinAndSelect('chat.participants', 'allParticipants')
            .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
            .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
            .where('participant.id = :userId', { userId })
            .orderBy('lastMessage.createdAt', 'DESC', 'NULLS LAST')
            .getMany();
    }

    async findOrCreateChat(userA: User, userB: User): Promise<Chat> {
        const chats = await this.chatsRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'participant')
            .getMany();

        const matched = chats.find((chat) => {
            const ids = chat.participants.map((p) => p.id).sort();
            const target = [userA.id, userB.id].sort();
            return ids.length === 2 && ids[0] === target[0] && ids[1] === target[1];
        });

        let chat: Chat | null = null;

        if (matched) {
            chat = await this.chatsRepo.findOne({
                where: { id: matched.id },
                relations: ['participants', 'lastMessage'],
            });
        } else {
            const newChat = await this.createChat(userA, userB);
            chat = await this.chatsRepo.findOne({
                where: { id: newChat.id },
                relations: ['participants', 'lastMessage'],
            });
        }

        if (!chat) {
            throw new Error('❌ Chat could not be found or created');
        }

        return chat;
    }

    async getOrCreateChat(userAId: number, userBId: number): Promise<Chat> {
        const userA = await this.usersRepo.findOneBy({ id: userAId });
        const userB = await this.usersRepo.findOneBy({ id: userBId });

        if (!userA || !userB) {
            throw new Error('❌ One or both users not found');
        }

        const chat = await this.findOrCreateChat(userA, userB);

        const fullChat = await this.chatsRepo.findOne({
            where: { id: chat.id },
            relations: ['participants', 'lastMessage'],
        });

        if (!fullChat) {
            throw new Error('❌ Failed to load full chat data');
        }

        return fullChat;
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
