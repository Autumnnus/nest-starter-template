import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup as lookupMime, extension as mimeExtension } from 'mime-types';
import { Readable } from 'node:stream';
import Sharp from 'sharp';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  IMAGE_VARIANTS,
  type ImageVariantSpec,
} from 'src/media/constants/media.constants';
import {
  buildMediaPath,
  buildTranscodedKey,
  buildVariantKey,
} from 'src/media/utils/media-path.util';

import type { MediaConfig } from 'src/config/media.config';
import type { S3Config } from 'src/config/s3.config';
import type {
  MediaEncodings,
  MediaManifest,
  MediaVariantFile,
} from 'src/media/interfaces/media-manifest.interface';
import type {
  ImageVariantName,
  MediaKind,
  MediaPurpose,
} from 'src/media/types/media.types';

type SharpModule = typeof Sharp;

interface UploadMediaOptions {
  purpose: MediaPurpose;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl?: string;
  private readonly mediaConfig: MediaConfig;
  private sharpModule?: SharpModule;

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.getOrThrow<S3Config>('s3');
    this.mediaConfig = this.configService.getOrThrow<MediaConfig>('media');

    this.client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
      credentials:
        s3Config.accessKeyId && s3Config.secretAccessKey
          ? {
              accessKeyId: s3Config.accessKeyId,
              secretAccessKey: s3Config.secretAccessKey,
            }
          : undefined,
    });

    this.bucket = s3Config.bucket;
    this.publicUrl = s3Config.publicUrl;
  }

  async uploadMedia(
    files: Express.Multer.File[],
    options: UploadMediaOptions,
  ): Promise<MediaManifest[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'MEDIA_NO_FILES',
        message: 'At least one file must be provided.',
      });
    }

    if (files.length > this.mediaConfig.maxUploadBatch) {
      throw new BadRequestException({
        code: 'MEDIA_TOO_MANY_FILES',
        message: `A maximum of ${this.mediaConfig.maxUploadBatch} files can be uploaded at once.`,
      });
    }

    return Promise.all(
      files.map(async (file) => {
        const kind = this.detectKind(file.mimetype);
        this.validateFile(file, kind);

        if (kind === 'image') {
          return this.processImage(file, options.purpose);
        }

        return this.processBinary(file, kind, options.purpose);
      }),
    );
  }

  async deleteMediaByManifestKey(manifestKey: string): Promise<void> {
    if (!manifestKey) {
      return;
    }

    const manifest = await this.fetchManifest(manifestKey);
    if (!manifest) {
      this.logger.warn(
        `Manifest ${manifestKey} could not be loaded; skipping derived asset cleanup but removing manifest itself.`,
      );

      await this.deleteObjects([manifestKey]);
      return;
    }

    await this.deleteMedia(manifest);
  }

  async deleteMedia(manifest: MediaManifest | null | undefined): Promise<void> {
    if (!manifest) {
      return;
    }

    const keys = new Set<string>();
    keys.add(manifest.manifestKey);
    keys.add(manifest.original.key);

    if (manifest.variants) {
      for (const variant of Object.values(manifest.variants)) {
        if (variant) {
          keys.add(variant.key);
        }
      }
    }

    const encodings = manifest.encodings;
    if (encodings?.webp) {
      for (const variant of Object.values(encodings.webp)) {
        if (variant) {
          keys.add(variant.key);
        }
      }
    }

    if (encodings?.avif) {
      for (const variant of Object.values(encodings.avif)) {
        if (variant) {
          keys.add(variant.key);
        }
      }
    }

    const objectKeys = Array.from(keys);
    if (objectKeys.length === 0) {
      return;
    }

    await this.deleteObjects(objectKeys);
  }

  private async fetchManifest(
    manifestKey: string,
  ): Promise<MediaManifest | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: manifestKey }),
      );

      const body = response.Body;
      if (!body) {
        return null;
      }

      const payload = await this.streamToString(
        body as Readable | { transformToString?: () => Promise<string> },
      );
      return JSON.parse(payload) as MediaManifest;
    } catch (error) {
      const err = error as Error & {
        name?: string;
        Code?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        err.name === 'NoSuchKey' ||
        err.Code === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }

      this.logger.error(
        `Failed to load media manifest ${manifestKey} from S3: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException({
        code: 'MEDIA_MANIFEST_LOAD_FAILED',
        message: 'Failed to load media manifest from storage.',
      });
    }
  }

  private async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const input: DeleteObjectsCommandInput = {
      Bucket: this.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    };

    try {
      await this.client.send(new DeleteObjectsCommand(input));
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to delete media objects from S3: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException({
        code: 'MEDIA_DELETE_FAILED',
        message: 'Failed to delete media assets from storage.',
      });
    }
  }

  private async streamToString(
    stream: Readable | { transformToString?: () => Promise<string> },
  ): Promise<string> {
    if (
      'transformToString' in stream &&
      typeof stream.transformToString === 'function'
    ) {
      return stream.transformToString();
    }

    const readable = stream as Readable;
    const chunks: Buffer[] = [];
    return new Promise<string>((resolve, reject) => {
      readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      readable.on('error', (error) => reject(error));
      readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  private async processImage(
    file: Express.Multer.File,
    purpose: MediaPurpose,
  ): Promise<MediaManifest> {
    const sharp = await this.ensureSharp();
    const metadata = await sharp(file.buffer).metadata();

    const originalExtension = this.getExtension(file);
    const basePath = buildMediaPath({
      kind: 'image',
      purpose,
      buffer: file.buffer,
      extension: originalExtension,
    });

    const originalDescriptor: MediaVariantFile = {
      key: basePath.originalKey,
      size: file.size,
      mimeType: file.mimetype,
      url: this.buildPublicUrl(basePath.originalKey),
      width: metadata.width,
      height: metadata.height,
      format: metadata.format ?? originalExtension,
    };

    await this.putObject(basePath.originalKey, file.buffer, file.mimetype);

    const baseVariantFormat = this.resolveVariantFormat(
      metadata.format,
      originalExtension,
    );
    const variants = await this.generateImageVariants(
      sharp,
      file.buffer,
      basePath.basePath,
      baseVariantFormat,
    );

    const encodings = await this.generateImageTranscodes(
      sharp,
      file.buffer,
      basePath.basePath,
    );

    const manifest: MediaManifest = {
      version: 1,
      id: basePath.id,
      bucket: this.bucket,
      basePath: basePath.basePath,
      manifestKey: basePath.manifestKey,
      kind: 'image',
      purpose,
      checksum: basePath.checksum,
      createdAt: new Date().toISOString(),
      original: originalDescriptor,
      variants,
      encodings,
      metadata: {
        sourceName: file.originalname,
        sourceSize: file.size,
        mimeType: file.mimetype,
      },
    };

    await this.persistManifest(manifest);

    return manifest;
  }

  private async processBinary(
    file: Express.Multer.File,
    kind: MediaKind,
    purpose: MediaPurpose,
  ): Promise<MediaManifest> {
    const extension = this.getExtension(file);
    const path = buildMediaPath({
      kind,
      purpose,
      buffer: file.buffer,
      extension,
    });

    await this.putObject(path.originalKey, file.buffer, file.mimetype);

    const manifest: MediaManifest = {
      version: 1,
      id: path.id,
      bucket: this.bucket,
      basePath: path.basePath,
      manifestKey: path.manifestKey,
      kind,
      purpose,
      checksum: path.checksum,
      createdAt: new Date().toISOString(),
      original: {
        key: path.originalKey,
        size: file.size,
        mimeType: file.mimetype,
        url: this.buildPublicUrl(path.originalKey),
      },
      metadata: {
        sourceName: file.originalname,
        sourceSize: file.size,
        mimeType: file.mimetype,
      },
    };

    await this.persistManifest(manifest);

    return manifest;
  }

  private async generateImageVariants(
    sharp: SharpModule,
    buffer: Buffer,
    basePath: string,
    format: { extension: string; mimeType: string; format: string },
  ): Promise<Partial<Record<ImageVariantName, MediaVariantFile>>> {
    const variants: Partial<Record<ImageVariantName, MediaVariantFile>> = {};

    await Promise.all(
      (
        Object.entries(IMAGE_VARIANTS) as [ImageVariantName, ImageVariantSpec][]
      ).map(async ([name, spec]) => {
        const instance = sharp(buffer).rotate();
        const { data, info } = await instance
          .resize({
            width: spec.width,
            height: spec.height,
            fit: spec.fit,
            withoutEnlargement: true,
          })
          .toFormat(format.format as never, { quality: spec.quality })
          .toBuffer({ resolveWithObject: true });

        const key = buildVariantKey(basePath, name, format.extension);
        await this.putObject(key, data, format.mimeType);

        variants[name] = {
          key,
          size: data.byteLength,
          mimeType: format.mimeType,
          url: this.buildPublicUrl(key),
          width: info.width,
          height: info.height,
          format: format.format,
        };
      }),
    );

    return variants;
  }

  private async generateImageTranscodes(
    sharp: SharpModule,
    buffer: Buffer,
    basePath: string,
  ): Promise<MediaEncodings> {
    const encodings: MediaEncodings = {};

    const variantEntries = Object.entries(IMAGE_VARIANTS) as [
      ImageVariantName,
      ImageVariantSpec,
    ][];

    const generate = async (
      folder: 'webp' | 'avif',
      quality: number,
    ): Promise<Partial<Record<ImageVariantName, MediaVariantFile>>> => {
      const collection: Partial<Record<ImageVariantName, MediaVariantFile>> =
        {};

      await Promise.all(
        variantEntries.map(async ([name, spec]) => {
          const instance = sharp(buffer).rotate();
          const pipeline = instance.resize({
            width: spec.width,
            height: spec.height,
            fit: spec.fit,
            withoutEnlargement: true,
          });

          const formatter =
            folder === 'webp'
              ? pipeline.webp({ quality })
              : pipeline.avif({ quality });
          const { data, info } = await formatter.toBuffer({
            resolveWithObject: true,
          });
          const key = buildTranscodedKey(basePath, folder, name);
          const mimeType = folder === 'webp' ? 'image/webp' : 'image/avif';

          await this.putObject(key, data, mimeType);

          collection[name] = {
            key,
            size: data.byteLength,
            mimeType,
            url: this.buildPublicUrl(key),
            width: info.width,
            height: info.height,
            format: folder,
          };
        }),
      );

      return collection;
    };

    encodings.webp = await generate('webp', 82);
    encodings.avif = await generate('avif', 50);

    return encodings;
  }

  private async persistManifest(manifest: MediaManifest): Promise<void> {
    const serialized = JSON.stringify(manifest, null, 2);

    await this.putObject(
      manifest.manifestKey,
      Buffer.from(serialized, 'utf8'),
      'application/json',
      'public, max-age=300',
    );
  }

  private async putObject(
    key: string,
    body: Buffer | string,
    contentType: string,
    cacheControl = 'public, max-age=31536000, immutable',
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
        }),
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to upload object ${key} to S3: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException({
        code: 'MEDIA_UPLOAD_FAILED',
        message: 'Failed to upload media to storage.',
      });
    }
  }

  private async ensureSharp(): Promise<SharpModule> {
    if (!this.sharpModule) {
      try {
        const loaded = await import('sharp');
        this.sharpModule = loaded.default ?? loaded;
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Sharp library is required for image processing: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException({
          code: 'MEDIA_PROCESSOR_MISSING',
          message: 'Image processing library (sharp) is not available.',
        });
      }
    }

    return this.sharpModule;
  }

  private detectKind(mimeType: string): MediaKind {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }

    if (mimeType.startsWith('video/')) {
      return 'video';
    }

    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }

    return 'document';
  }

  private validateFile(file: Express.Multer.File, kind: MediaKind): void {
    if (file.size === 0) {
      throw new BadRequestException({
        code: 'MEDIA_EMPTY_FILE',
        message: 'Uploaded files cannot be empty.',
      });
    }

    switch (kind) {
      case 'image': {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          throw new BadRequestException({
            code: 'MEDIA_UNSUPPORTED_IMAGE_TYPE',
            message: 'Unsupported image MIME type.',
          });
        }

        console.log('file', file);
        console.log(
          'this.mediaConfig.maxImageBytes',
          this.mediaConfig.maxImageBytes,
        );
        if (file.size > this.mediaConfig.maxImageBytes) {
          throw new BadRequestException({
            code: 'MEDIA_IMAGE_TOO_LARGE',
            message: `Images must be ${Math.round(
              this.mediaConfig.maxImageBytes / (1024 * 1024),
            )}MB or smaller.`,
          });
        }

        break;
      }
      case 'document': {
        if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
          throw new BadRequestException({
            code: 'MEDIA_UNSUPPORTED_DOCUMENT_TYPE',
            message: 'Only PDF documents are supported.',
          });
        }

        if (file.size > this.mediaConfig.maxDocumentBytes) {
          throw new BadRequestException({
            code: 'MEDIA_DOCUMENT_TOO_LARGE',
            message: `Documents must be ${Math.round(
              this.mediaConfig.maxDocumentBytes / (1024 * 1024),
            )}MB or smaller.`,
          });
        }

        break;
      }
      case 'audio': {
        if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
          throw new BadRequestException({
            code: 'MEDIA_UNSUPPORTED_AUDIO_TYPE',
            message: 'Unsupported audio MIME type.',
          });
        }

        if (file.size > this.mediaConfig.maxDocumentBytes) {
          throw new BadRequestException({
            code: 'MEDIA_AUDIO_TOO_LARGE',
            message: `Audio files must be ${Math.round(
              this.mediaConfig.maxDocumentBytes / (1024 * 1024),
            )}MB or smaller.`,
          });
        }

        break;
      }
      case 'video': {
        if (!ALLOWED_VIDEO_MIME_TYPES.has(file.mimetype)) {
          throw new BadRequestException({
            code: 'MEDIA_UNSUPPORTED_VIDEO_TYPE',
            message: 'Unsupported video MIME type.',
          });
        }

        if (file.size > this.mediaConfig.maxDocumentBytes) {
          throw new BadRequestException({
            code: 'MEDIA_VIDEO_TOO_LARGE',
            message: `Video files must be ${Math.round(
              this.mediaConfig.maxDocumentBytes / (1024 * 1024),
            )}MB or smaller.`,
          });
        }

        break;
      }
    }
  }

  private getExtension(file: Express.Multer.File): string {
    const fromMime = mimeExtension(file.mimetype);
    if (typeof fromMime === 'string') {
      return fromMime;
    }

    const original = file.originalname.split('.').pop();
    return original ? original.toLowerCase() : 'bin';
  }

  private resolveVariantFormat(
    format: string | undefined,
    fallbackExtension: string,
  ): { extension: string; mimeType: string; format: string } {
    const normalized = (format ?? fallbackExtension).toLowerCase();

    switch (normalized) {
      case 'jpeg':
      case 'jpg':
        return { extension: 'jpg', mimeType: 'image/jpeg', format: 'jpeg' };
      case 'png':
        return { extension: 'png', mimeType: 'image/png', format: 'png' };
      case 'webp':
        return { extension: 'webp', mimeType: 'image/webp', format: 'webp' };
      case 'avif':
        return { extension: 'avif', mimeType: 'image/avif', format: 'avif' };
      case 'heif':
      case 'heic':
        return { extension: 'jpg', mimeType: 'image/jpeg', format: 'jpeg' };
      default: {
        const mime = lookupMime(normalized);
        if (mime && mime.startsWith('image/')) {
          return { extension: normalized, mimeType: mime, format: normalized };
        }

        return { extension: 'jpg', mimeType: 'image/jpeg', format: 'jpeg' };
      }
    }
  }

  private buildPublicUrl(key: string): string | undefined {
    if (!this.publicUrl) {
      return undefined;
    }

    const base = this.publicUrl.endsWith('/')
      ? this.publicUrl
      : `${this.publicUrl}/`;
    return `${base}${key}`;
  }
}
