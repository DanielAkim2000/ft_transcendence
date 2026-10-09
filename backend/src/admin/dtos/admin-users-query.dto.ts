import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

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
