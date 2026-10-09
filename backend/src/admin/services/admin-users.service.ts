import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { GdprService } from '../../gdpr/gdpr.service';
import { Role } from '../../users/entities/users.entity';
import { Paginated, toPaginated } from '../../common/pagination/paginated';
import {
  AdminUsersRepository,
  type AdminUserView,
} from '../repositories/admin-users.repository';
import { AdminUsersQueryDto } from '../dtos/admin-users-query.dto';
import { CreateAdminUserDto } from '../dtos/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dtos/update-admin-user.dto';

@Injectable()
export class AdminUsersService {
  /** Injecte les dépendances : AdminUsersRepository, GdprService. */
  constructor(
    private readonly adminUsersRepository: AdminUsersRepository,
    private readonly gdprService: GdprService,
  ) {}

  /** Une page d'utilisateurs, avec recherche par nom, email ou login 42. */
  async list(query: AdminUsersQueryDto): Promise<Paginated<AdminUserView>> {
    const { users, total } = await this.adminUsersRepository.list(
      query.q,
      query,
      query.banned ?? false,
    );
    return toPaginated(users, total, query);
  }

  /** Retrouve un utilisateur actif ou lève une NotFoundException. */
  async getById(id: string): Promise<AdminUserView> {
    const user = await this.adminUsersRepository.findById(id);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    return user;
  }

  /** Crée un compte (mot de passe haché, rôle USER par défaut) ; lève une ConflictException si l'email est déjà pris. */
  async create(dto: CreateAdminUserDto): Promise<AdminUserView> {
    await this.assertEmailAvailable(dto.email);
    return this.adminUsersRepository.create({
      email: dto.email,
      displayname: dto.displayname,
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role ?? Role.USER,
    });
  }

  /** Modifie les champs fournis. Un administrateur ne peut pas se rétrograder lui-même et il doit toujours rester au moins un administrateur. */
  async update(
    adminId: string,
    id: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserView> {
    const target = await this.getById(id);
    if (dto.email !== undefined && dto.email !== target.email) {
      await this.assertEmailAvailable(dto.email);
    }
    if (dto.role !== undefined && dto.role !== target.role) {
      if (id === adminId) {
        throw new BadRequestException({
          message: 'You cannot change your own role',
          code: 'CANNOT_CHANGE_OWN_ROLE',
        });
      }
      if (target.role === Role.ADMIN) {
        await this.assertAnotherAdminRemains();
      }
    }
    return this.adminUsersRepository.update(id, {
      email: dto.email,
      displayname: dto.displayname,
      role: dto.role,
      passwordHash: dto.password
        ? await bcrypt.hash(dto.password, 10)
        : undefined,
    });
  }

  /** Supprime (anonymise) un compte avec les mêmes règles que la suppression par l'utilisateur (tournoi ou partie en cours = refus). Un administrateur ne peut pas se supprimer lui-même ni supprimer le dernier administrateur. */
  async remove(adminId: string, id: string): Promise<void> {
    if (id === adminId) {
      throw new BadRequestException({
        message: 'You cannot delete your own account here',
        code: 'CANNOT_DELETE_OWN_ACCOUNT_HERE',
      });
    }
    const target = await this.getById(id);
    if (target.role === Role.ADMIN) {
      await this.assertAnotherAdminRemains();
    }
    await this.gdprService.eraseAccount(id);
  }

  /** Lève une ConflictException si un autre compte utilise déjà cet email. */
  private async assertEmailAvailable(email: string): Promise<void> {
    if (await this.adminUsersRepository.findIdByEmail(email)) {
      throw new ConflictException({
        message: 'Email already in use',
        code: 'EMAIL_ALREADY_USED',
      });
    }
  }

  /** Lève une ConflictException s'il n'y a qu'un seul administrateur (celui-ci ne peut pas disparaître). */
  private async assertAnotherAdminRemains(): Promise<void> {
    if ((await this.adminUsersRepository.countAdmins()) <= 1) {
      throw new ConflictException({
        message: 'At least one administrator must remain',
        code: 'LAST_ADMIN',
      });
    }
  }
}
