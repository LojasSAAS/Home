import { Router, Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';

const router = Router();

/**
 * POST /users/:id/terms-acceptance
 * Registra o aceite dos Termos de Uso / LGPD com timestamp e versão.
 */
router.post('/users/:id/terms-acceptance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { terms_version } = req.body as { terms_version: string };

    if (!terms_version) {
      return res.status(400).json({ error: 'terms_version é obrigatório' });
    }

    const result = await query(
      `UPDATE users
          SET lgpd_accepted = TRUE, terms_accepted_at = now(), terms_version = $1
        WHERE id = $2
        RETURNING id, lgpd_accepted, terms_accepted_at, terms_version`,
      [terms_version, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /users/:id
 * Direito ao esquecimento (LGPD art. 18). Não apaga fisicamente o histórico
 * de pedidos (necessário para o lojista e para obrigações fiscais dele),
 * mas anonimiza os dados pessoais do usuário e marca a exclusão.
 */
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE users
          SET name = 'Usuário Removido',
              email = CONCAT('deleted-', id, '@removed.local'),
              cpf = NULL,
              phone = NULL,
              password_hash = '',
              is_active = FALSE,
              deletion_requested_at = now()
        WHERE id = $1
        RETURNING id, deletion_requested_at`,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({ message: 'Dados pessoais anonimizados', ...result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
