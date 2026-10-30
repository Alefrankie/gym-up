import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachRecordingsController } from './coach-recordings.controller';

// Recordings first: `coach/recordings` must not be taken for anything else.
@Module({ controllers: [CoachRecordingsController, CoachController] })
export class CoachModule {}
