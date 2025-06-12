import { Resolver, Mutation, Args } from '@nestjs/graphql';
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
        // здесь должна быть логика добавления задачи в очередь для отправки email (потом)
        return user;
    }

    @Mutation(() => User)
    async confirmEmail(
        @Args('userId') userId: string,
    ): Promise<User> {
        return this.userService.confirmUser(userId);
    }
}
