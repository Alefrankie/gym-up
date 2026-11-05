import { All, Controller, GoneException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';

/**
 * Groups were retired by DR-0028: every signed-in member now sees the whole community. Old clients get an
 * explicit 410 instead of appearing to create or join groups. The tables stay until a reviewed cleanup.
 */
@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  @All()
  root(): never {
    throw new GoneException('Groups were replaced by Community. Update the app.');
  }

  @All('*path')
  any(): never {
    throw new GoneException('Groups were replaced by Community. Update the app.');
  }
}
