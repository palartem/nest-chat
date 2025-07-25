import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserInput } from './dto/create-user.input';

@Resolver(() => User)
export class UserResolver {
    constructor(private userService: UserService) {}

    @Mutation(() => User)
    async register(
        @Args('data') data: CreateUserInput,
    ): Promise<User> {
        const existing = await this.userService.findByEmail(data.email);
        if (existing) {
            throw new Error('Email already registered');
        }
        const user = await this.userService.createUser(data.email, data.password, data.name);
        return user;
    }

    @Mutation(() => User)
    async confirmEmail(
        @Args('token') token: string,
    ): Promise<User> {
        return this.userService.confirmByToken(token);
    }

    @Query(() => User, { nullable: true })
    @UseGuards(GqlAuthGuard)
    async me(@Context() context): Promise<User | null> {
        return this.userService.findById(context.req.user.id);
    }
}
