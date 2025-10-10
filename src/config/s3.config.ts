import { registerAs } from '@nestjs/config';
import { zBooleanFlag } from 'src/common/utils/zod-helper';
import { z } from 'zod';

const s3EnvSchema = z.object({
  AWS_S3_BUCKET: z.string().trim().min(1).catch('local-media-bucket'),
  AWS_S3_REGION: z.string().trim().min(1).catch('us-east-1'),
  AWS_S3_ENDPOINT: z.string().trim().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  AWS_S3_FORCE_PATH_STYLE: zBooleanFlag,
  AWS_S3_PUBLIC_URL: z.string().trim().min(1).optional(),
});

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  publicUrl?: string;
}

export default registerAs('s3', (): S3Config => {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_S3_REGION?.trim();
  const endpoint = process.env.AWS_S3_ENDPOINT?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE;
  const publicUrl = process.env.AWS_S3_PUBLIC_URL?.trim();

  const env = s3EnvSchema.parse({
    AWS_S3_BUCKET: bucket && bucket.length > 0 ? bucket : undefined,
    AWS_S3_REGION: region && region.length > 0 ? region : undefined,
    AWS_S3_ENDPOINT: endpoint && endpoint.length > 0 ? endpoint : undefined,
    AWS_ACCESS_KEY_ID:
      accessKeyId && accessKeyId.length > 0 ? accessKeyId : undefined,
    AWS_SECRET_ACCESS_KEY:
      secretAccessKey && secretAccessKey.length > 0
        ? secretAccessKey
        : undefined,
    AWS_S3_FORCE_PATH_STYLE: forcePathStyle,
    AWS_S3_PUBLIC_URL:
      publicUrl && publicUrl.length > 0 ? publicUrl : undefined,
  });

  return {
    bucket: env.AWS_S3_BUCKET,
    region: env.AWS_S3_REGION,
    endpoint: env.AWS_S3_ENDPOINT,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE ?? false,
    publicUrl: env.AWS_S3_PUBLIC_URL,
  };
});
