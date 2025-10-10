import { registerAs } from '@nestjs/config';

export interface MediaConfig {
  maxImageBytes: number;
  maxDocumentBytes: number;
  maxUploadBatch: number;
}

const megabytesToBytes = (
  input: string | undefined,
  fallback: number,
): number => {
  if (!input) {
    return fallback;
  }

  const parsed = Number.parseFloat(input);
  return Number.isFinite(parsed) ? Math.round(parsed * 1024 * 1024) : fallback;
};

export default registerAs('media', (): MediaConfig => {
  const maxImageBytes = megabytesToBytes(
    process.env.MEDIA_MAX_IMAGE_SIZE_MB,
    10,
  );
  const maxDocumentBytes = megabytesToBytes(
    process.env.MEDIA_MAX_DOCUMENT_SIZE_MB,
    25,
  );
  const maxUploadBatch = (() => {
    const raw = process.env.MEDIA_MAX_UPLOAD_COUNT;
    if (!raw) {
      return 100;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 100;
    }

    return parsed;
  })();

  return {
    maxImageBytes,
    maxDocumentBytes,
    maxUploadBatch,
  };
});
