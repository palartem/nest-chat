import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MailService {
    constructor(@InjectQueue('email') private emailQueue: Queue) {}

    async sendConfirmationEmail(email: string, token: string) {
        await this.emailQueue.add('send-confirmation', {
            email,
            token,
        });
    }
}
