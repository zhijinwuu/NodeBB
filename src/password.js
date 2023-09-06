'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compare2 = exports.hash = void 0;
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const util = __importStar(require("util"));
const bcrypt = __importStar(require("bcryptjs"));
const debugFork_1 = require("./meta/debugFork");
function forkChild(message, callback) {
    const child = (0, debugFork_1.fork)(path.join(__dirname, 'password'));
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
function hash(rounds, password) {
    return __awaiter(this, void 0, void 0, function* () {
        password = crypto.createHash('sha512').update(password).digest('hex');
        return yield forkChildAsync({ type: 'hash', rounds: rounds, password: password });
    });
}
exports.hash = hash;
function compare2(password, hash, shaWrapped) {
    return __awaiter(this, void 0, void 0, function* () {
        const fakeHash = yield getFakeHash();
        if (shaWrapped) {
            password = crypto.createHash('sha512').update(password).digest('hex');
        }
        return yield forkChildAsync({ type: 'compare', password: password, hash: hash || fakeHash });
    });
}
exports.compare2 = compare2;
let fakeHashCache;
function getFakeHash() {
    return __awaiter(this, void 0, void 0, function* () {
        if (fakeHashCache) {
            return fakeHashCache;
        }
        fakeHashCache = yield hash(12, Math.random().toString());
        return fakeHashCache;
    });
}
// Child process
process.on('message', (msg) => {
    if (msg.type === 'hash') {
        tryMethod(hashPassword, msg);
    }
    else if (msg.type === 'compare') {
        tryMethod(compare, msg);
    }
});
function tryMethod(method, msg) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield method(msg);
            process.send({ result: result });
        }
        catch (err) {
            process.send({ err: err.message });
        }
        finally {
            process.disconnect();
        }
    });
}
function hashPassword(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const salt = yield bcrypt.genSalt(parseInt(msg.rounds, 10));
        const hash = yield bcrypt.hash(msg.password, salt);
        return hash;
    });
}
function compare(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcrypt.compare(String(msg.password || ''), String(msg.hash || ''));
    });
}
require('./promisify')(exports);
