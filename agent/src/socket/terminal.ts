import { io } from "socket.io-client";
import environment from '../util/environment';
import { getLogger } from '../util/logger';

const logger = getLogger("terminal");

export const getSocketLogger = async () => {
    const socket = io(environment.dotopsUrl, {
        path: "/ws/ssh",
        extraHeaders: {}
    });

    await new Promise((res, rej) => {
        socket.on("connection", (socket) => res(socket));
        socket.on("ssh:start", () => 1
        );
        socket.on("error", (err) => rej(err));
    });
}