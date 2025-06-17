import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
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

    async sendConfirmationEmail(email: string, userId: string) {
        const confirmUrl = `http://localhost:3000/confirm?userId=${userId}`;

        const mailOptions = {
            from: `"No Reply" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Подтвердите регистрацию',
            html: `
        <h3>Добро пожаловать!</h3>
        <p>Пожалуйста, подтвердите регистрацию, перейдя по ссылке:</p>
        <a href="${confirmUrl}">Подтвердить Email</a>
      `,
        };

        await this.transporter.sendMail(mailOptions);
    }
}
