'use strict';

import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';

import * as bcrypt from 'bcryptjs';

import { fork } from './meta/debugFork';

function forkChild(message: any, callback: (err: Error | null, result: any) => void) {
    const child = fork(path.join(__dirname, 'password'));

    child.on('message', (msg) => {
        callback(msg.err ? new Error(msg.err) : null, msg.result);
    });
    child.on('error', (err) => {
        console.error(err.stack);
        callback(err, null);
    });

    child.send(message);
}

const forkChildAsync = util.promisify(forkChild);

export async function hash(rounds: number, password: string): Promise<any> {
    password = crypto.createHash('sha512').update(password).digest('hex');
    return await forkChildAsync({ type: 'hash', rounds: rounds, password: password });
}


export async function compare2(password: string, hash: string, shaWrapped: boolean): Promise<any> {
    const fakeHash = await getFakeHash();

    if (shaWrapped) {
        password = crypto.createHash('sha512').update(password).digest('hex');
    }

    return await forkChildAsync({ type: 'compare', password: password, hash: hash || fakeHash });
}

let fakeHashCache: string | undefined;
async function getFakeHash(): Promise<string> {
    if (fakeHashCache) {
        return fakeHashCache;
    }
    fakeHashCache = await hash(12, Math.random().toString());
    return fakeHashCache;
}

// Child process
process.on('message', (msg: any) => {
    if (msg.type === 'hash') {
        tryMethod(hashPassword, msg);
    } else if (msg.type === 'compare') {
        tryMethod(compare, msg);
    }
});

async function tryMethod(method: (msg: any) => Promise<any>, msg: any) {
    try {
        const result = await method(msg);
        process.send({ result: result });
    } catch (err) {
        process.send({ err: err.message });
    } finally {
        process.disconnect();
    }
}

async function hashPassword(msg: any): Promise<string> {
    const salt = await bcrypt.genSalt(parseInt(msg.rounds, 10));
    const hash = await bcrypt.hash(msg.password, salt);
    return hash;
}

async function compare(msg: any): Promise<boolean> {
    return await bcrypt.compare(String(msg.password || ''), String(msg.hash || ''));
}

require('./promisify')(exports);