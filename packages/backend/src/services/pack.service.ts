import { createWriteStream, mkdirSync, existsSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import {
  projectRepository,
  angleRepository,
  localizedContentRepository,
  packRepository,
} from '../repositories/index.js';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { NotFoundError, ValidationError } from '../types/index.js';
import type { PackManifest, Locale, Platform } from '../types/index.js';
import type { CreativePack, LocalizedContent } from '@prisma/client';
import type { ReadStream } from 'fs';
import type { CreatePackInput as CreatePackBody } from '../validators/index.js';

const logger = createChildLogger('pack-service');

// Service-specific type that includes projectId from route params
export interface CreatePackInput extends CreatePackBody {
  projectId: string;
}

export interface PackDownload {
  stream: ReadStream;
  filename: string;
  size: number;
}

class PackService {
  private storagePath: string;

  constructor() {
    this.storagePath = config.STORAGE_PATH;
    this.ensureStorageExists();
  }

  private ensureStorageExists() {
    const packsDir = join(this.storagePath, 'packs');
    if (!existsSync(packsDir)) {
      mkdirSync(packsDir, { recursive: true });
    }
  }

  async createPack(input: CreatePackInput): Promise<CreativePack> {
    const { name, projectId, angleIds, locales, platforms } = input;

    // Verify project exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // Verify all angles exist and belong to project
    for (const angleId of angleIds) {
      const angle = await angleRepository.findById(angleId);
      if (!angle) {
        throw new NotFoundError(`Angle ${angleId}`);
      }
      if (angle.projectId !== projectId) {
        throw new ValidationError(`Angle ${angleId} does not belong to project ${projectId}`);
      }
    }

    // Collect all localized content
    const contentByAngle: Map<string, LocalizedContent[]> = new Map();
    for (const angleId of angleIds) {
      const contents = await localizedContentRepository.findByAngleId(angleId);
      const filtered = contents.filter(
        (c) =>
          locales.includes(c.locale as Locale) &&
          platforms.includes(c.platform as Platform)
      );
      if (filtered.length > 0) {
        contentByAngle.set(angleId, filtered);
      }
    }

    if (contentByAngle.size === 0) {
      throw new ValidationError(
        'No localized content found for the selected angles, locales, and platforms'
      );
    }

    // Build manifest
    const manifest: PackManifest = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      project_name: project.name,
      contents: {
        angles: contentByAngle.size,
        locales: [...new Set([...contentByAngle.values()].flat().map((c) => c.locale))],
        platforms: [...new Set([...contentByAngle.values()].flat().map((c) => c.platform))],
        total_files: [...contentByAngle.values()].flat().length * 2, // scripts + captions
      },
      files: [],
    };

    // Create pack record first
    const pack = await packRepository.create({
      name,
      projectId,
      manifest,
    });

    // Generate ZIP file
    const filename = `pack-${pack.id.slice(0, 8)}-${Date.now()}.zip`;
    const filePath = join(this.storagePath, 'packs', filename);

    try {
      await this.generateZip(pack.id, filePath, contentByAngle, manifest);

      const stats = statSync(filePath);
      const updatedPack = await packRepository.updateDownloadInfo(pack.id, {
        filePath,
        fileSize: stats.size,
      });

      // Add pack angles
      const packAngles: Array<{ angleId: string; locale: Locale; platform: Platform }> = [];
      for (const [angleId, contents] of contentByAngle) {
        for (const content of contents) {
          packAngles.push({
            angleId,
            locale: content.locale as Locale,
            platform: content.platform as Platform,
          });
        }
      }
      await packRepository.addAngles(pack.id, packAngles);

      logger.info({ packId: pack.id, size: stats.size }, 'Pack created successfully');

      return updatedPack;
    } catch (error) {
      // Clean up on failure
      await packRepository.delete(pack.id);
      throw error;
    }
  }

  private async generateZip(
    _packId: string,
    filePath: string,
    contentByAngle: Map<string, LocalizedContent[]>,
    manifest: PackManifest
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      // Add content files
      for (const [angleId, contents] of contentByAngle) {
        for (const content of contents) {
          const baseDir = `${content.locale}/${content.platform}/${angleId.slice(0, 8)}`;

          // Add script file
          const scriptPath = `${baseDir}/script.txt`;
          archive.append(content.script, { name: scriptPath });
          manifest.files.push({
            path: scriptPath,
            type: 'script',
            angle_id: angleId,
            locale: content.locale,
            platform: content.platform,
          });

          // Add captions as SRT
          const captions = content.captions as Array<{
            timestamp_start: number;
            timestamp_end: number;
            text: string;
          }>;
          if (captions && captions.length > 0) {
            const srtContent = this.generateSRT(captions);
            const captionsPath = `${baseDir}/captions.srt`;
            archive.append(srtContent, { name: captionsPath });
            manifest.files.push({
              path: captionsPath,
              type: 'captions',
              angle_id: angleId,
              locale: content.locale,
              platform: content.platform,
            });
          }

          // Add metadata
          const metadata = {
            angle_id: angleId,
            locale: content.locale,
            platform: content.platform,
            cultural_notes: content.culturalNotes,
            platform_adjustments: content.platformAdjustments,
            character_count: content.characterCount,
            word_count: content.wordCount,
            created_at: content.createdAt,
          };
          const metadataPath = `${baseDir}/metadata.json`;
          archive.append(JSON.stringify(metadata, null, 2), { name: metadataPath });
          manifest.files.push({
            path: metadataPath,
            type: 'metadata',
            angle_id: angleId,
            locale: content.locale,
            platform: content.platform,
          });
        }
      }

      // Add manifest
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      archive.finalize();
    });
  }

  private generateSRT(
    captions: Array<{
      timestamp_start: number;
      timestamp_end: number;
      text: string;
    }>
  ): string {
    return captions
      .map((caption, index) => {
        const start = this.formatSRTTime(caption.timestamp_start);
        const end = this.formatSRTTime(caption.timestamp_end);
        return `${index + 1}\n${start} --> ${end}\n${caption.text}\n`;
      })
      .join('\n');
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  async getPack(id: string) {
    const pack = await packRepository.findById(id);
    if (!pack) {
      throw new NotFoundError('Pack');
    }
    return pack;
  }

  async getProjectPacks(projectId: string) {
    const exists = await projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundError('Project');
    }
    return packRepository.findByProjectId(projectId);
  }

  async downloadPack(id: string): Promise<PackDownload> {
    const pack = await packRepository.findById(id);
    if (!pack) {
      throw new NotFoundError('Pack');
    }

    if (!pack.filePath || !existsSync(pack.filePath)) {
      throw new NotFoundError('Pack file');
    }

    // Increment download count
    await packRepository.incrementDownloads(id);

    const stats = statSync(pack.filePath);
    const stream = createReadStream(pack.filePath);
    const filename = `${pack.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;

    logger.info({ packId: id }, 'Pack downloaded');

    return {
      stream,
      filename,
      size: stats.size,
    };
  }

  async deletePack(id: string) {
    const pack = await packRepository.findById(id);
    if (!pack) {
      throw new NotFoundError('Pack');
    }

    await packRepository.delete(id);
    logger.info({ packId: id }, 'Pack deleted');
  }
}

export const packService = new PackService();