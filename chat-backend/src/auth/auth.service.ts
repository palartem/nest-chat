import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { User } from '../user/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
    ) {}

    async validateUser(email: string, password: string): Promise<User> {
        const user = await this.userService.findByEmail(email);
        if (!user) throw new UnauthorizedException('User not found');

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) throw new UnauthorizedException('Invalid password');

        return user;
    }

    private async getTokens(user: User) {
        const payload = { sub: user.id, email: user.email };

        const access_token = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN || '3600s',
        });

        const refresh_token = this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        });

        return { access_token, refresh_token };
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);
        return { ...(await this.getTokens(user)), user };
    }

    async refreshToken(token: string) {
        try {
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_REFRESH_SECRET,
            });

            const user = await this.userService.findById(payload.sub);
            if (!user) throw new UnauthorizedException('User not found');

            return { ...(await this.getTokens(user)), user };
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }
}
