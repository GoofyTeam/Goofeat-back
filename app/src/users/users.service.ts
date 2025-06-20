import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entity/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findOneWithPassword(id: string): Promise<User> {
    // Utiliser la nouvelle API de TypeORM pour sélectionner des champs spécifiques
    const user = await this.usersRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'password',
        'isActive',
        'googleId',
        'appleId',
        'profilePicture',
        'createdAt',
        'updatedAt',
        'preferences',
        'notificationSettings',
      ],
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }

    return user;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    const user = await this.findOne(id);
    await this.usersRepository.update(id, { password: hashedPassword });
    return user;
  }

  async updateOAuthInfo(
    userId: string,
    provider: string,
    providerId: string,
    profilePicture?: string,
  ): Promise<User> {
    const user = await this.findOne(userId);

    if (provider === 'google') {
      user.googleId = providerId;
    } else if (provider === 'apple') {
      user.appleId = providerId;
    }

    if (profilePicture) {
      user.profilePicture = profilePicture;
    }

    return this.usersRepository.save(user);
  }
}
