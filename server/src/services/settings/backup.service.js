const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');

const serviceError = (message, statusCode) => Object.assign(new Error(message), {
    statusCode,
    expose: statusCode === 503
});
let mongoUri = '';

function isFile(candidate) {
    try {
        return fs.statSync(candidate).isFile();
    } catch {
        return false;
    }
}

function findMongoDump() {
    const configuredPath = process.env.MONGODUMP_PATH?.trim();
    if (configuredPath) {
        if (isFile(configuredPath)) return configuredPath;
        return null;
    }

    const executableNames = process.platform === 'win32'
        ? ['mongodump.exe', 'mongodump']
        : ['mongodump'];

    for (const directory of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
        for (const executableName of executableNames) {
            const candidate = path.join(directory, executableName);
            if (isFile(candidate)) return candidate;
        }
    }
    return null;
}

function safeDatabaseLabel(name) {
    return String(name || 'database').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'database';
}

exports.configureMongoUri = (uri) => {
    if (typeof uri !== 'string' || !uri.trim()) throw new TypeError('MongoDB URI is required for local backups.');
    mongoUri = uri.trim();
};

exports.getStatus = () => {
    const mongodumpAvailable = Boolean(findMongoDump());
    return {
        database: mongoose.connection.name || '',
        connected: mongoose.connection.readyState === 1,
        mongodumpAvailable,
        toolMessage: !mongodumpAvailable && process.env.MONGODUMP_PATH?.trim()
            ? 'MONGODUMP_PATH does not point to a mongodump file.'
            : '',
        restoreEnabled: false
    };
};

exports.createLocalBackup = async () => {
    if (mongoose.connection.readyState !== 1) {
        throw serviceError('MongoDB is not connected. Reconnect the database before creating a backup.', 503);
    }
    if (!mongoUri) throw serviceError('MongoDB backup is not initialized. Restart the API and try again.', 503);
    const executable = findMongoDump();
    if (!executable) {
        throw serviceError('MongoDB Database Tools (mongodump) are not installed. Install the MongoDB Database Tools and set MONGODUMP_PATH if the executable is not on PATH.', 503);
    }

    const temporaryDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'transport-crm-backup-'));
    const configPath = path.join(temporaryDirectory, 'mongodump.yaml');
    const archivePath = path.join(temporaryDirectory, 'transport-erp.archive.gz');
    try {
        await fsp.writeFile(configPath, `uri: ${JSON.stringify(mongoUri)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        const result = await new Promise((resolve, reject) => {
            let child;
            try {
                child = spawn(executable, ['--config', configPath, '--archive', archivePath, '--gzip'], {
                    windowsHide: true,
                    stdio: ['ignore', 'ignore', 'ignore']
                });
            } catch (error) {
                reject(error);
                return;
            }
            child.once('error', reject);
            child.once('close', (code, signal) => resolve({ code, signal }));
        });
        if (result.code !== 0) {
            throw serviceError(`mongodump failed${result.signal ? ` (signal ${result.signal})` : ` (exit code ${result.code})`}. Check MongoDB connectivity and the MongoDB Database Tools installation.`, 503);
        }

        const stats = await fsp.stat(archivePath);
        if (!stats.isFile() || stats.size < 1) {
            throw serviceError('mongodump completed without producing a backup archive.', 503);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return {
            path: archivePath,
            temporaryDirectory,
            size: stats.size,
            fileName: `transport-erp-${safeDatabaseLabel(mongoose.connection.name)}-${timestamp}.archive.gz`
        };
    } catch (error) {
        await fsp.rm(temporaryDirectory, { recursive: true, force: true });
        throw error;
    }
};

exports.removeTemporaryBackup = (backup) => fsp.rm(backup.temporaryDirectory, { recursive: true, force: true });
