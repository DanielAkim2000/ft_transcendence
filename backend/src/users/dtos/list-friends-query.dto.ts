import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

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
