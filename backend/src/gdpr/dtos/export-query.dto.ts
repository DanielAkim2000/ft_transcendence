import { IsIn, IsOptional } from 'class-validator';

export const EXPORT_FORMATS = ['json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export class ExportQueryDto {
  /** Format du fichier téléchargé : json (défaut) ou csv (s'ouvre dans Excel / LibreOffice). */
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
