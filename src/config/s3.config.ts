import { registerAs } from '@nestjs/config';

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
  const bucket = process.env.AWS_S3_BUCKET ?? 'local-media-bucket';
  const region = process.env.AWS_S3_REGION ?? 'us-east-1';
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const forcePathStyle =
    (process.env.AWS_S3_FORCE_PATH_STYLE ?? 'false') === 'true';
  const publicUrl = process.env.AWS_S3_PUBLIC_URL;

  return {
    bucket,
    region,
    endpoint,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    forcePathStyle,
    publicUrl,
  };
});
