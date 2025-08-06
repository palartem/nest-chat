import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private mailService: MailService,
    ) {}

    async findOne(id: number): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }

    async findById(id: number): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async createUser(email: string, password: string, name?: string): Promise<User> {
        const existing = await this.findByEmail(email);
        if (existing) {
            throw new Error('Email already registered');
        }

        const hash = await bcrypt.hash(password, 10);
        const token = uuidv4();

        const user = this.usersRepository.create({
            email,
            password: hash,
            name,
            confirmed: false,
            confirmationToken: token,
        });

        const savedUser = await this.usersRepository.save(user);

        await this.mailService.sendConfirmationEmail(email, token);

        return savedUser;
    }

    async confirmByToken(token: string): Promise<User> {
        const user = await this.usersRepository.findOne({ where: { confirmationToken: token } });
        if (!user) {
            throw new Error('Invalid or expired confirmation token');
        }

        user.confirmed = true;
        user.confirmationToken = null;

        return this.usersRepository.save(user);
    }
}
