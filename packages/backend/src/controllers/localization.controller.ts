import type { Request, Response } from 'express';
import { localizationService } from '../services/index.js';
import type { LocalizeRequestInput, UpdateLocalizedContentInput } from '../validators/index.js';
import type { Locale, Platform } from '../types/index.js';

export class LocalizationController {
  async localize(
    req: Request<{ angleId: string }, unknown, LocalizeRequestInput>,
    res: Response
  ) {
    const result = await localizationService.localizeAngle({
      angleId: req.params.angleId,
      locales: req.body.locales,
      platforms: req.body.platforms,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async getByAngle(
    req: Request<
      { angleId: string },
      unknown,
      unknown,
      { locale?: string; platform?: string }
    >,
    res: Response
  ) {
    const contents = await localizationService.getLocalizedContent(
      req.params.angleId,
      req.query.locale as Locale | undefined,
      req.query.platform as Platform | undefined
    );

    res.json({
      success: true,
      data: contents,
    });
  }

  async getById(req: Request<{ id: string }>, res: Response) {
    const content = await localizationService.getLocalizedContentById(req.params.id);
    res.json({
      success: true,
      data: content,
    });
  }

  async update(
    req: Request<{ id: string }, unknown, UpdateLocalizedContentInput>,
    res: Response
  ) {
    const content = await localizationService.updateLocalizedContent(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      data: content,
    });
  }

  async delete(req: Request<{ id: string }>, res: Response) {
    await localizationService.deleteLocalizedContent(req.params.id);
    res.status(204).send();
  }

  async regenerate(
    req: Request<
      { angleId: string },
      unknown,
      { locale: Locale; platform: Platform }
    >,
    res: Response
  ) {
    const content = await localizationService.regenerateLocalization(
      req.params.angleId,
      req.body.locale,
      req.body.platform
    );

    res.status(201).json({
      success: true,
      data: content,
    });
  }
}

export const localizationController = new LocalizationController();
