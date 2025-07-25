import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Processor('email')
export class MailProcessor {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    @Process('send-confirmation')
    async handleSendConfirmation(job: Job<{ email: string; token: string }>) {
        const { email, token } = job.data;

        const frontendUrl = process.env.FRONT_URL || 'http://localhost:3000';
        const confirmUrl = `${frontendUrl}/confirm?token=${token}`;

        await this.transporter.sendMail({
            from: `"No Reply" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Подтвердите регистрацию',
            html: `
                <h3>Добро пожаловать!</h3>
                <p>Пожалуйста, подтвердите регистрацию, перейдя по ссылке:</p>
                <a href="${confirmUrl}">Подтвердить Email</a>
            `,
        });
    }
}
