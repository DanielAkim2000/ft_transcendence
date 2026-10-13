import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MatchFormat } from '../../matches/entities/match.entity';

/** [Minor · Tournois] Inscription (un ou deux joueurs) à la création d'un tournoi. */
export class TournamentEntryDto {
  @IsString()
  @IsNotEmpty()
  player1Id!: string;

  @IsOptional()
  @IsString()
  player2Id?: string;
}

/** [Minor · Tournois] Corps validé de création d'un tournoi (nom, format, aller-retour, inscriptions). */
export class CreateTournamentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsEnum(MatchFormat)
  format!: MatchFormat;

  @IsOptional()
  @IsBoolean()
  twoLegged?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TournamentEntryDto)
  entries?: TournamentEntryDto[];
}
