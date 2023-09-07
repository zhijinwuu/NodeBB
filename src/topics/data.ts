
import validator from 'validator';

import * as db from '../database';
import * as categories from '../categories';
import * as utils from '../utils';
import * as translator from '../translator';
import * as plugins from '../plugins';


interface Topic {
    tid: number;
    cid: number;
    uid: number;
    mainPid: number;
    postcount: number;
    viewcount: number;
    postercount: number;
    deleted: number;
    locked: number;
    pinned: number;
    pinExpiry: number;
    timestamp: number;
    upvotes: number;
    downvotes: number;
    lastposttime: number;
    deleterUid: number;
}


const intFields = [
    'tid', 'cid', 'uid', 'mainPid', 'postcount',
    'viewcount', 'postercount', 'deleted', 'locked', 'pinned',
    'pinExpiry', 'timestamp', 'upvotes', 'downvotes', 'lastposttime',
    'deleterUid',
];

function escapeTitle(topicData: any) {
    if (topicData) {
        if (topicData.title) {
            topicData.title = translator.escape(validator.escape(topicData.title));
        }
        if (topicData.titleRaw) {
            topicData.titleRaw = translator.escape(topicData.titleRaw);
        }
    }
}

function modifyTopic(topic: any, fields: string[]) {
    if (!topic) {
        return;
    }

    db.parseIntFields(topic, intFields, fields);

    if (topic.hasOwnProperty('title')) {
        topic.titleRaw = topic.title;
        topic.title = String(topic.title);
    }

    escapeTitle(topic);

    if (topic.hasOwnProperty('timestamp')) {
        topic.timestampISO = utils.toISOString(topic.timestamp);
        if (!fields.length || fields.includes('scheduled')) {
            topic.scheduled = topic.timestamp > Date.now();
        }
    }

    if (topic.hasOwnProperty('lastposttime')) {
        topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
    }

    if (topic.hasOwnProperty('pinExpiry')) {
        topic.pinExpiryISO = utils.toISOString(topic.pinExpiry);
    }

    if (topic.hasOwnProperty('upvotes') && topic.hasOwnProperty('downvotes')) {
        topic.votes = topic.upvotes - topic.downvotes;
    }

    if (fields.includes('teaserPid') || !fields.length) {
        topic.teaserPid = topic.teaserPid || null;
    }

    if (fields.includes('tags') || !fields.length) {
        const tags = String(topic.tags || '');
        topic.tags = tags.split(',').filter(Boolean).map((tag: string) => {

            const escaped = validator.escape(String(tag));
            return {
                value: tag,
                valueEscaped: escaped,
                valueEncoded: encodeURIComponent(escaped),
                class: escaped.replace(/\s/g, '-'),
            };
        });
    }
}


export default function (Topics: any) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Topics.getTopicsFields = async function (tids: number[], fields: string[]) {
        if (!Array.isArray(tids) || !tids.length) {
            return [];
        }

        // "scheduled" is derived from "timestamp"
        if (fields.includes('scheduled') && !fields.includes('timestamp')) {
            fields.push('timestamp');
        }

        const keys = tids.map(tid => `topic:${tid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topics: Topic[] = await db.getObjects(keys, fields);
        const result = await plugins.hooks.fire('filter:topic.getFields', {
            tids: tids,
            topics: topics,
            fields: fields,
            keys: keys,
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        result.topics.forEach(topic => modifyTopic(topic, fields));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return result.topics;
    };

    Topics.getTopicField = async function (tid: number, field: string) {
        const topic = await Topics.getTopicFields(tid, [field]);
        return topic ? topic[field] : null;
    };

    Topics.getTopicFields = async function (tid: number, fields: string[]) {
        const topics: Topic[] = await Topics.getTopicsFields([tid], fields);
        return topics ? topics[0] : null;
    };

    Topics.getTopicData = async function (tid: number) {
        const topics: Topic[] = await Topics.getTopicsFields([tid], []);
        return topics && topics.length ? topics[0] : null;
    };

    Topics.getTopicsData = async function (tids: number[]) {
        return await Topics.getTopicsFields(tids, []);
    };

    Topics.getCategoryData = async function (tid: number) {
        const cid = await Topics.getTopicField(tid, 'cid');
        return await categories.getCategoryData(cid);
    };

    Topics.setTopicField = async function (tid: number, field: string, value: any) {
        await db.setObjectField(`topic:${tid}`, field, value);
    };

    Topics.setTopicFields = async function (tid: number, data: Record<string, any>) {
        await db.setObject(`topic:${tid}`, data);
    };

    Topics.deleteTopicField = async function (tid: number, field: string) {
        await db.deleteObjectField(`topic:${tid}`, field);
    };

    Topics.deleteTopicFields = async function (tid: number, fields: string[]) {
        await db.deleteObjectFields(`topic:${tid}`, fields);
    };
};


