import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {GraphQLModule} from '@nestjs/graphql';
import {ApolloDriver, ApolloDriverConfig} from '@nestjs/apollo';
import {AppResolver} from './app.resolver';
import {join} from 'path';
import {ConfigModule, ConfigService} from '@nestjs/config';

import {UserModule} from './user/user.module';
import {ChatModule} from './chat/chat.module';
import {AuthModule} from './auth/auth.module';
import {MessageModule} from './message/message.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true, // чтобы не импортировать в каждый модуль вручную
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'postgres',
                host: config.get<string>('DB_HOST'),
                port: config.get<number>('DB_PORT'),
                username: config.get<string>('DB_USERNAME'),
                password: config.get<string>('DB_PASSWORD'),
                database: config.get<string>('DB_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: true,
            }),
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
            playground: true,
        }),
        UserModule,
        ChatModule,
        AuthModule,
        MessageModule,
    ],
    controllers: [],
    providers: [AppResolver],
})
export class AppModule {
}
