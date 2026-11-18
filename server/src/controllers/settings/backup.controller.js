const fs = require('node:fs');
const backupService = require('../../services/settings/backup.service');

exports.getStatus = (_request, response) => {
    response.json({ success: true, data: backupService.getStatus() });
};

exports.downloadLocalBackup = async (_request, response, next) => {
    let backup;
    try {
        backup = await backupService.createLocalBackup();
    } catch (error) {
        return next(error);
    }

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        backupService.removeTemporaryBackup(backup).catch((error) => {
            console.error('Failed to remove temporary MongoDB backup files:', error.message);
        });
    };

    const stream = fs.createReadStream(backup.path);
    stream.once('open', () => {
        response.status(200).set({
            'Content-Type': 'application/gzip',
            'Content-Length': String(backup.size),
            'Content-Disposition': `attachment; filename="${backup.fileName}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        response.once('close', () => stream.destroy());
        stream.pipe(response);
    });
    stream.once('error', (error) => {
        if (response.headersSent) response.destroy(error);
        else {
            cleanup();
            next(error);
        }
    });
    stream.once('close', cleanup);
};
