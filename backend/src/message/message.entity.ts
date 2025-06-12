import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../user/user.entity';
import { Chat } from '../chat/chat.entity';

@Entity()
@ObjectType()
export class Message {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number;

    @Field()
    @Column()
    text: string;

    @Field(() => User)
    @ManyToOne(() => User)
    sender: User;

    @Field(() => Chat)
    @ManyToOne(() => Chat)
    chat: Chat;

    @Field()
    @CreateDateColumn()
    createdAt: Date;
}
