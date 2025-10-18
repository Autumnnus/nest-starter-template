import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GoogleOAuthLoginDto {
  @ApiProperty({
    description: 'Google tarafından döndürülen ID token',
  })
  @IsString()
  idToken!: string;

  @ApiPropertyOptional({
    description: 'Cihaz benzersiz kimliği',
    example: 'android-device-123',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Cihaz adı',
    example: 'Pixel 9',
  })
  @IsOptional()
  @IsString()
  deviceName?: string;
}
