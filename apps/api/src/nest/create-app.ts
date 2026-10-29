import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';
import express, { type Express } from 'express';
import { AppModule, type AppDeps } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

/** Origins allowed to call the API from a browser or the Tauri webview (ADR-027). */
const ALLOWED_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'http://localhost:5173',
]);

export interface CreatedApp {
  app: INestApplication;
  express: Express;
}

/** Builds the Nest application. The entry point decides how it is served (Worker or test). */
export async function createApp(deps: AppDeps, extraOrigins: string[] = []): Promise<CreatedApp> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule.register(deps), new ExpressAdapter(expressApp), {
    logger: ['error', 'warn'],
  });

  const origins = new Set([...ALLOWED_ORIGINS, ...extraOrigins]);
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || origins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 600,
  });
  app.useGlobalFilters(new DomainExceptionFilter());

  await app.init();
  return { app, express: expressApp };
}
