import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private mailService: MailService,
    ) {}

    async findById(id: number): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async createUser(email: string, password: string, name?: string): Promise<User> {
        const hash = await bcrypt.hash(password, 10);
        const user = this.usersRepository.create({ email, password: hash, name });
        const savedUser = await this.usersRepository.save(user);
        await this.mailService.sendConfirmationEmail(email, savedUser.id.toString());
        return savedUser;
    }

    async confirmUser(id: string): Promise<User> {
        const numericId = Number(id);
        const user = await this.usersRepository.findOneOrFail({ where: { id: numericId } });
        user.confirmed = true;
        return this.usersRepository.save(user);
    }
}
