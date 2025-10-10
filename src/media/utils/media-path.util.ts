import { createHash, randomUUID } from 'node:crypto';

import type { MediaKind, MediaPurpose } from 'src/media/types/media.types';

export interface MediaPathContext {
  basePath: string;
  checksum: string;
  id: string;
  originalKey: string;
  manifestKey: string;
}

export interface BuildMediaPathInput {
  kind: MediaKind;
  purpose: MediaPurpose;
  buffer: Buffer;
  extension: string;
  now?: Date;
}

export const buildMediaPath = ({
  kind,
  purpose,
  buffer,
  extension,
  now = new Date(),
}: BuildMediaPathInput): MediaPathContext => {
  const checksum = createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 12);
  const id = randomUUID();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  const safePurpose = purpose.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  const basePath = `media/${kind}/${safePurpose}/${year}/${month}/${day}/${checksum}-${id}`;
  const sanitizedExt = extension.replace(/[^a-z0-9.]/gi, '').toLowerCase();
  const originalKey = `${basePath}/original.${sanitizedExt}`;
  const manifestKey = `${basePath}/manifest.json`;

  return {
    basePath,
    checksum,
    id,
    originalKey,
    manifestKey,
  };
};

export const buildVariantKey = (
  basePath: string,
  variant: string,
  extension: string,
): string => `${basePath}/variants/${variant}.${extension}`;

export const buildTranscodedKey = (
  basePath: string,
  folder: 'webp' | 'avif',
  variant: string,
): string => `${basePath}/variants/${folder}/${variant}.${folder}`;
