import { Controller, Get, Post, Query, Res, Body } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService,
    ) {}

    // Подтверждение email
    @Get('confirm')
    async confirmEmail(@Query('token') token: string, @Res() res: Response) {
        try {
            await this.userService.confirmByToken(token);
            return res.status(200).send('Email confirmed successfully!');
        } catch {
            return res.status(400).send('Invalid or expired confirmation link.');
        }
    }

    // Обновление access/refresh токенов
    @Post('refresh')
    async refresh(@Body('token') token: string) {
        return this.authService.refreshToken(token);
    }
}
