import { Router, Response, Request } from 'express';
import { get, run } from '../db.js';

const router = Router();

// POST /api/verify/validate-otp
router.post('/validate-otp', (req: Request, res: Response): void => {
  try {
    const { verificationId, code } = req.body;
    if (!verificationId || !code) {
      res.status(400).json({ valid: false, error: 'Verification ID and code are required.' });
      return;
    }

    const record = get<any>(
      'SELECT * FROM verification_codes WHERE id = ? AND verified = 0 AND expires_at > ?',
      [verificationId, Date.now()]
    );

    if (!record) {
      res.status(400).json({ valid: false, error: 'Authorization code has expired or does not exist.' });
      return;
    }

    if (record.code !== code.trim()) {
      res.status(400).json({ valid: false, error: 'Incorrect authorization code.' });
      return;
    }

    res.json({
      valid: true,
      purpose: record.purpose,
      message: 'Code successfully verified.',
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: 'Verification check failed.' });
  }
});

// GET /api/verify/info/:id
router.get('/info/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const record = get<any>(
      'SELECT id, purpose, email, phone, expires_at, verified, created_at FROM verification_codes WHERE id = ?',
      [id]
    );

    if (!record) {
      res.status(404).json({ error: 'Verification session not found.' });
      return;
    }

    res.json({
      id: record.id,
      purpose: record.purpose,
      expired: Date.now() > record.expires_at,
      verified: record.verified === 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to inspect verification.' });
  }
});

export default router;
