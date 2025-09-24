import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class UserProfileDto {
  @ApiProperty({
    required: false,
    example: 'John Doe',
    description: 'Display name (2-80 chars)',
  })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  displayName?: string;

  @ApiProperty({
    required: false,
    example: 'en-US',
    description: 'IETF language tag (ll-CC)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}-[A-Z]{2}$/)
  locale?: string;

  @ApiProperty({
    required: false,
    example: 'Full-stack developer.',
    description: 'Short bio (max 500 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}

export class UpdateUserDto {
  @ApiProperty({
    description: 'Partial profile fields to update',
    example: {
      displayName: 'John Doe',
      locale: 'en-US',
      bio: 'Full-stack developer.',
    },
  })
  @ValidateNested()
  @Type(() => UserProfileDto)
  profile!: Partial<UserProfileDto>;
}
