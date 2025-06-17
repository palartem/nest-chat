import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { User } from '../user/user.entity';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
class LoginResponse {
    @Field()
    access_token: string;

    @Field(() => User)
    user: User;
}

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Mutation(() => LoginResponse)
    async login(
        @Args('email') email: string,
        @Args('password') password: string,
    ): Promise<{ access_token: string; user: User }> {
        return this.authService.login(email, password);
    }
}
