import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

/** [Major · Permissions avancées] Paramètres validés de la liste admin des utilisateurs (pagination, recherche, filtre de rôle). */
export class AdminUsersQueryDto extends PageQueryDto {
  /** Texte recherché dans le nom, l'email ou le login 42. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** `true` : uniquement les utilisateurs actuellement bannis. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  banned?: boolean;
}
