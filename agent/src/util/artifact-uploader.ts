import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import os from 'os';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import FormData from 'form-data';

import { getSocketLogger } from '../socket/logger';
import { JobInstance } from '../../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { api } from './axios';

const compressLrztar = async (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    return new Promise<ChildProcessWithoutNullStreams>(async (res, rej) => {
        try {
            const process = spawn('lrztar', ['-z', '-o', targetFile + '.tar.lrz', dir], { windowsHide: true });

            process.stdout.on('data', (data) => logger.stdout({ time: Date.now(), data, scope: "sealing" }));
            process.stderr.on('data', (data) => logger.stderr({ time: Date.now(), data, scope: "sealing" }));

            process.on('error', (err) => logger.error(err));

            process.on('disconnect', (...args) => {
                logger.error({
                    msg: `Process unexpectedly disconnected`,
                    args
                });
                res(process);
            });

            process.on('exit', (code) => {
                if (code == 0) {
                    logger.info({ msg: `Process exited successfully` });
                    res(process);
                }
                else {
                    logger.error({ msg: `Process exited with non-zero exit code`, code });
                    res(process);
                }
            });
        }
        catch (err) {
            // Return the process and transmit the error object
            res({
                exitCode: -1,
                err: err
            } as any);
        }
    });
}

// Fallback mechanism.
const compressZip = async (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const zip = new AdmZip();

    await zip.addLocalFolderPromise(dir, { });

    return zip.writeZipPromise(targetFile + '.zip')
        .then(res => ({ exitCode: res ? 0 : -1, path: targetFile + '.zip' }))
        .catch(err => ({ exitCode: -1, err }));
}

const uploadBinary = async (path: string) => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(path));

    let headers = formData.getHeaders();

    return api.post(`/api/`, formData, { headers });
}

export const UploadArtifacts = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const compressArtifact = os.platform() == "win32"
        ? compressZip
        : compressLrztar;

    const uploads = [];

    for (const artifact of job.artifacts) {
        const dir = artifact.source;
        const dest = artifact.destination;
        const result = await compressArtifact(dir, dest, logger);

        // If it was successful in saving to disk, upload it
        if (result['path']) {
            uploads.push(uploadBinary(result['path']))
        }
    }

    for await (let upload of uploads) {}
}
