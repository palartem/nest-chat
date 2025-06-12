import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    constructor(@InjectQueue('email') private emailQueue: Queue) {}

    async sendConfirmationEmail(email: string, userId: string) {
        await this.emailQueue.add('send_confirmation', { email, userId });
    }
}
