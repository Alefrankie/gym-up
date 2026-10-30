import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachRecordingsController } from './coach-recordings.controller';
import { StudioController } from './studio.controller';

// Recordings first: `coach/recordings` must not be taken for anything else.
@Module({ controllers: [CoachRecordingsController, StudioController, CoachController] })
export class CoachModule {}
