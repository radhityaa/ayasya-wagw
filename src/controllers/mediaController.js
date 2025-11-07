const whatsappService = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Media Controller
 * 
 * Handles media conversion for WhatsApp compatibility
 * - Voice: Convert to Opus format (.ogg)
 * - Video: Convert to MP4 format with WhatsApp-compatible settings
 * 
 * Requirements:
 * - FFmpeg must be installed on the system
 * - Input files should be provided as base64 or file path
 */
class MediaController {
  // Convert voice to WhatsApp format (Opus)
  async convertVoice(req, res, next) {
    let inputPath = null;
    let outputPath = null;

    try {
      const { instanceId } = req.params;
      const { file, base64, filename } = req.body;
      
      if (!file && !base64) {
        return res.status(400).json({
          success: false,
          error: 'File path or base64 data is required'
        });
      }

      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate unique filenames
      const timestamp = Date.now();
      const inputFilename = filename || `voice_input_${timestamp}`;
      inputPath = path.join(tempDir, inputFilename);
      outputPath = path.join(tempDir, `voice_output_${timestamp}.ogg`);

      // Save input file
      if (base64) {
        // Remove data URL prefix if present
        const base64Data = base64.replace(/^data:audio\/\w+;base64,/, '');
        fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));
      } else {
        // Copy from provided file path
        if (!fs.existsSync(file)) {
          return res.status(400).json({
            success: false,
            error: 'Input file not found'
          });
        }
        fs.copyFileSync(file, inputPath);
      }

      // Check if FFmpeg is installed
      try {
        await execPromise('ffmpeg -version');
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'FFmpeg is not installed. Please install FFmpeg to use media conversion features.',
          details: 'Install FFmpeg: https://ffmpeg.org/download.html'
        });
      }

      // Convert to Opus format (WhatsApp voice format)
      const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 128k -vbr on -compression_level 10 "${outputPath}" -y`;
      
      await execPromise(ffmpegCommand);

      // Read converted file
      const convertedBuffer = fs.readFileSync(outputPath);
      const convertedBase64 = convertedBuffer.toString('base64');

      // Get file size
      const stats = fs.statSync(outputPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);

      res.json({
        success: true,
        message: 'Voice converted to WhatsApp format successfully',
        data: {
          format: 'opus',
          extension: '.ogg',
          size: `${fileSizeInKB} KB`,
          base64: convertedBase64,
          mimeType: 'audio/ogg; codecs=opus'
        }
      });

      // Cleanup temp files
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
      console.error('Error converting voice:', error);
      
      // Cleanup temp files on error
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      
      res.status(500).json({
        success: false,
        error: 'Failed to convert voice',
        details: error.message
      });
    }
  }

  // Convert video to WhatsApp format (MP4)
  async convertVideo(req, res, next) {
    let inputPath = null;
    let outputPath = null;

    try {
      const { instanceId } = req.params;
      const { file, base64, filename } = req.body;
      
      if (!file && !base64) {
        return res.status(400).json({
          success: false,
          error: 'File path or base64 data is required'
        });
      }

      const instance = whatsappService.getInstance(instanceId);
      
      if (!instance || !instance.socket) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected'
        });
      }

      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate unique filenames
      const timestamp = Date.now();
      const inputFilename = filename || `video_input_${timestamp}`;
      inputPath = path.join(tempDir, inputFilename);
      outputPath = path.join(tempDir, `video_output_${timestamp}.mp4`);

      // Save input file
      if (base64) {
        // Remove data URL prefix if present
        const base64Data = base64.replace(/^data:video\/\w+;base64,/, '');
        fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));
      } else {
        // Copy from provided file path
        if (!fs.existsSync(file)) {
          return res.status(400).json({
            success: false,
            error: 'Input file not found'
          });
        }
        fs.copyFileSync(file, inputPath);
      }

      // Check if FFmpeg is installed
      try {
        await execPromise('ffmpeg -version');
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'FFmpeg is not installed. Please install FFmpeg to use media conversion features.',
          details: 'Install FFmpeg: https://ffmpeg.org/download.html'
        });
      }

      // Convert to MP4 format (WhatsApp video format)
      // Using H.264 codec with AAC audio, optimized for WhatsApp
      const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "${outputPath}" -y`;
      
      await execPromise(ffmpegCommand);

      // Read converted file
      const convertedBuffer = fs.readFileSync(outputPath);
      const convertedBase64 = convertedBuffer.toString('base64');

      // Get file size
      const stats = fs.statSync(outputPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

      res.json({
        success: true,
        message: 'Video converted to WhatsApp format successfully',
        data: {
          format: 'mp4',
          extension: '.mp4',
          size: `${fileSizeInMB} MB`,
          base64: convertedBase64,
          mimeType: 'video/mp4',
          codec: {
            video: 'H.264',
            audio: 'AAC'
          }
        }
      });

      // Cleanup temp files
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
      console.error('Error converting video:', error);
      
      // Cleanup temp files on error
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      
      res.status(500).json({
        success: false,
        error: 'Failed to convert video',
        details: error.message
      });
    }
  }
}

module.exports = new MediaController();
