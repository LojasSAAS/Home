import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import productRoutes from '@/modules/products/product.routes';
import orderRoutes from '@/modules/orders/order.routes';
import lgpdRoutes from '@/modules/lgpd/lgpd.routes';
import authRoutes from '@/modules/auth/auth.routes';
import onboardingRoutes from '@/modules/onboarding/onboarding.routes';
import { errorHandler } from '@/middlewares/error.middleware';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use(authRoutes);
  app.use(onboardingRoutes);
  app.use(productRoutes);
  app.use(orderRoutes);
  app.use(lgpdRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

  // handler de erros deve ser o último middleware
  app.use(errorHandler);

  return app;
}
