'use strict';

let request = require('request');
let util    = require('util');
let _       = require('lodash');
let email   = require('./email');

const AMEX_PLATINUM_REGEX = /.*(am|american|america|american|americans|american's).*(e|ex|express|express's|express'|expresses).*(plat|platinum)*.*(platinum|plat)*.*(100|100k|100000|100,000)*.*/gi

const REDDIT_INFO = {
    subreddits: [
        {
            page: 'churning',
            regex: AMEX_PLATINUM_REGEX,
            description: 'AMEX Personal Platinum 100k Deal'
        }
    ],
    topNewPostsUrl: 'https://www.reddit.com/r/%s/top/.json?sort=new',
};
REDDIT_INFO.subreddits.forEach(subreddit => subreddit.url = util.format(REDDIT_INFO.topNewPostsUrl, subreddit.page)); 

const USER_AGENT = 'node:com.bpkazemi.subreddit_monitor:v1.0 (by /u/bpourkazemi)'

let previousMatches = _.reduce(REDDIT_INFO.subreddits, (result, subreddit) => {
    result[subreddit.page] = {
        matches: [],
        modified: (new Date()).getTime()
    };
    return result;
}, {});

let checkForNewMatches = subreddits => {
    clearStaleMatches(previousMatches);

    subreddits.forEach(subreddit => {
        request({
            url: subreddit.url,
            headers: {
                'User-Agent': USER_AGENT
            }
        }, (err, response, body) => {
            console.log(subreddit.page);
            if (!err && response.statusCode === 200) {
                try {
                    let json = JSON.parse(body);
                    let data = json.data;

                    _.get(json, 'data.children', []).forEach(child => {
                        var title     = _.get(child, 'data.title', '');
                        var permalink = _.get(child, 'data.permalink', '');

                        console.log(`\tTitle: ${title}`);

                        if (AMEX_PLATINUM_REGEX.exec(title) !== null) {
                            if (previousMatches[subreddit.page].matches.indexOf(title) === -1) {
                                console.log(`\t[NEW MATCH]: ${title}`);
                                previousMatches[subreddit.page].matches.push(title);
                                previousMatches[subreddit.page].modified = (new Date()).getTime();
                                sendEmailAlert(subreddit, { title: title, permalink: permalink });
                            }
                        }
                    });
                } catch (exception) {
                    console.error(`Error parsing JSON for body=${body}`);
                    console.error(exception);
                }
            }
        });
    });
};

let sendEmailAlert = (subreddit, matchingPost) => {
    const SUBSCRIBERS = ['bp5xj@virginia.edu'];
    const postUrl = util.format('https://www.reddit.com%s', matchingPost.permalink);

    let subject = `[Reddit Monitor] - /r/${subreddit.page} - Possible Match for: ${subreddit.description}`;
    let body = `Title of matching post: "${matchingPost.title}"\n\nLink to reddit post: ${postUrl}`;

    email({
        to: SUBSCRIBERS.join(', '),
        subject: subject,
        body: body
    });
};

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;
const TTL = ONE_WEEK;
let clearStaleMatches = maybeStaleMatches => {
    let now = (new Date()).getTime();

    Object.keys(maybeStaleMatches).forEach(subredditPage => {
        if (now - maybeStaleMatches[subredditPage].modified > TTL) {
            console.log('\n[CLEARING STALE MATCHES]\n');
            maybeStaleMatches[subredditPage].matches = [];
            maybeStaleMatches[subredditPage].modified = now;
        }
    });
};

const TEN_MINUTES = 1000 * 60 * 30;
checkForNewMatches(REDDIT_INFO.subreddits);
setInterval(() => checkForNewMatches(REDDIT_INFO.subreddits), TEN_MINUTES);

