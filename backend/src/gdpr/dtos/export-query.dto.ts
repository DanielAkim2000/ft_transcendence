import { IsIn, IsOptional } from 'class-validator';

export const EXPORT_FORMATS = ['json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** [Minor · RGPD] Paramètre validé de l'export (format csv ou json). */
export class ExportQueryDto {
  /** Format du fichier téléchargé : json (défaut) ou csv (s'ouvre dans Excel / LibreOffice). */
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
