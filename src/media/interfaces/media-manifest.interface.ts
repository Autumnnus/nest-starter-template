import type {
  ImageVariantName,
  MediaKind,
  MediaPurpose,
} from 'src/media/types/media.types';

export interface MediaVariantFile {
  key: string;
  size: number;
  mimeType: string;
  url?: string;
  width?: number;
  height?: number;
  format?: string;
  checksum?: string;
}

export interface MediaEncodings {
  webp?: Partial<Record<ImageVariantName, MediaVariantFile>>;
  avif?: Partial<Record<ImageVariantName, MediaVariantFile>>;
}

export interface MediaManifest {
  version: 1;
  id: string;
  bucket: string;
  basePath: string;
  manifestKey: string;
  kind: MediaKind;
  purpose: MediaPurpose;
  checksum: string;
  createdAt: string;
  original: MediaVariantFile;
  variants?: Partial<Record<ImageVariantName, MediaVariantFile>>;
  encodings?: MediaEncodings;
  metadata?: {
    sourceName: string;
    sourceSize: number;
    mimeType: string;
  };
}
