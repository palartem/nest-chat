import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Processor('email')
export class MailProcessor {
    private transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    @Process('send_confirmation')
    async handleSendConfirmation(job: Job) {
        const { email, userId } = job.data;
        const confirmUrl = `http://localhost:3000/confirm?userId=${userId}`;

        await this.transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Confirm your registration',
            text: `Click to confirm registration: ${confirmUrl}`,
            html: `<a href="${confirmUrl}">Confirm registration</a>`,
        });
    }
}
