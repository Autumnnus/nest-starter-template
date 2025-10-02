import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Kullanıcı e-postası',
  })
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @ApiProperty({
    example: '123123',
    description: 'Kullanıcı şifresi',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @ApiPropertyOptional({
    example: 'ios-uuid-123',
    description: 'Cihaz benzersiz kimliği',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'iPhone 15 Pro',
    description: 'Cihaz görünür adı',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
