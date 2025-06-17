import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable, CreateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../user/user.entity';
import { Message } from '../message/message.entity';

@Entity()
@ObjectType()
export class Chat {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number;

    // Участники чата
    @Field(() => [User])
    @ManyToMany(() => User)
    @JoinTable()
    participants: User[];

    // Дата создания
    @Field()
    @CreateDateColumn()
    createdAt: Date;
}
