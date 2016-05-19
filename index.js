'use strict';

let request = require('request');
let util    = require('util');
let _       = require('lodash');
let email   = require('./email');

const AMEX_PLATINUM_REGEX = /.*(am|american|america|american|americans|american's).*(e|ex|express|express's|express'|expresses).*(plat|platinum)*.*(platinum|plat)*.*(100|100k|100000|100,000)*.*/gi

const REDDIT_INFO = {
    subreddits: [
        {
            r: 'churning',
            regex: AMEX_PLATINUM_REGEX,
            description: 'AMEX Personal Platinum 100k Deal'
        }
    ],
    topNewPostsUrl: 'https://www.reddit.com/r/%s/top/.json?sort=new',
};
REDDIT_INFO.subreddits.forEach(subreddit =>
    subreddit.url = util.format(REDDIT_INFO.topNewPostsUrl, subreddit.r)); 

const USER_AGENT = 'node:com.bpkazemi.subreddit_monitor:v1.0 (by /u/bpourkazemi)'

let subreddit2Matches = 
    _.reduce(REDDIT_INFO.subreddits, (result, subreddit) => {
        result[subreddit.r] = [/* { id: 'abc123', timestamp: 123456789 } */]
        return result;
    }, {});

let checkForNewMatches = subreddits => {
    clearStaleMatches(subreddit2Matches);

    subreddits.forEach(subreddit => {
        request({
            url: subreddit.url,
            headers: { 'User-Agent': USER_AGENT }
        }, (err, response, body) => {
            console.log(`/r/${subreddit.r}:`);

            if (!err && response.statusCode === 200) {
                try {
                    let json = JSON.parse(body);
                    let data = json.data;

                    _.get(json, 'data.children', []).forEach(child => {
                        let id        = _.get(child, 'data.id', '');
                        let title     = _.get(child, 'data.title', '');
                        let permalink = _.get(child, 'data.permalink', '');

                        console.log(`\tTitle: ${title}`);

                        if (subreddit.regex.exec(title) !== null) {
                            if (!_.find(subreddit2Matches[subreddit.r], o => o.id === id)) {
                                console.log(`\t[NEW MATCH]: ${title}`);
                                subreddit2Matches[subreddit.r].push({
                                    id: id,
                                    timestamp: (new Date()).getTime()
                                });
                                sendEmailAlert(subreddit, { title: title, permalink: permalink });  // TODO: Batch email alerts
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

    let subject = `[Reddit Monitor] - /r/${subreddit.r} - Possible Match for: ${subreddit.description}`;
    let body = `Title of matching post: "${matchingPost.title}\n\nLink to reddit post: ${postUrl}"`;

    email({
        to: SUBSCRIBERS.join(', '),
        subject: subject,
        body: body
    });
};

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;
const TTL = ONE_WEEK;
let clearStaleMatches = matches => {
    console.log(matches);
    let now = (new Date()).getTime();

    Object.keys(matches).forEach(subreddit => {
        _.remove(matches[subreddit], match => now - match.timestamp > TTL);
    });
};

const TEN_MINUTES = 1000 * 60 * 30;
checkForNewMatches(REDDIT_INFO.subreddits);
setInterval(() => checkForNewMatches(REDDIT_INFO.subreddits), TEN_MINUTES);

