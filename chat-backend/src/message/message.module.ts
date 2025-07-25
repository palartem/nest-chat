import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Chat } from '../chat/chat.entity'; // ✅ добавляем Chat
import { MessageService } from './message.service';
import { MessageResolver } from './message.resolver';
import { ChatModule } from '../chat/chat.module';
import { UserModule } from '../user/user.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Message, Chat]),
        forwardRef(() => ChatModule),
        UserModule,
    ],
    providers: [MessageService, MessageResolver],
    exports: [MessageService],
})
export class MessageModule {}
