import { Resolver, Mutation, Args, Int, Query } from '@nestjs/graphql';
import { Message } from './message.entity';
import { MessageService } from './message.service';

@Resolver(() => Message)
export class MessageResolver {
    constructor(private msgService: MessageService) {}

    @Mutation(() => Message)
    async sendMessage(
        @Args('chatId', { type: () => Int }) chatId: number,
        @Args('senderId', { type: () => Int }) senderId: number,
        @Args('text') text: string,
    ) {
        return this.msgService.sendMessage(chatId, senderId, text);
    }

    @Query(() => [Message])
    async messages(@Args('chatId', { type: () => Int }) chatId: number) {
        return this.msgService.getMessages(chatId);
    }
}
