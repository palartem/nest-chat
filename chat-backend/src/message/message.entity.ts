import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
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
    sender: User;

    @ManyToOne(() => Chat, (chat) => chat.messages)
    chat: Chat;
}
