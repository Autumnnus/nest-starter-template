import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmEmailChangeDto {
  @ApiProperty({
    description: 'E-posta değişikliği doğrulama belirteci',
    example: 'ec_01JKY3S4D5F6G7H8J9K0',
  })
  @IsString()
  token!: string;
}
