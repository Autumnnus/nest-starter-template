import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'rt_2fZt...9xA',
    description: 'Refresh token değeri',
  })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
