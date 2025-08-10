import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Chat } from '../chat/chat.entity';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Entity()
@ObjectType()
export class Message {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number;

    @Field()
    @Column()
    content: string;

    @Field()
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => User)
    @ManyToOne(() => User, { eager: true })
    @JoinColumn()
    sender: User;

    @Field(() => Chat)
    @ManyToOne(() => Chat, (chat) => chat.messages, { eager: false })
    @JoinColumn({ name: 'chatId' })
    chat: Chat;
}
