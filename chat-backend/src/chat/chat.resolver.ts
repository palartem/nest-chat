import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Chat } from './chat.entity';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';

@Resolver(() => Chat)
export class ChatResolver {
    constructor(
        private chatService: ChatService,
        private userService: UserService,
    ) {}

    @Mutation(() => Chat)
    async createChat(
        @Args('userAId', { type: () => Int }) userAId: number,
        @Args('userBId', { type: () => Int }) userBId: number,
    ) {
        const userA = await this.userService.findById(userAId);
        const userB = await this.userService.findById(userBId);

        if (!userA || !userB) {
            throw new Error('User not found');
        }

        return this.chatService.createChat(userA, userB);
    }

    @Query(() => [Chat])
    async chats(@Args('userId', { type: () => Int }) userId: number) {
        return this.chatService.findChatsForUser(userId);
    }

    @Mutation(() => Chat)
    getOrCreateChat(@Args('userAId') userAId: number, @Args('userBId') userBId: number) {
        return this.chatService.getOrCreateChat(userAId, userBId);
    }
}
