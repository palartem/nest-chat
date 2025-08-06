import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Chat } from './chat.entity';
import { ChatService } from './chat.service';

@Resolver(() => Chat)
export class ChatResolver {
    constructor(private chatService: ChatService) {}

    @Mutation(() => Chat)
    async getOrCreateChat(
        @Args('userAId', { type: () => Int }) userAId: number,
        @Args('userBId', { type: () => Int }) userBId: number,
    ) {
        const chat = await this.chatService.getOrCreateChat(userAId, userBId);

        if (!chat) {
            throw new Error('❌ Failed to create or find chat');
        }

        return chat;
    }

    @Query(() => [Chat])
    async chats(
        @Args('userId', { type: () => Int }) userId: number,
    ) {
        return this.chatService.findChatsForUser(userId);
    }
}
