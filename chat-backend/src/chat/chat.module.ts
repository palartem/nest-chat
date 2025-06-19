import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { MessageModule } from '../message/message.module';
import { ChatResolver } from './chat.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, User]), UserModule, forwardRef(() => MessageModule)],
  providers: [ChatService, ChatGateway, ChatResolver],
  exports: [ChatService],
})
export class ChatModule {}
