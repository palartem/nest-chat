import { Resolver, Mutation, Args, Int, Query } from '@nestjs/graphql';
import { MessageService } from './message.service';
import { Message } from './message.entity';
import { UserService } from '../user/user.service';
import { ChatService } from '../chat/chat.service';

@Resolver(() => Message)
export class MessageResolver {
    constructor(
        private readonly msgService: MessageService,
        private readonly userService: UserService,
        private readonly chatService: ChatService,
    ) {}

    @Mutation(() => Message)
    async sendMessage(
        @Args('chatId', { type: () => Int }) chatId: number,
        @Args('senderId', { type: () => Int }) senderId: number,
        @Args('text') text: string,
    ) {
        const sender = await this.userService.findById(senderId);
        const chat = await this.chatService.findByIdWithParticipants(chatId);

        if (!sender || !chat) {
            throw new Error('Sender or Chat not found');
        }

        const isParticipant = chat.participants.some(user => user.id === sender.id);
        if (!isParticipant) {
            throw new Error('Sender is not a participant of this chat');
        }

        return this.msgService.createMessage(sender, chat, text);
    }

    @Query(() => [Message])
    async getMessages(@Args('chatId', { type: () => Int }) chatId: number) {
        return this.msgService.getMessagesForChat(chatId);
    }
}
