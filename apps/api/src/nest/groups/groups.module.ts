import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';

/** Retired (DR-0028): answers 410 so old clients fail visibly. */
@Module({ controllers: [GroupsController] })
export class GroupsModule {}
