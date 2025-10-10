import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { USER_SCOPE_METADATA_KEY } from 'src/common/decorators/user-scope.constants';
import { UserScopeGuard } from 'src/common/guards/user-scope.guard';

import type {
  ResolvedUserScopeOptions,
  UserScopeOptions,
} from 'src/common/decorators/user-scope.constants';

export const UserScope = (options?: UserScopeOptions) => {
  const metadata: ResolvedUserScopeOptions = {
    paramKey: options?.paramKey ?? 'userId',
    allowRoles: options?.allowRoles ?? [],
  };

  return applyDecorators(
    SetMetadata(USER_SCOPE_METADATA_KEY, metadata),
    UseGuards(UserScopeGuard),
  );
};
