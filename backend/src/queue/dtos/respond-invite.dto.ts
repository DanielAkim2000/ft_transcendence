import { IsBoolean } from 'class-validator';

export class RespondInviteDto {
  @IsBoolean()
  accept!: boolean;
}
