import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { MessageModule } from '../message/message.module';
import { ChatResolver } from './chat.resolver';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([Chat, User]),
        UserModule,
        forwardRef(() => MessageModule),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: config.get<string>('JWT_EXPIRES_IN') || '3600s',
                },
            }),
        }),
    ],
    providers: [ChatService, ChatGateway, ChatResolver],
    exports: [ChatService],
})
export class ChatModule {}
