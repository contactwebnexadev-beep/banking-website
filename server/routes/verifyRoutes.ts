import { Router, Response, Request } from 'express';
import { VerificationCode } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';

const router = Router();
router.use(requireDatabase);

// POST /api/verify/validate-otp
router.post('/validate-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId, code } = req.body;
    if (!verificationId || !code) {
      res.status(400).json({ valid: false, error: 'Verification ID and code are required.' });
      return;
    }

    const record = await VerificationCode.findOne({
      id: verificationId, verified: false, expires_at: { $gt: Date.now() },
    }).lean<any>();

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
    res.status(500).json({ valid: false, error: errorMessage(err, 'Verification check failed.') });
  }
});

// GET /api/verify/info/:id
router.get('/info/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await VerificationCode.findOne({ id })
      .select('id purpose email phone expires_at verified created_at').lean<any>();

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
    res.status(500).json({ error: errorMessage(err, 'Failed to inspect verification.') });
  }
});

export default router;
