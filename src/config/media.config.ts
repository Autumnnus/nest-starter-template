import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const mediaEnvSchema = z.object({
  MEDIA_MAX_IMAGE_SIZE_MB: z.coerce.number().positive().catch(10),
  MEDIA_MAX_DOCUMENT_SIZE_MB: z.coerce.number().positive().catch(25),
  MEDIA_MAX_UPLOAD_COUNT: z.coerce.number().int().positive().catch(100),
});

export interface MediaConfig {
  maxImageBytes: number;
  maxDocumentBytes: number;
  maxUploadBatch: number;
}

export default registerAs('media', (): MediaConfig => {
  const maxImageSizeMb = process.env.MEDIA_MAX_IMAGE_SIZE_MB?.trim();
  const maxDocumentSizeMb = process.env.MEDIA_MAX_DOCUMENT_SIZE_MB?.trim();
  const maxUploadCount = process.env.MEDIA_MAX_UPLOAD_COUNT?.trim();

  const env = mediaEnvSchema.parse({
    MEDIA_MAX_IMAGE_SIZE_MB:
      maxImageSizeMb && maxImageSizeMb.length > 0 ? maxImageSizeMb : undefined,
    MEDIA_MAX_DOCUMENT_SIZE_MB:
      maxDocumentSizeMb && maxDocumentSizeMb.length > 0
        ? maxDocumentSizeMb
        : undefined,
    MEDIA_MAX_UPLOAD_COUNT:
      maxUploadCount && maxUploadCount.length > 0 ? maxUploadCount : undefined,
  });

  return {
    maxImageBytes: Math.round(env.MEDIA_MAX_IMAGE_SIZE_MB * 1024 * 1024),
    maxDocumentBytes: Math.round(env.MEDIA_MAX_DOCUMENT_SIZE_MB * 1024 * 1024),
    maxUploadBatch: env.MEDIA_MAX_UPLOAD_COUNT,
  };
});
