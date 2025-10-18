import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'Parola sıfırlama bağlantısının gönderileceği e-posta adresi',
    example: 'user@example.com',
  })
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;
}
