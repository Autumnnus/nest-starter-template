import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class RequestEmailChangeDto {
  @ApiProperty({
    description: 'Yeni e-posta adresi',
    example: 'new.email@example.com',
  })
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  newEmail!: string;
}
