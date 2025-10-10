import type { ImageVariantName } from 'src/media/types/media.types';

export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set<string>(['application/pdf']);

export const ALLOWED_AUDIO_MIME_TYPES = new Set<string>([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
]);

export const ALLOWED_VIDEO_MIME_TYPES = new Set<string>([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

export interface ImageVariantSpec {
  width: number;
  height?: number;
  fit: 'cover' | 'inside';
  quality: number;
}

export const IMAGE_VARIANTS: Record<ImageVariantName, ImageVariantSpec> = {
  thumb: { width: 320, height: 320, fit: 'cover', quality: 85 },
  mobile: { width: 768, fit: 'inside', quality: 85 },
  web: { width: 1280, fit: 'inside', quality: 85 },
  retina: { width: 1920, fit: 'inside', quality: 90 },
};
