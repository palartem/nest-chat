import { Resolver, Mutation, Args, ObjectType, Field } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { User } from '../user/user.entity';

@ObjectType()
class LoginResponse {
    @Field() access_token: string;
    @Field() refresh_token: string;
    @Field(() => User) user: User;
}

@ObjectType()
class RefreshResponse {
    @Field() access_token: string;
    @Field() refresh_token: string;
}

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Mutation(() => LoginResponse)
    async login(
        @Args('email') email: string,
        @Args('password') password: string,
    ) {
        return this.authService.login(email, password);
    }

    @Mutation(() => RefreshResponse)
    async refreshToken(@Args('token') token: string) {
        return this.authService.refreshToken(token);
    }
}
