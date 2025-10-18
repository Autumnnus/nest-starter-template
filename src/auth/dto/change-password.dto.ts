import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mevcut şifre',
    example: 'CurrentPassword#123',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  currentPassword!: string;

  @ApiProperty({
    description: 'Yeni şifre',
    example: 'NewPassword#456',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  newPassword!: string;
}
