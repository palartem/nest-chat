import { Module, forwardRef } from '@nestjs/common';
import { MessageService } from './message.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { ChatModule } from '../chat/chat.module';
import { UserModule } from '../user/user.module';
import { MessageResolver } from './message.resolver';

@Module({
    imports: [TypeOrmModule.forFeature([Message]), forwardRef(() => ChatModule), UserModule],
    providers: [MessageService, MessageResolver],
    exports: [MessageService],
})
export class MessageModule {}
