import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';

@Module({ controllers: [CoachController] })
export class CoachModule {}
