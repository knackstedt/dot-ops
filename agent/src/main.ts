import express from 'express';
import http from 'http';

import { logger } from './util/logger';
import { RunAgentProcess } from './agent';
import environment from './util/environment';
import { FilesystemApi } from './api/filesystem';

const agentId = environment.agentId;
const taskId  = `jobs:` + agentId.toUpperCase();

if (!agentId || !/^[0-7][0-9A-Z]{25}$/i.test(agentId)) {
    logger.fatal({ message: "Invalid agent identifier!"})
    process.exit(1);
}

process.on('unhandledRejection', (reason, p) => {
    logger.error({
        kind: "unhandledPromise",
        reason,
        p,
        stack: reason['stack']
    });
});
process.on("uncaughtException", err => {
    err['kind'] = "Uncaught";
    logger.error(err);
});

(async () => {
    const app = express();

    app.use(express.json());
    app.use((req, res, next) => {
        // Ensure the access is only coming from the system that spawned this agent
        if (environment.webserverToken == req.get("Authorization"))
            return next();

        res
            .status(401)
            .send();
    })

    app.use("/fs", FilesystemApi);

    app.use((req, res, next) => next(404));
    app.use((err, req, res, next) => {
        logger.error(err);
    });

    const server = http.createServer(app);
    const port = 8080;
    server.listen(port);

    server.on("error", logger.error);
    server.on("listening", () => logger.info(`Server listening on port ${port}`));
})();

RunAgentProcess(taskId)
    .catch(ex => {
        logger.error(ex)
    })
    .then(() => {
        // process.exit(0)
    })
