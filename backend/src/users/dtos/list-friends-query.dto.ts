import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

/** [Major · Gestion des utilisateurs] Paramètres validés de la liste d'amis (pagination, recherche, filtre en ligne). */
export class ListFriendsQueryDto extends PageQueryDto {
  /** Texte recherché dans le nom ou l'email des amis. */
  @IsOptional()
  @IsString()
  q?: string;

  /** Ne garder que les amis actuellement en ligne. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  online?: boolean;
}
