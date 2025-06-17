import { Controller, Get, Query, Res } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Response } from 'express';

@Controller('confirm')
export class AuthController {
    constructor(private readonly userService: UserService) {}aa

    @Get()
    async confirmEmail(@Query('userId') userId: string, @Res() res: Response) {
        try {
            await this.userService.confirmUser(userId);
            return res.status(200).send('Email confirmed successfully!');
        } catch (err) {
            return res.status(400).send('Invalid confirmation link.');
        }
    }
}
