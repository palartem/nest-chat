import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Entity()
@ObjectType()
export class User {
    @PrimaryGeneratedColumn()
    @Field(() => ID)
    id: number;

    @Column({ unique: true })
    @Field()
    email: string;

    @Column()
    password: string; // здесь храним хэш

    @Column({ default: false })
    @Field()
    confirmed: boolean; // подтвержден ли email

    @Column({ nullable: true })
    @Field({ nullable: true })
    name?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'varchar', nullable: true })
    confirmationToken: string | null;

    @CreateDateColumn()
    @Field()
    createdAt: Date;

    @UpdateDateColumn()
    @Field()
    updatedAt: Date;
}
