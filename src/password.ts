
import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';

import * as bcrypt from 'bcryptjs';

import { fork } from './meta/debugFork';

interface Message {
    type: 'hash' | 'compare';
    rounds?: number;
    password?: string;
    hash?: string;
    shaWrapped?: boolean;
    err?: string;
    result?: string;
}


function forkChild(message: Message, callback: (error: Error | null, result?: string) => void) {
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const child: fork = fork(path.join(__dirname, 'password'));
    child.on('message', (msg: Message) => {
        callback(msg.err ? new Error(msg.err) : null, msg.result);
    });
    child.on('error', (err) => {
        console.error(err.stack);
        callback(err);
    });

    child.send(message);
}

const forkChildAsync = util.promisify(forkChild);

export async function hash(rounds: number, password: string): Promise<string> {
    password = crypto.createHash('sha512').update(password).digest('hex');
    return await forkChildAsync({ type: 'hash', rounds, password });
}

let fakeHashCache: string | undefined;
async function getFakeHash(): Promise<string> {
    if (fakeHashCache) {
        return fakeHashCache;
    }
    fakeHashCache = await hash(12, Math.random().toString());
    return fakeHashCache;
}
async function tryMethod(method, msg) {
    try {
        const result = await method(msg);
        process.send({ result: result });
    } catch (err) {
        process.send({ err: err.message });
    } finally {
        process.disconnect();
    }
}

async function hashPassword(msg) {
    const salt = await bcrypt.genSalt(parseInt(msg.rounds, 10));
    const hash = await bcrypt.hash(msg.password, salt);
    return hash;
}

async function compare(msg) {
    return await bcrypt.compare(String(msg.password || ''), String(msg.hash || ''));
}

export async function compare2(password: string, hash?: string, shaWrapped?: boolean): Promise<boolean> {
    const fakeHash = await getFakeHash();

    if (shaWrapped) {
        password = crypto.createHash('sha512').update(password).digest('hex');
    }

    const result = await forkChildAsync({ type: 'compare', password, hash: hash || fakeHash });
    return result === 'true';
}


// child process
process.on('message', (msg:Message) => {
    if (msg.type === 'hash') {
        tryMethod(hashPassword, msg);
    } else if (msg.type === 'compare') {
        tryMethod(compare, msg);
    }
});


require('./promisify')(exports);

