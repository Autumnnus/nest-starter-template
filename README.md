<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

Copy the example environment file and adjust the database credentials as needed:

```bash
$ cp .env.example .env
```

## Environment configuration

The application connects to PostgreSQL through TypeORM. The most relevant settings are:

| Variable | Description | Default |
| --- | --- | --- |
| `DB_HOST` | Database host name | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_NAME` | Database name | `nest_app` |
| `DB_SYNCHRONIZE` | Enables automatic schema sync in non-production environments | `true` |
| `DB_LOGGING` | Enables SQL logging | `true` |
| `DB_SSL` | Enables SSL when set to `true` | `false` |
| `DB_SEED` | Seeds demo users for local development | `true` |

You can spin up a local PostgreSQL instance with Docker:

```bash
docker run --name nest-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nest_app -p 5432:5432 -d postgres:16
```

### Media storage (S3-compatible)

Static media is stored in Amazon S3 (or any S3-compatible service). Configure the following variables to connect your bucket:

| Variable | Description | Default |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | Access key for the S3 user | `local-access-key` |
| `AWS_SECRET_ACCESS_KEY` | Secret key for the S3 user | `local-secret-key` |
| `AWS_S3_BUCKET` | Bucket name that stores media assets | `local-media-bucket` |
| `AWS_S3_REGION` | AWS region of the bucket | `us-east-1` |
| `AWS_S3_ENDPOINT` | Optional custom endpoint (MinIO, Cloudflare R2, etc.) | `http://localhost:9000` |
| `AWS_S3_FORCE_PATH_STYLE` | Force path-style URLs (set to `true` for MinIO) | `true` |
| `AWS_S3_PUBLIC_URL` | Public base URL to expose uploaded files | `http://localhost:9000/local-media-bucket` |

Media validation thresholds can be tuned with:

| Variable | Description | Default |
| --- | --- | --- |
| `MEDIA_MAX_IMAGE_SIZE_MB` | Maximum allowed image size | `10` |
| `MEDIA_MAX_DOCUMENT_SIZE_MB` | Maximum allowed PDF/audio/video size | `25` |
| `MEDIA_MAX_UPLOAD_COUNT` | Maximum number of files accepted in a batch | `100` |

For local development you can emulate S3 with [MinIO](https://min.io/) using Docker:

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=local-access-key \
  -e MINIO_ROOT_PASSWORD=local-secret-key \
  minio/minio server /data --console-address :9001
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Database schema

The project auto-loads TypeORM entities and maps them to PostgreSQL tables using a layered architecture.

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `email` | `varchar(160)` | Unique, stored lowercase |
| `password_hash` | `varchar(255)` | Argon2 hash |
| `roles` | `Role[]` | Array enum (`USER`, `ADMIN`, `MODERATOR`) |
| `profile_display_name` | `varchar(80)` | Profile display name |
| `profile_locale` | `varchar(10)` | Default `en-US` |
| `profile_bio` | `text` | Nullable |
| `profile_photo_key` | `text` | Nullable, stores S3 manifest key (Amazon ID) |
| `created_at` | `timestamptz` | Managed by TypeORM |
| `updated_at` | `timestamptz` | Managed by TypeORM |

### `auth_sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Foreign key to `users.id` |
| `refresh_token` | `varchar(192)` | Unique refresh token |
| `expires_at` | `timestamptz` | Session expiry |
| `last_accessed_at` | `timestamptz` | Updated on activity |
| `device` | `jsonb` | Optional device metadata |
| `created_at` | `timestamptz` | Managed by TypeORM |
| `updated_at` | `timestamptz` | Managed by TypeORM |

With `DB_SEED=true`, three demo accounts (learner, instructor, admin) are created with hashed passwords for quick testing.

## Media management

Uploads funnel through the `MediaService`, which centralizes validation, variant generation (via [`sharp`](https://sharp.pixelplumbing.com/)), and storage in S3. Files follow the structure:

```
media/{kind}/{purpose}/{yyyy}/{mm}/{dd}/{sha12}-{uuid}/
  original.{ext}
  manifest.json
  variants/
    thumb.{ext}
    mobile.{ext}
    web.{ext}
    retina.{ext}
    webp/{thumb|mobile|web|retina}.webp
    avif/{thumb|mobile|web|retina}.avif
```

Use the following endpoints (also available via Swagger UI) to manage profile photos:

| Method & Path | Description |
| --- | --- |
| `POST /users/{id}/profile-photo` | Uploads or replaces the authenticated user's profile photo. Accepts JPEG/PNG/WebP/AVIF/HEIC up to 10 MB. |
| `DELETE /users/{id}/profile-photo` | Removes the existing profile photo and purges all S3 variants. |

Each successful upload stores a `manifest.json` containing the original object and generated variants, enabling clients to consume the correct rendition for mobile, web, or retina displays.

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
