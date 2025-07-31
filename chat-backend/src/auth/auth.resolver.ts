import { Resolver, Mutation, Args, ObjectType, Field, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { User } from '../user/user.entity';

@ObjectType()
@ObjectType()
class LoginResponse {
    @Field() access_token: string;
    @Field() refresh_token: string;
    @Field(() => User) user: User;
}

@ObjectType()
class RefreshResponse {
    @Field() access_token: string;
    @Field(() => User) user: User;
}

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Mutation(() => LoginResponse)
    async login(
        @Args('email') email: string,
        @Args('password') password: string,
        @Context() context,
    ) {
        const { access_token, refresh_token, user } =
            await this.authService.login(email, password);

        context.res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 7 * 24 * 3600 * 1000,
        });

        return { access_token, refresh_token, user };
    }

    @Mutation(() => RefreshResponse)
    async refreshToken(@Context() context) {
        const refresh_token = context.req.cookies['refresh_token'];
        if (!refresh_token) throw new Error('No refresh token');

        const { access_token, refresh_token: newRefresh, user } =
            await this.authService.refreshToken(refresh_token);

        // Обновляем refresh-токен в куке
        context.res.cookie('refresh_token', newRefresh, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 7 * 24 * 3600 * 1000,
        });

        return { access_token, user };
    }

    @Mutation(() => Boolean)
    async logout(@Context() context) {
        context.res.cookie('refresh_token', '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // true в проде с HTTPS
            maxAge: 0,
        });
        return true;
    }
}
