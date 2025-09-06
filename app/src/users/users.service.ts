import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entity/user.entity';
import { Role } from './enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    const savedUser = await this.usersRepository.save(user);
    return savedUser;
  }

  async findAll(filterDto: Partial<FilterUserDto> = {}): Promise<User[]> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (filterDto.search) {
      queryBuilder.andWhere(
        '(LOWER(user.email) LIKE LOWER(:search) OR LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search))',
        { search: `%${filterDto.search}%` },
      );
    }

    if (filterDto.role) {
      queryBuilder.andWhere(':role = ANY(user.roles)', {
        role: filterDto.role,
      });
    }

    if (filterDto.isEmailVerified !== undefined) {
      queryBuilder.andWhere('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: filterDto.isEmailVerified,
      });
    }

    if (filterDto.limit) {
      queryBuilder.take(filterDto.limit);
    }
    if (filterDto.offset) {
      queryBuilder.skip(filterDto.offset);
    }

    // Tri par date de création
    const sortOrder = filterDto.sortByCreatedAt === 'asc' ? 'ASC' : 'DESC';
    queryBuilder.orderBy('user.createdAt', sortOrder);

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ): Promise<User> {
    const userToUpdate = await this.findOne(id);

    // An admin can update anyone.
    // A regular user can only update their own profile.
    if (
      !currentUser.roles.includes(Role.ADMIN) &&
      currentUser.id !== userToUpdate.id
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits pour modifier cet utilisateur.",
      );
    }

    Object.assign(userToUpdate, updateUserDto);
    return this.usersRepository.save(userToUpdate);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'password',
        'isActive',
        'profilePicture',
        'createdAt',
        'updatedAt',
        'stocks',
        'preferences',
        'notificationSettings',
        'fcmToken',
        'roles',
        'isEmailVerified',
      ],
    });
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

  async updateEmailVerification(
    userId: string,
    verified: boolean,
  ): Promise<User> {
    const user = await this.findOne(userId);
    await this.usersRepository.update(userId, { isEmailVerified: verified });
    return this.findOne(userId);
  }
}
