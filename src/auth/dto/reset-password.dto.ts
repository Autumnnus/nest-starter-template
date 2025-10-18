import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Kullanıcıya gönderilen şifre sıfırlama belirteci',
    example: 'pr_01JKY0X3C9M7S8D6T5F4A3B2C1',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'Yeni şifre',
    example: 'NewPassword#123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  newPassword!: string;
}
