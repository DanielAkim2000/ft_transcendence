import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

/** [Major · Gestion des utilisateurs] Paramètres validés de la recherche d'utilisateurs. */
export class SearchUsersQueryDto extends PageQueryDto {
  /** Texte recherché dans le nom ou l'email. */
  @IsOptional()
  @IsString()
  q?: string;
}
