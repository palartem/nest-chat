import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Processor('email')
@Injectable()
export class MailProcessor {
    private transporter;

    constructor(private config: ConfigService) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.config.get('EMAIL_USER'),
                pass: this.config.get('EMAIL_PASS'),
            },
        });
    }

    @Process('send_confirmation')
    async handleSendConfirmation(job: Job) {
        const { email, userId } = job.data;
        const confirmUrl = `${this.config.get('FRONT_URL')}/confirm?userId=${userId}`;

        await this.transporter.sendMail({
            from: this.config.get('EMAIL_USER'),
            to: email,
            subject: 'Подтверждение регистрации',
            html: `<h2>Подтвердите регистрацию</h2><p><a href="${confirmUrl}">Нажмите сюда</a></p>`,
        });
    }
}
