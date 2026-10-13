import { UserEntity } from '../entities/users.entity';

/** [Major · Gestion des utilisateurs] Contrat du dépôt des utilisateurs. */
export interface IUsersRepository {
  findAll(page: number, limit: number): Promise<UserEntity[]>;
  findById(id: string): Promise<UserEntity | null>;
  create(user: Omit<UserEntity, 'id'>): Promise<UserEntity>;
  update(id: string, user: Omit<UserEntity, 'id'>): Promise<UserEntity | null>;
  delete(id: string): Promise<boolean>;
}
